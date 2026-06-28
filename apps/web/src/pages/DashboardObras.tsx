import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { api, ApiError } from '../lib/api';
import { money } from '../lib/format';
import type { ClienteConObras } from '../types/obras';

const MARGEN_OBJETIVO = 32;

export function DashboardObras() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ clienteId: '', clienteNuevo: '', nombre: '', ubicacion: '', tipo: '', m2: '', plantas: '1' });

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['obras'],
    queryFn: () => api.get<ClienteConObras[]>('/obras'),
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
  const facturacionEnCurso = todasLasObras.reduce((s, o) => s + o.montoVenta, 0);
  const margenPromedio = todasLasObras.length
    ? Math.round(todasLasObras.reduce((s, o) => s + o.margenPct, 0) / todasLasObras.length)
    : 0;
  const obrasConAlerta = todasLasObras.filter((o) => o.margenPct < MARGEN_OBJETIVO).length;

  const kpis = [
    { label: 'Obras activas', value: String(todasLasObras.length) },
    { label: 'Facturación en curso', value: money(facturacionEnCurso) },
    { label: 'Margen promedio', value: `${margenPromedio}%` },
    { label: 'Obras con alerta', value: String(obrasConAlerta) },
  ];

  const chartData = todasLasObras.map((o) => ({ nombre: o.nombre, margenPct: o.margenPct }));

  const puedeCrear = form.nombre.trim() && (form.clienteId || form.clienteNuevo.trim());

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="section-label">Cartera</div>
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
            <input placeholder="Tipo (ej: Vivienda unifamiliar)" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} style={inputStyle} />
            <input placeholder="m²" type="number" value={form.m2} onChange={(e) => setForm((f) => ({ ...f, m2: e.target.value }))} style={{ ...inputStyle, width: 90 }} />
            <input placeholder="Plantas" type="number" value={form.plantas} onChange={(e) => setForm((f) => ({ ...f, plantas: e.target.value }))} style={{ ...inputStyle, width: 90 }} />
            <button onClick={() => crearObra.mutate()} disabled={!puedeCrear || crearObra.isPending} style={primaryBtn}>
              Crear
            </button>
          </div>
          {error && <div style={{ color: 'var(--bad)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} style={kpiCardStyle}>
            <div className="section-label">{k.label}</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, marginTop: 6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div>
          {data.map((cliente) => (
            <div key={cliente.id} style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--surf2)',
                  borderRadius: '12px 12px 0 0',
                  borderTop: '1px solid var(--line)',
                  borderLeft: '1px solid var(--line)',
                  borderRight: '1px solid var(--line)',
                }}
              >
                <strong>{cliente.nombre}</strong>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {cliente.obras.length} obra(s) · {money(cliente.carteraTotal)}
                </span>
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                {cliente.obras.map((obra) => (
                  <Link
                    key={obra.id}
                    to={`/obras/${obra.id}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 16px',
                      borderTop: '1px solid var(--lineSoft)',
                      textDecoration: 'none',
                      color: 'var(--ink)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {obra.nombre}
                        {obra.adicionalesCount > 0 && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--green)',
                              background: 'var(--greenSoft)',
                              borderRadius: 999,
                              padding: '2px 8px',
                            }}
                          >
                            +{obra.adicionalesCount} adic.
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                        {obra.ubicacion} · {obra.tipo} · {obra.m2} m²
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>{money(obra.montoVenta)}</div>
                      <div style={{ fontSize: 12.5, color: obra.margenPct < MARGEN_OBJETIVO ? 'var(--bad)' : 'var(--good)' }}>
                        margen {obra.margenPct}%
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            Margen por obra vs. objetivo {MARGEN_OBJETIVO}%
          </div>
          <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 36)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--lineSoft)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11 }} width={100} />
              <ReferenceLine x={MARGEN_OBJETIVO} stroke="var(--muted)" strokeDasharray="4 4" />
              <Bar dataKey="margenPct" radius={4}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.margenPct < MARGEN_OBJETIVO ? 'var(--bad)' : 'var(--green)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const kpiCardStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid var(--line)',
  background: 'var(--surf)',
};

const primaryBtn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--green)', border: 'none', borderRadius: 7, padding: '9px 14px', cursor: 'pointer' };
const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 };
