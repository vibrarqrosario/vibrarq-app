import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, downloadFile, postForm } from '../lib/api';
import { money } from '../lib/format';

type Resumen = {
  saldoCaja: number;
  porCobrar: number;
  porPagar: number;
  vencido: number;
  proyeccion: { mes: string; ingresos: number; egresos: number; saldo: number }[];
};

type CuentaCobrar = { id: string; monto: number; vencimiento: string; estado: string; obra: { nombre: string } };
type CuentaPagar = { id: string; proveedor: string; monto: number; vencimiento: string; estado: string };
type Gasto = {
  id: string; concepto: string; monto: number; fecha: string; facturaMime: string | null;
  obra: { id: string; nombre: string; cliente: { nombre: string } } | null;
};
type PagoMov = {
  id: string; monto: number; fecha: string; medio: string | null; nota: string | null;
  obra: { id: string; nombre: string; cliente: { nombre: string } };
  certificado: { numero: number } | null;
};
type GrupoObras = { id: string; nombre: string; obras: { id: string; nombre: string }[] };

export function CobranzasFlujo() {
  const qc = useQueryClient();
  const [showGasto, setShowGasto] = useState(false);
  const [gasto, setGasto] = useState({ concepto: '', monto: '', obraId: '', fecha: '' });
  const [gastoError, setGastoError] = useState<string | null>(null);
  const facturaRef = useRef<HTMLInputElement>(null);

  const { data: resumen, isLoading } = useQuery({ queryKey: ['finanzas', 'resumen'], queryFn: () => api.get<Resumen>('/finanzas/resumen') });
  const { data: cobrar } = useQuery({ queryKey: ['finanzas', 'cobrar'], queryFn: () => api.get<CuentaCobrar[]>('/finanzas/cuentas-cobrar') });
  const { data: pagar } = useQuery({ queryKey: ['finanzas', 'pagar'], queryFn: () => api.get<CuentaPagar[]>('/finanzas/cuentas-pagar') });
  const { data: gastos } = useQuery({ queryKey: ['finanzas', 'gastos'], queryFn: () => api.get<Gasto[]>('/finanzas/gastos') });
  const { data: pagos } = useQuery({ queryKey: ['finanzas', 'pagos'], queryFn: () => api.get<PagoMov[]>('/finanzas/pagos') });
  const { data: grupos } = useQuery({ queryKey: ['obras'], queryFn: () => api.get<GrupoObras[]>('/obras') });

  const crearGasto = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('concepto', gasto.concepto);
      form.append('monto', gasto.monto);
      if (gasto.obraId) form.append('obraId', gasto.obraId);
      if (gasto.fecha) form.append('fecha', gasto.fecha);
      const file = facturaRef.current?.files?.[0];
      if (file) form.append('factura', file);
      return postForm('/finanzas/gastos', form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finanzas'] });
      qc.invalidateQueries({ queryKey: ['analitica'] });
      setShowGasto(false);
      setGasto({ concepto: '', monto: '', obraId: '', fecha: '' });
      setGastoError(null);
      if (facturaRef.current) facturaRef.current.value = '';
    },
    onError: (e: Error) => setGastoError(e.message),
  });

  const eliminarGasto = useMutation({
    mutationFn: (id: string) => api.delete(`/finanzas/gastos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finanzas'] });
      qc.invalidateQueries({ queryKey: ['analitica'] });
    },
  });

  if (isLoading || !resumen) return <p style={{ color: 'var(--muted)' }}>Cargando…</p>;

  const kpis = [
    { label: 'Saldo en caja', value: money(resumen.saldoCaja) },
    { label: 'Por cobrar', value: money(resumen.porCobrar) },
    { label: 'Por pagar', value: money(resumen.porPagar) },
    { label: 'Vencido', value: money(resumen.vencido), warn: resumen.vencido > 0 },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="section-label">Finanzas</div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Cobranzas y Flujo</h1>
        </div>
        <button onClick={() => setShowGasto((v) => !v)} style={btnPrimary}>+ Cargar gasto</button>
      </div>

      {/* Form de gasto */}
      {showGasto && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 20, background: 'var(--surf)' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Nuevo gasto</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="¿Qué es el gasto? (concepto)"
              value={gasto.concepto}
              onChange={(e) => setGasto((g) => ({ ...g, concepto: e.target.value }))}
              style={{ ...inputStyle, flex: 2, minWidth: 200 }}
            />
            <input
              type="number" min={0} placeholder="Monto"
              value={gasto.monto}
              onChange={(e) => setGasto((g) => ({ ...g, monto: e.target.value }))}
              style={{ ...inputStyle, width: 130 }}
            />
            <select value={gasto.obraId} onChange={(e) => setGasto((g) => ({ ...g, obraId: e.target.value }))} style={{ ...inputStyle, minWidth: 220 }}>
              <option value="">Gastos generales estudio</option>
              {(grupos ?? []).map((gr) => (
                <optgroup key={gr.id} label={gr.nombre}>
                  {gr.obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </optgroup>
              ))}
            </select>
            <input
              type="date"
              value={gasto.fecha}
              onChange={(e) => setGasto((g) => ({ ...g, fecha: e.target.value }))}
              style={inputStyle}
              title="Fecha del gasto (vacío = hoy)"
            />
            <label style={{ fontSize: 12, color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              📎 Factura:
              <input ref={facturaRef} type="file" accept="image/*,.pdf" style={{ fontSize: 11.5 }} />
            </label>
            <button
              onClick={() => crearGasto.mutate()}
              disabled={!gasto.concepto.trim() || !(parseFloat(gasto.monto) > 0) || crearGasto.isPending}
              style={btnPrimary}
            >
              {crearGasto.isPending ? 'Guardando…' : 'Guardar gasto'}
            </button>
          </div>
          {gastoError && <div style={{ color: 'var(--bad)', fontSize: 12.5, marginTop: 8 }}>{gastoError}</div>}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            Sin obra seleccionada, el gasto queda como <strong>general del estudio</strong>. La factura acepta imagen o PDF (máx. 5 MB).
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={kpiStyle}>
            <div className="section-label">{k.label}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700, marginTop: 6, color: k.warn ? 'var(--bad)' : 'var(--ink)' }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>
          Flujo de caja proyectado · 6 meses
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={resumen.proyeccion}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--lineSoft)" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => money(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ingresos" fill="var(--good)" name="Ingresos" />
            <Bar dataKey="egresos" fill="var(--bad)" name="Egresos" />
            <Line type="monotone" dataKey="saldo" stroke="var(--green)" name="Saldo" strokeWidth={2} dot={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Cuentas por cobrar (clientes)
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {(cobrar ?? []).map((c) => (
              <div key={c.id} style={rowStyle}>
                <span>{c.obra.nombre}</span>
                <span>{money(c.monto)}</span>
                <span style={{ color: estadoColor(c.estado) }}>{c.estado}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Cuentas por pagar (proveedores)
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {(pagar ?? []).map((c) => (
              <div key={c.id} style={rowStyle}>
                <span>{c.proveedor}</span>
                <span>{money(c.monto)}</span>
                <span style={{ color: estadoColor(c.estado) }}>{c.estado}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Movimientos: pagos recibidos + gastos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Pagos recibidos
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {(pagos ?? []).map((p) => (
              <div key={p.id} style={movRowStyle}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{p.obra.cliente.nombre} · {p.obra.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {new Date(p.fecha).toLocaleDateString('es-AR')}
                    {p.certificado != null && <> · Cert. N° {p.certificado.numero}</>}
                    {p.medio && <> · {p.medio}</>}
                    {p.nota && <> · {p.nota}</>}
                  </div>
                </div>
                <span style={{ color: 'var(--good)', fontWeight: 700, fontSize: 13 }}>+{money(p.monto)}</span>
              </div>
            ))}
            {(pagos?.length ?? 0) === 0 && <div style={{ padding: 14, fontSize: 12.5, color: 'var(--muted)' }}>Sin pagos registrados. Se cargan desde la pestaña Certificados de cada obra.</div>}
            {(pagos?.length ?? 0) > 0 && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700, textAlign: 'right', color: 'var(--good)' }}>
                Total: {money(pagos!.reduce((s, p) => s + p.monto, 0))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Gastos
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {(gastos ?? []).map((g) => (
              <div key={g.id} style={movRowStyle}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{g.concepto}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {new Date(g.fecha).toLocaleDateString('es-AR')} ·{' '}
                    {g.obra ? `${g.obra.cliente.nombre} · ${g.obra.nombre}` : 'Gastos generales estudio'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {g.facturaMime && (
                    <button onClick={() => downloadFile(`/finanzas/gastos/${g.id}/factura`)} title="Ver factura" style={facturaBtn}>
                      📎 factura
                    </button>
                  )}
                  <span style={{ color: 'var(--bad)', fontWeight: 700, fontSize: 13 }}>−{money(g.monto)}</span>
                  <button onClick={() => eliminarGasto.mutate(g.id)} title="Eliminar gasto" style={{ fontSize: 12, color: 'var(--bad)', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ))}
            {(gastos?.length ?? 0) === 0 && <div style={{ padding: 14, fontSize: 12.5, color: 'var(--muted)' }}>Sin gastos cargados.</div>}
            {(gastos?.length ?? 0) > 0 && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700, textAlign: 'right', color: 'var(--bad)' }}>
                Total: {money(gastos!.reduce((s, g) => s + g.monto, 0))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function estadoColor(estado: string) {
  if (estado === 'PAGADO') return 'var(--good)';
  if (estado === 'VENCIDO') return 'var(--bad)';
  return 'var(--warn)';
}

const kpiStyle: React.CSSProperties = { padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surf)' };
const btnPrimary: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--green)', border: 'none', borderRadius: 7, padding: '9px 16px', cursor: 'pointer' };
const inputStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 };
const movRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--lineSoft)' };
const facturaBtn: React.CSSProperties = { fontSize: 11, color: 'var(--green)', border: '1px solid var(--line)', borderRadius: 5, padding: '3px 8px', background: 'var(--surf)', cursor: 'pointer' };
const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 1fr 90px',
  gap: 10,
  padding: '10px 14px',
  fontSize: 12.5,
  borderTop: '1px solid var(--lineSoft)',
};
