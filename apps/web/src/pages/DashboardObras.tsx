import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, ApiError } from '../lib/api';
import { money } from '../lib/format';
import type { ClienteConObras } from '../types/obras';
import { useAuth } from '../auth/AuthContext';

type Analitica = {
  kpis: { obrasActivas: number; obrasTotales: number; saldoCaja: number; porCobrar: number; porPagar: number; alertas: number; certificadosAEmitir: number };
  obras: { id: string; margenObjetivoPct: number }[];
  alertas: { obraId: string; obra: string; tipo: 'RETRASO' | 'MARGEN' | 'COBRANZA'; detalle: string }[];
  financiero: { ventaTotal: number; costoTotal: number; margenBruto: number };
  distribucion: { materiales: number; manoObra: number; materialesPct: number; manoObraPct: number };
  certificadosPorMes: { mes: string; monto: number }[];
};

const ESTADO_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  SIN_CONTRATAR: { label: 'Cotización', color: 'var(--muted)', bg: 'var(--surf2)' },
  INICIO: { label: 'Inicio', color: '#3b6ea5', bg: '#3b6ea518' },
  EJECUCION: { label: 'En ejecución', color: 'var(--green)', bg: 'var(--greenSoft)' },
  FINALIZADA: { label: 'Finalizada', color: 'var(--muted)', bg: 'var(--surf2)' },
};

const CONSEJO: Record<string, { titulo: (obra: string) => string; accion: string }> = {
  RETRASO: { titulo: (o) => `${o} · atraso de cronograma`, accion: 'Reprogramar →' },
  MARGEN: { titulo: (o) => `${o} · margen en riesgo`, accion: 'Abrir presupuesto →' },
  COBRANZA: { titulo: (o) => `${o} · cobranza pendiente`, accion: 'Ver certificados →' },
};

export function DashboardObras() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const esSocio = user?.role === 'SOCIO';
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ clienteId: '', clienteNuevo: '', nombre: '', ubicacion: '', tipo: '', m2: '', plantas: '1' });

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['obras'],
    queryFn: () => api.get<ClienteConObras[]>('/obras'),
  });

  const { data: analitica } = useQuery({
    queryKey: ['analitica'],
    queryFn: () => api.get<Analitica>('/finanzas/analitica'),
    enabled: esSocio,
  });

  const crearObra = useMutation({
    mutationFn: async () => {
      let clienteId = form.clienteId;
      if (!clienteId) {
        const cliente = await api.post<{ id: string }>('/clientes', { nombre: form.clienteNuevo });
        clienteId = cliente.id;
      }
      return api.post('/obras', {
        clienteId,
        nombre: form.nombre,
        ubicacion: form.ubicacion || undefined,
        tipo: form.tipo || undefined,
        m2: form.m2 ? Number(form.m2) : undefined,
        plantas: form.plantas ? Number(form.plantas) : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obras'] });
      setShowForm(false);
      setForm({ clienteId: '', clienteNuevo: '', nombre: '', ubicacion: '', tipo: '', m2: '', plantas: '1' });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudo crear la obra'),
  });

  if (isLoading) return <p style={{ color: 'var(--muted)' }}>Cargando…</p>;
  if (loadError || !data) return <p style={{ color: 'var(--bad)' }}>No se pudo cargar el dashboard.</p>;

  const todasLasObras = data.flatMap((c) => c.obras);
  const conMonto = todasLasObras.filter((o) => o.montoVenta > 0);
  const activas = conMonto.filter((o) => o.estado === 'EJECUCION' || o.estado === 'INICIO');
  const facturacionEnCurso = activas.reduce((s, o) => s + o.montoVenta, 0);
  const margenPromedio = conMonto.length ? Math.round(conMonto.reduce((s, o) => s + o.margenPct, 0) / conMonto.length) : 0;

  // Alertas por obra (del backend, comparadas contra el objetivo de cada obra)
  const alertasPorObra = new Map<string, { tipo: string; detalle: string }[]>();
  for (const a of analitica?.alertas ?? []) {
    if (!alertasPorObra.has(a.obraId)) alertasPorObra.set(a.obraId, []);
    alertasPorObra.get(a.obraId)!.push(a);
  }

  const kpis = [
    { label: 'Obras activas', value: String(activas.length), sub: `/ ${conMonto.length}` },
    { label: 'Facturación en curso', value: money(facturacionEnCurso) },
    { label: 'Margen promedio', value: `${margenPromedio}%` },
    { label: 'Obras con alerta', value: String(analitica?.kpis.alertas ?? 0), sub: 'requieren acción', warn: (analitica?.kpis.alertas ?? 0) > 0 },
    { label: 'Certificados a emitir', value: String(analitica?.kpis.certificadosAEmitir ?? 0), sub: 'este período' },
  ];

  const chartData = conMonto.map((o) => ({ nombre: o.nombre.length > 15 ? o.nombre.slice(0, 14) + '…' : o.nombre, margenPct: o.margenPct }));
  const puedeCrear = form.nombre.trim() && (form.clienteId || form.clienteNuevo.trim());

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="section-label">Cartera de obras</div>
          <h1 style={{ fontSize: 28 }}>Dashboard de Obras</h1>
        </div>
        <button onClick={() => setShowForm((v) => !v)} style={primaryBtn}>
          + Nueva obra
        </button>
      </div>

      {showForm && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 20, background: 'var(--surf)' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Nueva obra
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <select
              value={form.clienteId}
              onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value, clienteNuevo: '' }))}
              style={inputStyle}
            >
              <option value="">Cliente nuevo…</option>
              {data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {!form.clienteId && (
              <input
                placeholder="Nombre del cliente nuevo"
                value={form.clienteNuevo}
                onChange={(e) => setForm((f) => ({ ...f, clienteNuevo: e.target.value }))}
                style={inputStyle}
              />
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input placeholder="Nombre de la obra" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} style={inputStyle} />
            <input placeholder="Ubicación" value={form.ubicacion} onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))} style={inputStyle} />
            <input placeholder="Tipo (ej: Obra nueva)" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} style={inputStyle} />
            <input placeholder="m²" type="number" value={form.m2} onChange={(e) => setForm((f) => ({ ...f, m2: e.target.value }))} style={{ ...inputStyle, width: 90 }} />
            <input placeholder="Plantas" type="number" value={form.plantas} onChange={(e) => setForm((f) => ({ ...f, plantas: e.target.value }))} style={{ ...inputStyle, width: 90 }} />
            <button onClick={() => crearObra.mutate()} disabled={!puedeCrear || crearObra.isPending} style={primaryBtn}>
              Crear
            </button>
          </div>
          {error && <div style={{ color: 'var(--bad)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={kpiCardStyle}>
            <div className="section-label">{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700, color: k.warn ? 'var(--bad)' : 'var(--ink)' }}>{k.value}</span>
              {k.sub && <span style={{ fontSize: 11.5, color: k.warn ? '#d9b06a' : 'var(--muted)' }}>{k.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        {/* Columna izquierda: obras por cliente + consejos */}
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>Obras en curso · agrupadas por cliente</div>
          {data.map((cliente) => (
            <div key={cliente.id} style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '11px 16px',
                  background: 'var(--surf2)',
                  borderRadius: '12px 12px 0 0',
                  border: '1px solid var(--line)',
                  borderBottom: 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                    {cliente.nombre.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <span>
                    <strong>{cliente.nombre}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{cliente.obras.length} obra(s)</span>
                  </span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{money(cliente.carteraTotal)}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>cartera del cliente</div>
                </span>
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                {cliente.obras.map((obra) => {
                  const badge = ESTADO_BADGE[obra.estado] ?? ESTADO_BADGE.SIN_CONTRATAR;
                  const alertasObra = alertasPorObra.get(obra.id) ?? [];
                  return (
                    <Link
                      key={obra.id}
                      to={`/obras/${obra.id}`}
                      style={{ display: 'block', padding: '13px 16px', borderTop: '1px solid var(--lineSoft)', textDecoration: 'none', color: 'var(--ink)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {obra.nombre}
                            <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 999, padding: '2px 8px' }}>{badge.label}</span>
                            {obra.adicionalesCount > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', background: 'var(--greenSoft)', borderRadius: 999, padding: '2px 8px' }}>
                                +{obra.adicionalesCount} adic.
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            {[obra.ubicacion, obra.tipo, obra.m2 ? `${obra.m2} m²` : null].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flex: 'none' }}>
                          <div style={{ fontWeight: 700 }}>{money(obra.montoVenta)}</div>
                          <div style={{ fontSize: 12, color: alertasObra.some((a) => a.tipo === 'MARGEN') ? 'var(--bad)' : 'var(--good)' }}>
                            margen {obra.margenPct}%
                          </div>
                        </div>
                      </div>
                      {/* Barra de avance + etapa actual */}
                      {obra.montoVenta > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                          <div style={{ flex: 1, height: 7, background: 'var(--surf2)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${obra.avanceGlobal}%`, background: alertasObra.some((a) => a.tipo === 'RETRASO') ? '#b05a2a' : 'var(--green)', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 700, minWidth: 34, textAlign: 'right' }}>{obra.avanceGlobal}%</span>
                        </div>
                      )}
                      {obra.etapaActual && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 4 }}>→ {obra.etapaActual}</div>
                      )}
                      {obra.estado === 'FINALIZADA' && (
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>→ Entregada</div>
                      )}
                      {alertasObra.map((a, i) => (
                        <div key={i} style={{ fontSize: 11, color: a.tipo === 'MARGEN' ? 'var(--bad)' : a.tipo === 'RETRASO' ? '#b05a2a' : '#8a6d1f', marginTop: 3, fontWeight: 600 }}>
                          ⚠ {a.detalle}
                        </div>
                      ))}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Consejos de acción */}
          {esSocio && (analitica?.alertas.length ?? 0) > 0 && (
            <div style={{ marginTop: 6 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Consejos de acción</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {analitica!.alertas.map((a, i) => {
                  const c = CONSEJO[a.tipo];
                  return (
                    <Link key={i} to={`/obras/${a.obraId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surf)', textDecoration: 'none', color: 'var(--ink)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12.5 }}>{c.titulo(a.obra)}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink2)', marginTop: 2 }}>{a.detalle}</div>
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap' }}>{c.accion}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha: resumen financiero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {esSocio && analitica && (
            <div style={panelStyle}>
              <div className="section-label" style={{ marginBottom: 10 }}>Resumen financiero · cartera</div>
              {[
                ['Venta total', analitica.financiero.ventaTotal, 'var(--ink)'],
                ['Costo proveedores', analitica.financiero.costoTotal, 'var(--ink2)'],
                ['Margen bruto', analitica.financiero.margenBruto, 'var(--good)'],
              ].map(([label, monto, color]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--lineSoft)' }}>
                  <span style={{ color: 'var(--ink2)' }}>{label as string}</span>
                  <strong style={{ color: color as string }}>{money(monto as number)}</strong>
                </div>
              ))}
            </div>
          )}

          <div style={panelStyle}>
            <div className="section-label" style={{ marginBottom: 12 }}>Margen por obra</div>
            <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 34)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--lineSoft)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10.5 }} width={100} />
                <ReferenceLine x={30} stroke="var(--muted)" strokeDasharray="4 4" />
                <Bar dataKey="margenPct" radius={4}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.margenPct < 25 ? 'var(--bad)' : 'var(--green)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {esSocio && analitica && (
            <div style={panelStyle}>
              <div className="section-label" style={{ marginBottom: 12 }}>Distribución de costos</div>
              {[
                ['Materiales', analitica.distribucion.materialesPct, analitica.distribucion.materiales],
                ['Mano de obra / ejecución', analitica.distribucion.manoObraPct, analitica.distribucion.manoObra],
              ].map(([label, pct, monto]) => (
                <div key={label as string} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span>{label as string}</span>
                    <span><strong>{pct as number}%</strong> <span style={{ color: 'var(--muted)' }}>· {money(monto as number)}</span></span>
                  </div>
                  <div style={{ height: 8, background: 'var(--surf2)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--green)', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {esSocio && analitica && (
            <div style={panelStyle}>
              <div className="section-label" style={{ marginBottom: 12 }}>Certificado mensual · últimos 6 meses</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={analitica.certificadosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--lineSoft)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10.5 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 10 }} width={44} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Bar dataKey="monto" fill="var(--green)" name="Certificado" radius={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const kpiCardStyle: React.CSSProperties = {
  padding: '13px 15px',
  borderRadius: 12,
  border: '1px solid var(--line)',
  background: 'var(--surf)',
};

const panelStyle: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 12, padding: 16, background: 'var(--surf)' };
const primaryBtn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--green)', border: 'none', borderRadius: 7, padding: '9px 14px', cursor: 'pointer' };
const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 };
