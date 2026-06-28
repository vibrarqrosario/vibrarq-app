import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/', label: 'Inicio' },
  { to: '/obras', label: 'Dashboard de Obras' },
  { to: '/cobranzas', label: 'Cobranzas y Flujo' },
  { to: '/ordenes-compra', label: 'Órdenes de Compra' },
  { to: '/planner', label: 'Planner de Redes' },
  { to: '/agenda', label: 'Agenda Colaborativa' },
  { to: '/configuracion', label: 'Configuración' },
  { to: '/usuarios', label: 'Usuarios', soloSocio: true },
];

export function InternalLayout() {
  const { user, logout } = useAuth();

  useEffect(() => {
    document.documentElement.dataset.theme = 'blueprint';
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100svh' }}>
      <aside
        style={{
          width: 222,
          flex: 'none',
          background: 'var(--surf)',
          borderRight: '1px solid var(--line)',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700, marginBottom: 24 }}>VIBRARQ</div>
        {NAV.filter((item) => !item.soloSocio || user?.role === 'SOCIO').map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={({ isActive }) => ({
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 500,
              color: isActive ? 'var(--ink)' : 'var(--ink2)',
              background: isActive ? 'var(--surf2)' : 'transparent',
              textDecoration: 'none',
            })}
          >
            {item.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '0 12px' }}>{user?.nombre}</div>
        <button
          onClick={logout}
          style={{
            marginTop: 8,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink2)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Cerrar sesión
        </button>
      </aside>
      <main style={{ flex: 1, padding: 28, background: 'var(--paper)', minHeight: '100svh' }}>
        <Outlet />
      </main>
    </div>
  );
}
