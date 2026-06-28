import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { ClienteConObras } from '../types/obras';

type Role = 'SOCIO' | 'COMMUNITY_MANAGER' | 'CLIENTE';
type Usuario = { id: string; email: string; nombre: string; role: Role; cliente: { nombre: string } | null; createdAt: string };

const ROLE_LABEL: Record<Role, string> = { SOCIO: 'Socio', COMMUNITY_MANAGER: 'Community Manager', CLIENTE: 'Cliente' };

export function Usuarios() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: '', password: '', nombre: '', role: 'CLIENTE' as Role, clienteId: '' });
  const [error, setError] = useState<string | null>(null);

  const { data: usuarios } = useQuery({ queryKey: ['usuarios'], queryFn: () => api.get<Usuario[]>('/usuarios') });
  const { data: clientes } = useQuery({ queryKey: ['obras'], queryFn: () => api.get<ClienteConObras[]>('/obras') });

  const crearUsuario = useMutation({
    mutationFn: () => api.post('/usuarios', { ...form, clienteId: form.role === 'CLIENTE' ? form.clienteId : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setForm({ email: '', password: '', nombre: '', role: 'CLIENTE', clienteId: '' });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudo crear el usuario'),
  });

  return (
    <div>
      <div className="section-label">Estudio</div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Usuarios</h1>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 24, background: 'var(--surf)' }}>
        <div className="section-label" style={{ marginBottom: 12 }}>
          Nuevo usuario
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} style={inputStyle} />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle} />
          <input
            placeholder="Contraseña"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            style={inputStyle}
          />
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))} style={inputStyle}>
            <option value="CLIENTE">Cliente</option>
            <option value="SOCIO">Socio</option>
            <option value="COMMUNITY_MANAGER">Community Manager</option>
          </select>
          {form.role === 'CLIENTE' && (
            <select value={form.clienteId} onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))} style={inputStyle}>
              <option value="">Elegir cliente…</option>
              {(clientes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => crearUsuario.mutate()}
            disabled={!form.nombre || !form.email || form.password.length < 6 || (form.role === 'CLIENTE' && !form.clienteId) || crearUsuario.isPending}
            style={btnStyle}
          >
            Crear
          </button>
        </div>
        {error && <div style={{ color: 'var(--bad)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={rowStyle}>
          <span className="section-label">Nombre</span>
          <span className="section-label">Email</span>
          <span className="section-label">Rol</span>
          <span className="section-label">Cliente</span>
        </div>
        {(usuarios ?? []).map((u) => (
          <div key={u.id} style={{ ...rowStyle, borderTop: '1px solid var(--lineSoft)' }}>
            <span>{u.nombre}</span>
            <span style={{ color: 'var(--muted)' }}>{u.email}</span>
            <span>{ROLE_LABEL[u.role]}</span>
            <span style={{ color: 'var(--muted)' }}>{u.cliente?.nombre ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 };
const btnStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--green)', border: 'none', borderRadius: 7, padding: '10px 16px', cursor: 'pointer' };
const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1.4fr 160px 1fr', gap: 14, padding: '12px 16px', fontSize: 13 };
