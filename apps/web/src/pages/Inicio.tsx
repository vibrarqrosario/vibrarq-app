import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, downloadFile } from '../lib/api';
import { money } from '../lib/format';
import { useAuth } from '../auth/AuthContext';

type Analitica = {
  kpis: { obrasActivas: number; saldoCaja: number; porCobrar: number; porPagar: number; alertas: number };
  obras: { id: string; nombre: string; cliente: string; avance: number; esperado: number | null; venta: number; margenPct: number }[];
  alertas: { obraId: string; obra: string; tipo: 'RETRASO' | 'MARGEN' | 'COBRANZA'; detalle: string }[];
  presupuestos: { anio: number; enviados: number; aceptados: number; porMes: { mes: string; enviados: number; aceptados: number }[] };
  cobradoAnio: number;
  gastadoAnio: number;
};

const ALERTA_STYLE: Record<string, { color: string; label: string; icon: string }> = {
  RETRASO: { color: '#b05a2a', label: 'Retraso', icon: '⏱' },
  MARGEN: { color: 'var(--bad)', label: 'Margen bajo', icon: '▼' },
  COBRANZA: { color: '#8a6d1f', label: 'Cobranza', icon: '$' },
};

export function Inicio() {
  const { user } = useAuth();
  const esSocio = user?.role === 'SOCIO';

  const { data, isLoading } = useQuery({
    queryKey: ['analitica'],
    queryFn: () => api.get<Analitica>('/finanzas/analitica'),
    enabled: esSocio,
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <div>
          <div className="section-label">Bienvenido</div>
          <h1 style={{ fontSize: 30, margin: '4px 0 0' }}>{user?.nombre}</h1>
        </div>
        {esSocio && (
          <button
            onClick={() => downloadFile('/finanzas/resumen-estado/pdf', `Resumen-estado-${new Date().toISOString().slice(0, 10)}.pdf`)}
            style={pdfBtn}
          >
            ⬇ Resumen de estado (PDF)
          </button>
        )}
      </div>

      {!esSocio && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Link to="/obras" style={cardStyle}>Dashboard de Obras</Link>
          <Link to="/planner" style={cardStyle}>Planner de Redes</Link>
          <Link to="/agenda" style={cardStyle}>Agenda Colaborativa</Link>
        </div>
      )}

      {esSocio && isLoading && <p style={{ color: 'var(--muted)' }}>Cargando indicadores…</p>}

      {esSocio && data && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
            <Kpi label="Obras activas" value={String(data.kpis.obrasActivas)} />
            <Kpi label="Dinero en caja" value={money(data.kpis.saldoCaja)} />
            <Kpi label="Por cobrar" value={money(data.kpis.porCobrar)} />
            <Kpi label="Por pagar" value={money(data.kpis.porPagar)} />
            <Kpi label="Alertas" value={String(data.kpis.alertas)} warn={data.kpis.alertas > 0} />
          </div>

          {/* Alertas */}
          {data.alertas.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Alertas · requieren acción</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.alertas.map((a, i) => {
                  const st = ALERTA_STYLE[a.tipo];
                  return (
                    <Link key={i} to={`/obras/${a.obraId}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10, border: `1px solid ${st.color}44`, background: 'var(--surf)', textDecoration: 'none', color: 'var(--ink)' }}>
                      <span style={{ color: st.color, fontWeight: 700, fontSize: 11, minWidth: 86 }}>{st.icon} {st.label}</span>
                      <span style={{ fontSize: 12.5 }}><strong>{a.obra}</strong> — {a.detalle}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 22 }}>
            {/* Avance de obras */}
            <div style={panelStyle}>
              <div className="section-label" style={{ marginBottom: 12 }}>Avance de obras · real vs esperado</div>
              {data.obras.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sin obras con presupuesto contratado.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.obras.map((o) => (
                  <Link key={o.id} to={`/obras/${o.id}`} style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                      <span><strong>{o.nombre}</strong> <span style={{ color: 'var(--muted)' }}>· {o.cliente}</span></span>
                      <span>
                        {o.avance}%
                        {o.esperado != null && <span style={{ color: o.avance < o.esperado - 15 ? 'var(--bad)' : 'var(--muted)', fontSize: 11 }}> / esp. {o.esperado}%</span>}
                        <span style={{ marginLeft: 8, color: o.margenPct < 25 ? 'var(--bad)' : 'var(--good)', fontSize: 11 }}>mg {o.margenPct}%</span>
                      </span>
                    </div>
                    <div style={{ position: 'relative', height: 10, background: 'var(--surf2)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${o.avance}%`, background: o.esperado != null && o.avance < o.esperado - 15 ? '#b05a2a' : 'var(--green)', borderRadius: 5 }} />
                      {o.esperado != null && (
                        <div style={{ position: 'absolute', left: `${o.esperado}%`, top: -1, bottom: -1, width: 2, background: 'var(--ink)', opacity: 0.55 }} title={`Esperado: ${o.esperado}%`} />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Presupuestos del año */}
            <div style={panelStyle}>
              <div className="section-label" style={{ marginBottom: 4 }}>Presupuestos {data.presupuestos.anio}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink2)', marginBottom: 10 }}>
                {data.presupuestos.enviados} enviados · {data.presupuestos.aceptados} aceptados ·{' '}
                <strong>{data.presupuestos.enviados > 0 ? Math.round((data.presupuestos.aceptados / data.presupuestos.enviados) * 100) : 0}% de aceptación</strong>
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={data.presupuestos.porMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--lineSoft)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10.5 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10.5 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11.5 }} />
                  <Bar dataKey="enviados" fill="var(--line)" name="Enviados" />
                  <Bar dataKey="aceptados" fill="var(--green)" name="Aceptados" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--lineSoft)', paddingTop: 10, marginTop: 6 }}>
                Cobrado en el año <strong style={{ color: 'var(--good)' }}>{money(data.cobradoAnio)}</strong> · Gastos{' '}
                <strong style={{ color: 'var(--bad)' }}>{money(data.gastadoAnio)}</strong>
              </div>
            </div>
          </div>

          {/* Cartera por obra */}
          {data.obras.length > 0 && (
            <div style={{ ...panelStyle, marginBottom: 22 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Cartera contratada por obra</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.obras.map((o) => ({ nombre: o.nombre.length > 16 ? o.nombre.slice(0, 15) + '…' : o.nombre, venta: o.venta, margen: o.margenPct }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--lineSoft)" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 10.5 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 10.5 }} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Bar dataKey="venta" name="Monto contratado">
                    {data.obras.map((o) => (
                      <Cell key={o.id} fill={o.margenPct < 25 ? 'var(--bad)' : 'var(--green)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>En rojo: obras con margen por debajo del 25% objetivo.</div>
            </div>
          )}

          {/* Accesos rápidos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Link to="/obras" style={cardStyle}>◫ Dashboard de Obras</Link>
            <Link to="/cobranzas" style={cardStyle}>$ Cobranzas y Flujo</Link>
            <Link to="/planner" style={cardStyle}>◉ Planner de Redes</Link>
            <Link to="/agenda" style={cardStyle}>▦ Agenda</Link>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ padding: '13px 15px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surf)' }}>
      <div className="section-label">{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700, marginTop: 5, color: warn ? 'var(--bad)' : 'var(--ink)' }}>{value}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: 'block',
  padding: 18,
  borderRadius: 14,
  border: '1px solid var(--line)',
  background: 'var(--surf)',
  color: 'var(--ink)',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: 13.5,
};

const panelStyle: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 12, padding: 16, background: 'var(--surf)' };
const pdfBtn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--green)', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer' };
