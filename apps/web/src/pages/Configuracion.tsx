import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { money } from '../lib/format';

type Integracion = { id: string; proveedor: string; conectado: boolean };
type FuenteCosto = { id: string; fuente: string; activa: boolean; lastSync: string | null };
type IndiceRubro = { rubro: string; nombreRubro: string; manoObraPromedio: number; materialPromedio: number; variacionMensualPct: number };

const INTEGRACION_LABEL: Record<string, string> = { 'google-drive': 'Google Drive', instagram: 'Instagram', email: 'Correo' };
const FUENTE_LABEL: Record<string, string> = { CIFRAS: 'Revista CIFRAS', CAPSF: 'Base CAPSF', PROPIA: 'Costos propios' };

type Tab = 'integraciones' | 'fuentes' | 'indice';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function Configuracion() {
  const [tab, setTab] = useState<Tab>('integraciones');
  const [toast, setToast] = useState<string | null>(null);
  const location = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('instagram') === 'connected') {
      setToast('Instagram conectado correctamente ✓');
      qc.invalidateQueries({ queryKey: ['config', 'integraciones'] });
      window.history.replaceState({}, '', '/configuracion');
    } else if (params.get('instagram') === 'error') {
      setToast('Error al conectar Instagram. Revisá los permisos.');
      window.history.replaceState({}, '', '/configuracion');
    } else if (params.get('drive') === 'connected') {
      setToast('Google Drive conectado correctamente ✓');
      qc.invalidateQueries({ queryKey: ['config', 'integraciones'] });
      window.history.replaceState({}, '', '/configuracion');
    }
    if (params.get('instagram') || params.get('drive')) {
      setTimeout(() => setToast(null), 4000);
    }
  }, [location.search, qc]);

  const { data: integraciones } = useQuery({ queryKey: ['config', 'integraciones'], queryFn: () => api.get<Integracion[]>('/configuracion/integraciones') });
  const { data: fuentes } = useQuery({ queryKey: ['config', 'fuentes'], queryFn: () => api.get<FuenteCosto[]>('/configuracion/fuentes-costo') });
  const { data: indice } = useQuery({
    queryKey: ['config', 'indice'],
    queryFn: () => api.get<IndiceRubro[]>('/configuracion/indice-costos'),
    enabled: tab === 'indice',
  });

  const toggleIntegracion = useMutation({
    mutationFn: (id: string) => api.patch(`/configuracion/integraciones/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config', 'integraciones'] }),
  });
  const activarFuente = useMutation({
    mutationFn: (id: string) => api.patch(`/configuracion/fuentes-costo/${id}/activar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  });

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: toast.includes('Error') ? 'var(--bad)' : 'var(--good)', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}
      <div className="section-label">Estudio</div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Configuración</h1>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
        {(
          [
            ['integraciones', 'Integraciones'],
            ['fuentes', 'Fuentes de costos'],
            ['indice', 'Índice de costos'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '11px 17px',
              fontSize: 13,
              fontWeight: tab === key ? 600 : 500,
              color: tab === key ? 'var(--ink)' : 'var(--muted)',
              borderBottom: tab === key ? '2px solid var(--green)' : '2px solid transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              background: 'transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'integraciones' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          {(integraciones ?? []).map((i) => (
            <div key={i.id} style={rowStyle}>
              <div>
                <div style={{ fontWeight: 600 }}>{INTEGRACION_LABEL[i.proveedor] ?? i.proveedor}</div>
                {i.proveedor === 'instagram' && !i.conectado && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Requiere cuenta Instagram Business conectada a una Página de Facebook
                  </div>
                )}
              </div>
              <span style={{ color: i.conectado ? 'var(--good)' : 'var(--muted)', fontSize: 12.5 }}>
                {i.conectado ? '● Conectado' : '○ Desconectado'}
              </span>
              {/* Google Drive — OAuth redirect */}
              {i.proveedor === 'google-drive' && !i.conectado && (
                <a href={`${API_BASE}/configuracion/integraciones/google/connect`} style={smallBtn}>
                  Conectar
                </a>
              )}
              {/* Instagram — OAuth redirect via Meta */}
              {i.proveedor === 'instagram' && !i.conectado && (
                <a href={`${API_BASE}/configuracion/integraciones/instagram/connect`} style={{ ...smallBtn, background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', color: '#fff', border: 'none' }}>
                  Conectar Instagram
                </a>
              )}
              {/* Conectado — botón desconectar */}
              {i.conectado && (
                <button onClick={() => toggleIntegracion.mutate(i.id)} style={{ ...smallBtn, color: 'var(--bad)', borderColor: 'var(--bad)' }}>
                  Desconectar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'fuentes' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          {(fuentes ?? []).map((f) => (
            <div key={f.id} style={rowStyle}>
              <span style={{ fontWeight: 600 }}>{FUENTE_LABEL[f.fuente] ?? f.fuente}</span>
              <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                {f.lastSync ? `Sincronizado ${new Date(f.lastSync).toLocaleDateString('es-AR')}` : 'Sin sincronizar'}
              </span>
              {f.activa ? (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--good)' }}>Fuente activa</span>
              ) : (
                <button onClick={() => activarFuente.mutate(f.id)} style={smallBtn}>
                  Usar esta fuente
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'indice' && (
        <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: 10.5 }}>
              <th style={thStyle}>Rubro</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Nombre</th>
              <th style={thStyle}>Mano de obra (prom.)</th>
              <th style={thStyle}>Material (prom.)</th>
              <th style={thStyle}>Variación mensual</th>
            </tr>
          </thead>
          <tbody>
            {(indice ?? []).map((r) => (
              <tr key={r.rubro} style={{ borderTop: '1px solid var(--lineSoft)' }}>
                <td style={tdStyle}>{r.rubro}</td>
                <td style={{ ...tdStyle, textAlign: 'left' }}>{r.nombreRubro}</td>
                <td style={tdStyle}>{money(r.manoObraPromedio)}</td>
                <td style={tdStyle}>{money(r.materialPromedio)}</td>
                <td style={{ ...tdStyle, color: r.variacionMensualPct >= 0 ? 'var(--bad)' : 'var(--good)' }}>
                  {r.variacionMensualPct > 0 ? '+' : ''}
                  {r.variacionMensualPct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 200px 140px', gap: 14, alignItems: 'center', padding: '14px 16px', borderTop: '1px solid var(--lineSoft)' };
const smallBtn: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--green)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 12px', background: 'var(--surf)', cursor: 'pointer' };
const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'right' };
const tdStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'right' };
