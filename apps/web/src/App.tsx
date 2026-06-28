import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { InternalLayout } from './app/InternalLayout';
import { ClientLayout } from './app/ClientLayout';
import { Login } from './pages/Login';
import { Inicio } from './pages/Inicio';
import { DashboardObras } from './pages/DashboardObras';
import { DetalleObra } from './pages/DetalleObra';
import { CobranzasFlujo } from './pages/CobranzasFlujo';
import { OrdenesCompra } from './pages/OrdenesCompra';
import { CotizacionPublica } from './pages/CotizacionPublica';
import { PortalCliente } from './pages/PortalCliente';
import { PlannerRedes } from './pages/PlannerRedes';
import { AgendaColaborativa } from './pages/AgendaColaborativa';
import { Configuracion } from './pages/Configuracion';
import { Usuarios } from './pages/Usuarios';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cotizar" element={<CotizacionPublica />} />

      <Route element={<ProtectedRoute roles={['SOCIO', 'COMMUNITY_MANAGER']} />}>
        <Route element={<InternalLayout />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/obras" element={<DashboardObras />} />
          <Route path="/obras/:obraId" element={<DetalleObra />} />
          <Route path="/cobranzas" element={<CobranzasFlujo />} />
          <Route path="/ordenes-compra" element={<OrdenesCompra />} />
          <Route path="/planner" element={<PlannerRedes />} />
          <Route path="/agenda" element={<AgendaColaborativa />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route element={<ProtectedRoute roles={['SOCIO']} />}>
            <Route path="/usuarios" element={<Usuarios />} />
          </Route>
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['CLIENTE']} />}>
        <Route element={<ClientLayout />}>
          <Route path="/portal" element={<PortalCliente />} />
        </Route>
      </Route>
    </Routes>
  );
}
