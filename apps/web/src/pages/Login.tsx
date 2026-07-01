import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = 'editorial';
  }, []);

  if (user) return <Navigate to={user.role === 'CLIENTE' ? '/portal' : (location.state as any)?.from ?? '/obras'} replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedUser = await login(email, password);
      navigate(loggedUser.role === 'CLIENTE' ? '/portal' : '/obras');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100svh' }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: 360,
          background: 'var(--surf)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>VIBRARQ Studio</h1>
        <div className="section-label">Iniciar sesión</div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        {error && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</div>}
        <button type="submit" disabled={submitting} style={buttonStyle}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--paper)',
  color: 'var(--ink)',
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  padding: '11px 12px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--green)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 14,
};
