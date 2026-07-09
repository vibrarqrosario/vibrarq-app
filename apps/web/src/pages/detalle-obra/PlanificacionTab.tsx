import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Consolidado } from '../../types/presupuesto';

type Segmento = { segmento: number; inicio: number; dias: number };
type PlanFila = { code: string; nombre: string; diasPresupuesto: number; total: number; avancePct: number; segmentos: Segmento[] };
type Plan = { fechaInicio: string | null; filas: PlanFila[] };

const DAY_W = 22; // px por día calendario
const DIAS_LABEL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// Normaliza el inicio a un día hábil (si cae sábado/domingo pasa al lunes)
function normalizarInicio(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  while (r.getDay() === 0 || r.getDay() === 6) r.setDate(r.getDate() + 1);
  return r;
}

export function PlanificacionTab({ obraId, budgetSel }: { obraId: string; budgetSel: string }) {
  const isConsolidado = budgetSel === 'consol';
  const qc = useQueryClient();

  const planQuery = useQuery({
    queryKey: ['plan', budgetSel],
    queryFn: () => api.get<Plan>(`/presupuestos/${budgetSel}/plan`),
    enabled: !isConsolidado,
  });
  const consolidadoQuery = useQuery({
    queryKey: ['obra', obraId, 'consolidado'],
    queryFn: () => api.get<Consolidado>(`/obras/${obraId}/consolidado`),
    enabled: isConsolidado,
  });

  // Para el consolidado se arma una vista de solo lectura encadenada
  const planServidor: Plan | undefined = useMemo(() => {
    if (!isConsolidado) return planQuery.data;
    const etapas = consolidadoQuery.data?.etapas ?? [];
    let cursor = 0;
    const filas: PlanFila[] = etapas
      .map((et) => {
        const items = et.items.filter((it) => it.cantidad > 0);
        const dias = Math.max(1, items.reduce((s, it) => s + it.dias, 0));
        const total = items.reduce((s, it) => s + it.subTotalMaterial + it.precioVenta, 0);
        const cert = items.reduce((s, it) => s + (it.subTotalMaterial + it.precioVenta) * (it.avance / 100), 0);
        return { code: et.code, nombre: et.nombre, diasPresupuesto: dias, total, avancePct: total > 0 ? Math.round((cert / total) * 100) : 0 };
      })
      .filter((f) => f.total > 0)
      .map((f) => {
        const fila = { ...f, segmentos: [{ segmento: 0, inicio: cursor, dias: f.diasPresupuesto }] };
        cursor += f.diasPresupuesto;
        return fila;
      });
    return { fechaInicio: null, filas };
  }, [isConsolidado, planQuery.data, consolidadoQuery.data]);

  // Copia editable local
  const [filas, setFilas] = useState<PlanFila[]>([]);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (planServidor) {
      setFilas(JSON.parse(JSON.stringify(planServidor.filas)));
      setDirty(false);
    }
  }, [planServidor]);

  const guardar = useMutation({
    mutationFn: () => {
      const segmentos = filas.flatMap((f) => f.segmentos.map((s, i) => ({ etapaCode: f.code, segmento: i, inicio: s.inicio, dias: s.dias })));
      return api.post<Plan>(`/presupuestos/${budgetSel}/plan`, { segmentos });
    },
    onSuccess: () => { setDirty(false); qc.invalidateQueries({ queryKey: ['plan', budgetSel] }); },
  });
  const restablecer = useMutation({
    mutationFn: () => api.post<Plan>(`/presupuestos/${budgetSel}/plan`, { segmentos: [] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan', budgetSel] }),
  });

  // ── Calendario ──
  const fechaInicio = useMemo(
    () => normalizarInicio(planServidor?.fechaInicio ? new Date(planServidor.fechaInicio) : new Date()),
    [planServidor?.fechaInicio],
  );

  const totalHabiles = useMemo(() => {
    let max = 10;
    for (const f of filas) for (const s of f.segmentos) max = Math.max(max, s.inicio + s.dias);
    return max + 3;
  }, [filas]);

  // Mapa día hábil → índice de día calendario, y lista de días calendario
  const { calDias, habilACal } = useMemo(() => {
    const calDias: { fecha: Date; finde: boolean }[] = [];
    const habilACal: number[] = [];
    const d = new Date(fechaInicio);
    let habiles = 0;
    while (habiles < totalHabiles) {
      const finde = d.getDay() === 0 || d.getDay() === 6;
      calDias.push({ fecha: new Date(d), finde });
      if (!finde) { habilACal.push(calDias.length - 1); habiles++; }
      d.setDate(d.getDate() + 1);
    }
    // completar la última semana hasta el domingo
    while (calDias[calDias.length - 1].fecha.getDay() !== 0) {
      const last = new Date(calDias[calDias.length - 1].fecha);
      last.setDate(last.getDate() + 1);
      calDias.push({ fecha: last, finde: last.getDay() === 0 || last.getDay() === 6 });
    }
    return { calDias, habilACal };
  }, [fechaInicio, totalHabiles]);

  // Meses para el header
  const meses = useMemo(() => {
    const out: { label: string; span: number }[] = [];
    for (const cd of calDias) {
      const label = cd.fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      if (out.length && out[out.length - 1].label === label) out[out.length - 1].span++;
      else out.push({ label, span: 1 });
    }
    return out;
  }, [calDias]);

  // Piezas de barra: tramos de días hábiles consecutivos en el calendario (se cortan en el finde)
  function piezas(seg: Segmento): { calStart: number; calLen: number; habilesEnPieza: number[] }[] {
    const out: { calStart: number; calLen: number; habilesEnPieza: number[] }[] = [];
    for (let b = seg.inicio; b < seg.inicio + seg.dias && b < habilACal.length; b++) {
      const cal = habilACal[b];
      const prev = out[out.length - 1];
      if (prev && prev.calStart + prev.calLen === cal) { prev.calLen++; prev.habilesEnPieza.push(b); }
      else out.push({ calStart: cal, calLen: 1, habilesEnPieza: [b] });
    }
    return out;
  }

  const editar = (filaIdx: number, segIdx: number, campo: 'inicio' | 'dias', valor: number) => {
    setFilas((fs) => {
      const copia = [...fs];
      const f = { ...copia[filaIdx], segmentos: [...copia[filaIdx].segmentos] };
      const s = { ...f.segmentos[segIdx] };
      if (campo === 'inicio') s.inicio = Math.max(0, Math.round(valor - 1)); // UI es 1-based
      else s.dias = Math.max(1, Math.round(valor));
      f.segmentos[segIdx] = s;
      copia[filaIdx] = f;
      return copia;
    });
    setDirty(true);
  };

  const partir = (filaIdx: number, segIdx: number) => {
    setFilas((fs) => {
      const copia = [...fs];
      const f = { ...copia[filaIdx], segmentos: [...copia[filaIdx].segmentos] };
      const s = f.segmentos[segIdx];
      if (s.dias < 2) return fs;
      const d1 = Math.ceil(s.dias / 2);
      const d2 = s.dias - d1;
      f.segmentos.splice(segIdx, 1,
        { ...s, dias: d1 },
        { segmento: 0, inicio: s.inicio + d1 + 5, dias: d2 }, // el 2º tramo arranca una semana hábil después
      );
      copia[filaIdx] = f;
      return copia;
    });
    setDirty(true);
  };

  const quitarSegmento = (filaIdx: number, segIdx: number) => {
    setFilas((fs) => {
      const copia = [...fs];
      const f = { ...copia[filaIdx], segmentos: [...copia[filaIdx].segmentos] };
      if (f.segmentos.length <= 1) return fs;
      f.segmentos.splice(segIdx, 1);
      copia[filaIdx] = f;
      return copia;
    });
    setDirty(true);
  };

  const finObra = useMemo(() => {
    let maxCal = 0;
    for (const f of filas) for (const s of f.segmentos) {
      const b = Math.min(s.inicio + s.dias - 1, habilACal.length - 1);
      if (b >= 0) maxCal = Math.max(maxCal, habilACal[b] ?? 0);
    }
    return calDias[maxCal]?.fecha;
  }, [filas, habilACal, calDias]);

  if (!isConsolidado && planQuery.isLoading) return <p style={{ color: 'var(--muted)' }}>Cargando planificación…</p>;
  if (isConsolidado && consolidadoQuery.isLoading) return <p style={{ color: 'var(--muted)' }}>Cargando planificación…</p>;

  const chartW = calDias.length * DAY_W;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="section-label">Planificación · días hábiles (L a V)</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginTop: 4 }}>
            Inicio: <strong>{fechaInicio.toLocaleDateString('es-AR')}</strong>
            {finObra && <> · Fin estimado: <strong>{finObra.toLocaleDateString('es-AR')}</strong></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink2)' }}>
            <span style={{ width: 14, height: 10, background: 'var(--greenSoft)', border: '1px solid var(--green)', borderRadius: 3, display: 'inline-block' }} /> Planificado
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink2)' }}>
            <span style={{ width: 14, height: 10, background: '#3b6ea5', borderRadius: 3, display: 'inline-block' }} /> Certificado
          </span>
          {!isConsolidado && (
            <>
              <button onClick={() => restablecer.mutate()} disabled={restablecer.isPending} style={ghostBtn}>Restablecer</button>
              <button onClick={() => guardar.mutate()} disabled={!dirty || guardar.isPending} style={{ ...saveBtn, opacity: dirty ? 1 : 0.5 }}>
                {guardar.isPending ? 'Guardando…' : '✓ Guardar plan'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Gantt */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 260 + chartW }}>
            {/* Header meses */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--lineSoft)' }}>
              <div style={{ width: 260, flex: 'none' }} />
              <div style={{ display: 'flex' }}>
                {meses.map((m, i) => (
                  <div key={i} style={{ width: m.span * DAY_W, fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '4px 0 2px 4px', borderLeft: i > 0 ? '1px solid var(--lineSoft)' : 'none', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
            {/* Header días */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 260, flex: 'none', fontSize: 11, color: 'var(--muted)', padding: '3px 12px' }}>Rubro</div>
              <div style={{ display: 'flex' }}>
                {calDias.map((cd, i) => (
                  <div key={i} style={{ width: DAY_W, textAlign: 'center', fontSize: 8.5, color: cd.finde ? 'var(--line)' : 'var(--muted)', background: cd.finde ? 'var(--surf2)' : 'transparent', padding: '2px 0' }}>
                    {DIAS_LABEL[cd.fecha.getDay()]}<br />{cd.fecha.getDate()}
                  </div>
                ))}
              </div>
            </div>

            {/* Filas */}
            {filas.map((fila, fi) => {
              const totalDias = fila.segmentos.reduce((s, x) => s + x.dias, 0);
              const diasCert = Math.round((totalDias * fila.avancePct) / 100);
              let certRestantes = diasCert;
              return (
                <div key={fila.code} style={{ display: 'flex', borderTop: '1px solid var(--lineSoft)', alignItems: 'stretch' }}>
                  {/* Etiqueta + edición */}
                  <div style={{ width: 260, flex: 'none', padding: '8px 12px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{fila.code} · {fila.nombre}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{fila.diasPresupuesto} días según presupuesto · avance {fila.avancePct}%</div>
                    {!isConsolidado && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 5 }}>
                        {fila.segmentos.map((s, si) => (
                          <div key={si} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10.5, color: 'var(--ink2)' }}>
                            {fila.segmentos.length > 1 && <span style={{ color: 'var(--muted)' }}>T{si + 1}</span>}
                            <span>día</span>
                            <input type="number" min={1} value={s.inicio + 1} onChange={(e) => editar(fi, si, 'inicio', parseInt(e.target.value) || 1)} style={miniInput} />
                            <span>×</span>
                            <input type="number" min={1} value={s.dias} onChange={(e) => editar(fi, si, 'dias', parseInt(e.target.value) || 1)} style={miniInput} />
                            <span>días</span>
                            <button title="Partir en dos tramos" onClick={() => partir(fi, si)} style={microBtn}>✂</button>
                            {fila.segmentos.length > 1 && (
                              <button title="Quitar tramo" onClick={() => quitarSegmento(fi, si)} style={{ ...microBtn, color: 'var(--bad)' }}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Barras */}
                  <div style={{ position: 'relative', height: 'auto', minHeight: 40, flex: 'none', width: chartW }}>
                    {/* fondo: columnas de finde */}
                    {calDias.map((cd, i) => cd.finde ? (
                      <div key={i} style={{ position: 'absolute', left: i * DAY_W, top: 0, bottom: 0, width: DAY_W, background: 'var(--surf2)' }} />
                    ) : null)}
                    {/* piezas de barra (cortadas en los findes) */}
                    {fila.segmentos.map((s, si) =>
                      piezas(s).map((p, pi) => {
                        const certEnPieza = Math.min(certRestantes, p.habilesEnPieza.length);
                        certRestantes -= certEnPieza;
                        return (
                          <div key={`${si}-${pi}`} style={{
                            position: 'absolute',
                            left: p.calStart * DAY_W + 1,
                            width: p.calLen * DAY_W - 2,
                            top: 10,
                            height: 20,
                            background: 'var(--greenSoft)',
                            border: '1px solid var(--green)',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}>
                            {certEnPieza > 0 && (
                              <div style={{ height: '100%', width: `${(certEnPieza / p.habilesEnPieza.length) * 100}%`, background: '#3b6ea5', opacity: 0.85 }} />
                            )}
                          </div>
                        );
                      }),
                    )}
                  </div>
                </div>
              );
            })}

            {filas.length === 0 && (
              <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>
                Sin rubros con cantidades cargadas. Completá el presupuesto para generar la planificación.
              </div>
            )}
          </div>
        </div>
      </div>

      {!isConsolidado && (
        <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
          Los días se cuentan en <strong>días hábiles</strong> (sábados y domingos aparecen en gris y no consumen plazo).
          Podés ajustar el inicio y la duración de cada rubro (ej. si se suma más gente, bajás los días), o <strong>✂ partir</strong> un rubro
          en dos tramos si la obra se hace por etapas. La barra azul muestra el avance certificado.
        </p>
      )}
    </div>
  );
}

const miniInput: React.CSSProperties = { width: 40, textAlign: 'right', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 10.5 };
const microBtn: React.CSSProperties = { fontSize: 10, padding: '1px 5px', borderRadius: 4, border: '1px solid var(--line)', background: 'var(--surf)', color: 'var(--ink2)', cursor: 'pointer', lineHeight: 1.4 };
const ghostBtn: React.CSSProperties = { fontSize: 11.5, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink2)', cursor: 'pointer' };
const saveBtn: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--green)', color: '#fff', cursor: 'pointer' };
