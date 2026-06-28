import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

type Autor = { id: string; nombre: string };
type FeedPost = {
  id: string;
  texto: string | null;
  autor: Autor;
  obra: { nombre: string } | null;
  createdAt: string;
  likes: { usuarioId: string }[];
  comentarios: { id: string; texto: string; autor: Autor }[];
};
type Evento = { id: string; tipo: string; fecha: string; obra: { nombre: string } | null; asignados: Autor[] };
type Aviso = { id: string; texto: string; autor: Autor; createdAt: string };

export function AgendaColaborativa() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [texto, setTexto] = useState('');
  const [comentarioPorPost, setComentarioPorPost] = useState<Record<string, string>>({});

  const { data: feed } = useQuery({ queryKey: ['agenda', 'feed'], queryFn: () => api.get<FeedPost[]>('/agenda/feed') });
  const { data: eventos } = useQuery({ queryKey: ['agenda', 'eventos'], queryFn: () => api.get<Evento[]>('/agenda/eventos') });
  const { data: avisos } = useQuery({ queryKey: ['agenda', 'avisos'], queryFn: () => api.get<Aviso[]>('/agenda/avisos') });

  const crearPost = useMutation({
    mutationFn: () => api.post('/agenda/feed', { texto }),
    onSuccess: () => {
      setTexto('');
      qc.invalidateQueries({ queryKey: ['agenda', 'feed'] });
    },
  });
  const toggleLike = useMutation({
    mutationFn: (id: string) => api.post(`/agenda/feed/${id}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda', 'feed'] }),
  });
  const comentar = useMutation({
    mutationFn: ({ id, texto }: { id: string; texto: string }) => api.post(`/agenda/feed/${id}/comentarios`, { texto }),
    onSuccess: (_d, vars) => {
      setComentarioPorPost((s) => ({ ...s, [vars.id]: '' }));
      qc.invalidateQueries({ queryKey: ['agenda', 'feed'] });
    },
  });

  return (
    <div>
      <div className="section-label">Equipo</div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Agenda Colaborativa</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
        <div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 20, background: 'var(--surf)' }}>
            <textarea
              placeholder="Compartí una novedad con el equipo…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              style={{ width: '100%', minHeight: 70, padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', resize: 'vertical' }}
            />
            <button onClick={() => crearPost.mutate()} disabled={!texto.trim() || crearPost.isPending} style={{ ...btnStyle, marginTop: 8 }}>
              Publicar
            </button>
          </div>

          {(feed ?? []).map((post) => {
            const liked = !!user && post.likes.some((l) => l.usuarioId === user.id);
            return (
              <div key={post.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 14, background: 'var(--surf)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 8 }}>
                  <strong>{post.autor.nombre}</strong>
                  <span style={{ color: 'var(--muted)' }}>{new Date(post.createdAt).toLocaleString('es-AR')}</span>
                </div>
                {post.obra && <div style={{ fontSize: 11.5, color: 'var(--green)', marginBottom: 6 }}>{post.obra.nombre}</div>}
                <p style={{ fontSize: 13.5, margin: '0 0 10px' }}>{post.texto}</p>
                <button onClick={() => toggleLike.mutate(post.id)} style={{ ...likeBtn, color: liked ? 'var(--green)' : 'var(--muted)' }}>
                  ♥ {post.likes.length}
                </button>

                {post.comentarios.map((c) => (
                  <div key={c.id} style={{ fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--lineSoft)', marginTop: 8 }}>
                    <strong>{c.autor.nombre}:</strong> {c.texto}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    value={comentarioPorPost[post.id] ?? ''}
                    onChange={(e) => setComentarioPorPost((s) => ({ ...s, [post.id]: e.target.value }))}
                    placeholder="Comentar…"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 12.5 }}
                  />
                  <button
                    onClick={() => comentar.mutate({ id: post.id, texto: comentarioPorPost[post.id] ?? '' })}
                    disabled={!comentarioPorPost[post.id]?.trim()}
                    style={smallBtn}
                  >
                    Enviar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            Agenda de la semana
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            {(eventos ?? []).map((ev) => (
              <div key={ev.id} style={{ padding: '12px 14px', borderTop: '1px solid var(--lineSoft)', fontSize: 12.5 }}>
                <div style={{ fontWeight: 600 }}>{ev.tipo}</div>
                <div style={{ color: 'var(--muted)' }}>
                  {new Date(ev.fecha).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {ev.obra ? ` · ${ev.obra.nombre}` : ''}
                </div>
                {ev.asignados.length > 0 && <div style={{ color: 'var(--muted)' }}>{ev.asignados.map((a) => a.nombre).join(', ')}</div>}
              </div>
            ))}
            {eventos?.length === 0 && <div style={{ padding: 14, color: 'var(--muted)', fontSize: 12.5 }}>Sin eventos esta semana.</div>}
          </div>

          <div className="section-label" style={{ marginBottom: 10 }}>
            Avisos del estudio
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {(avisos ?? []).map((a) => (
              <div key={a.id} style={{ padding: '12px 14px', borderTop: '1px solid var(--lineSoft)', fontSize: 12.5 }}>
                <div>{a.texto}</div>
                <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                  {a.autor.nombre} · {new Date(a.createdAt).toLocaleDateString('es-AR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--green)', border: 'none', borderRadius: 7, padding: '9px 16px', cursor: 'pointer' };
const smallBtn: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--green)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 12px', background: 'var(--paper)', cursor: 'pointer' };
const likeBtn: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 };
