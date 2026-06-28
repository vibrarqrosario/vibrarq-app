import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';

type Post = {
  id: string;
  fecha: string;
  tipo: string;
  plataforma: string;
  estado: string;
  prioridad: string | null;
  notas: string | null;
  asignado: { nombre: string } | null;
  metricaAlcance: number | null;
  metricaEngagement: number | null;
};
type Resumen = { total: number; hoy: number; atrasadas: number; proximas: number; cargaPorPersona: { nombre: string; cantidad: number }[] };
type Columna = { estado: string; posts: Post[] };

const ESTADO_LABEL: Record<string, string> = { IDEA: 'Idea', DISENO: 'Diseño', APROBACION: 'Aprobación', PROGRAMADO: 'Programado', PUBLICADO: 'Publicado' };
const ESTADOS_ORDEN = ['IDEA', 'DISENO', 'APROBACION', 'PROGRAMADO', 'PUBLICADO'];
type Tab = 'resumen' | 'calendario' | 'tareas' | 'metricas';

export function PlannerRedes() {
  const [tab, setTab] = useState<Tab>('resumen');
  const qc = useQueryClient();
  const { data: resumen } = useQuery({ queryKey: ['planner', 'resumen'], queryFn: () => api.get<Resumen>('/planner/resumen') });
  const { data: kanban } = useQuery({ queryKey: ['planner', 'kanban'], queryFn: () => api.get<Columna[]>('/planner/kanban') });
  const { data: posts } = useQuery({ queryKey: ['planner', 'posts'], queryFn: () => api.get<Post[]>('/planner/posts') });

  const avanzarEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) => api.patch(`/planner/posts/${id}`, { estado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planner'] }),
  });

  const kpis = resumen
    ? [
        { label: 'Total de posts', value: String(resumen.total) },
        { label: 'Hoy', value: String(resumen.hoy) },
        { label: 'Atrasadas', value: String(resumen.atrasadas), warn: resumen.atrasadas > 0 },
        { label: 'Próximas', value: String(resumen.proximas) },
      ]
    : [];

  const porDia = useMemo(() => {
    const map = new Map<number, Post[]>();
    for (const p of posts ?? []) {
      const d = new Date(p.fecha).getUTCDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(p);
    }
    return map;
  }, [posts]);

  const mesRef = posts?.[0] ? new Date(posts[0].fecha) : new Date();
  const anioRef = mesRef.getUTCFullYear();
  const mesIdx = mesRef.getUTCMonth();
  const diasEnMes = new Date(anioRef, mesIdx + 1, 0).getDate();
  const primerDiaSemana = new Date(anioRef, mesIdx, 1).getDay();

  const publicados = (posts ?? []).filter((p) => p.estado === 'PUBLICADO' && p.metricaAlcance != null);
  const chartData = publicados.map((p) => ({ nombre: `${p.tipo} ${new Date(p.fecha).getUTCDate()}/${new Date(p.fecha).getUTCMonth() + 1}`, alcance: p.metricaAlcance ?? 0, engagement: p.metricaEngagement ?? 0 }));
  const mejorPost = [...publicados].sort((a, b) => (b.metricaAlcance ?? 0) - (a.metricaAlcance ?? 0))[0];

  return (
    <div>
      <div className="section-label">Marketing</div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Planner de Redes</h1>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
        {(
          [
            ['resumen', 'Resumen'],
            ['calendario', 'Calendario'],
            ['tareas', 'Tareas'],
            ['metricas', 'Métricas'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={tabBtnStyle(tab === key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div>
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
          {resumen && resumen.cargaPorPersona.length > 0 && (
            <div>
              <div className="section-label" style={{ marginBottom: 10 }}>
                Carga por persona
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {resumen.cargaPorPersona.map((c) => (
                  <div key={c.nombre} style={kpiStyle}>
                    <div style={{ fontSize: 13 }}>{c.nombre}</div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700 }}>{c.cantidad}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'calendario' && (
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            {mesRef.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {Array.from({ length: primerDiaSemana }).map((_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: diasEnMes }).map((_, i) => {
              const dia = i + 1;
              const isHoy = dia === new Date().getDate() && mesIdx === new Date().getMonth();
              return (
                <div key={dia} style={{ border: '1px solid var(--line)', borderRadius: 8, minHeight: 70, padding: 6, background: isHoy ? 'var(--greenSoft)' : 'var(--surf)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{dia}</div>
                  {(porDia.get(dia) ?? []).map((p) => (
                    <div key={p.id} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: 'var(--surf2)', marginBottom: 2 }}>
                      {p.tipo}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'tareas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {ESTADOS_ORDEN.map((estado) => {
            const columna = kanban?.find((c) => c.estado === estado);
            return (
              <div key={estado} style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surf)', minHeight: 200 }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--lineSoft)', fontSize: 12.5, fontWeight: 600 }}>
                  {ESTADO_LABEL[estado]} <span style={{ color: 'var(--muted)' }}>({columna?.posts.length ?? 0})</span>
                </div>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {columna?.posts.map((p) => {
                    const idx = ESTADOS_ORDEN.indexOf(estado);
                    const next = ESTADOS_ORDEN[idx + 1];
                    return (
                      <div key={p.id} style={{ border: '1px solid var(--lineSoft)', borderRadius: 8, padding: 10, fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{p.tipo}</div>
                        <div style={{ color: 'var(--muted)' }}>
                          {p.plataforma} · {new Date(p.fecha).toLocaleDateString('es-AR')}
                        </div>
                        {p.asignado && <div style={{ color: 'var(--muted)' }}>{p.asignado.nombre}</div>}
                        {next && (
                          <button onClick={() => avanzarEstado.mutate({ id: p.id, estado: next })} style={moveBtn}>
                            → {ESTADO_LABEL[next]}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'metricas' && (
        <div>
          {mejorPost && (
            <div style={{ ...kpiStyle, marginBottom: 20, display: 'inline-block' }}>
              <div className="section-label">Mejor publicación</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                {mejorPost.tipo} · {mejorPost.metricaAlcance?.toLocaleString('es-AR')} alcance
              </div>
            </div>
          )}
          <div className="section-label" style={{ marginBottom: 10 }}>
            Alcance y engagement por publicación
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--lineSoft)" />
              <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="alcance" fill="var(--green)" name="Alcance" />
              <Bar dataKey="engagement" fill="var(--warn)" name="Interacciones" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '11px 17px',
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    color: active ? 'var(--ink)' : 'var(--muted)',
    borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    background: 'transparent',
    cursor: 'pointer',
    marginBottom: -1,
  };
}

const kpiStyle: React.CSSProperties = { padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surf)' };
const moveBtn: React.CSSProperties = { marginTop: 8, fontSize: 11, fontWeight: 600, color: 'var(--green)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', background: 'var(--paper)', cursor: 'pointer', width: '100%' };
