import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Inicio() {
  const { user } = useAuth();
  return (
    <div>
      <div className="section-label">Bienvenido</div>
      <h1 style={{ fontSize: 32, margin: '6px 0 24px' }}>{user?.nombre}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Link to="/obras" style={cardStyle}>
          Dashboard de Obras
        </Link>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: 'block',
  padding: 20,
  borderRadius: 14,
  border: '1px solid var(--line)',
  background: 'var(--surf)',
  color: 'var(--ink)',
  textDecoration: 'none',
  fontWeight: 600,
};
