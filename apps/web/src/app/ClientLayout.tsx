import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

export function ClientLayout() {
  useEffect(() => {
    document.documentElement.dataset.theme = 'editorial';
  }, []);

  return (
    <div style={{ minHeight: '100svh', background: 'var(--paper)' }}>
      <Outlet />
    </div>
  );
}
