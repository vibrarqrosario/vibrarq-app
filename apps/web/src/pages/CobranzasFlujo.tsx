import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
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

export function CobranzasFlujo() {
  const { data: resumen, isLoading } = useQuery({ queryKey: ['finanzas', 'resumen'], queryFn: () => api.get<Resumen>('/finanzas/resumen') });
  const { data: cobrar } = useQuery({ queryKey: ['finanzas', 'cobrar'], queryFn: () => api.get<CuentaCobrar[]>('/finanzas/cuentas-cobrar') });
  const { data: pagar } = useQuery({ queryKey: ['finanzas', 'pagar'], queryFn: () => api.get<CuentaPagar[]>('/finanzas/cuentas-pagar') });

  if (isLoading || !resumen) return <p style={{ color: 'var(--muted)' }}>Cargando…</p>;

  const kpis = [
    { label: 'Saldo en caja', value: money(resumen.saldoCaja) },
    { label: 'Por cobrar', value: money(resumen.porCobrar) },
    { label: 'Por pagar', value: money(resumen.porPagar) },
    { label: 'Vencido', value: money(resumen.vencido), warn: resumen.vencido > 0 },
  ];

  return (
    <div>
      <div className="section-label">Finanzas</div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Cobranzas y Flujo</h1>

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
    </div>
  );
}

function estadoColor(estado: string) {
  if (estado === 'PAGADO') return 'var(--good)';
  if (estado === 'VENCIDO') return 'var(--bad)';
  return 'var(--warn)';
}

const kpiStyle: React.CSSProperties = { padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surf)' };
const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 1fr 90px',
  gap: 10,
  padding: '10px 14px',
  fontSize: 12.5,
  borderTop: '1px solid var(--lineSoft)',
};
