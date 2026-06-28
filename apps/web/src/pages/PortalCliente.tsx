import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { AsistenteChat } from './portal/AsistenteChat';

type ObraMia = { id: string; nombre: string };
type EtapaSan = { id: string; code: string; nombre: string; items: { cantidad: number; precioVenta: number; avance: number }[] };
type Consolidado = { etapas: EtapaSan[]; montoTotal: number };
type CertificadoCliente = { id: string; periodo: string; totalVenta: number; estadoPago: string };

function etapaAvance(et: EtapaSan) {
  const venta = et.items.reduce((s, it) => s + it.cantidad * it.precioVenta, 0);
  const hecho = et.items.reduce((s, it) => s + it.cantidad * it.precioVenta * (it.avance / 100), 0);
  return { venta, avance: venta ? Math.round((hecho / venta) * 100) : 0 };
}

export function PortalCliente() {
  const { user } = useAuth();
  const { data: obras } = useQuery({ queryKey: ['obras-mias'], queryFn: () => api.get<ObraMia[]>('/obras/mias') });
  const obraId = obras?.[0]?.id;

  const { data: consolidado } = useQuery({
    queryKey: ['obra', obraId, 'consolidado'],
    queryFn: () => api.get<Consolidado>(`/obras/${obraId}/consolidado`),
    enabled: !!obraId,
  });
  const { data: certificados } = useQuery({
    queryKey: ['certificados', obraId],
    queryFn: () => api.get<CertificadoCliente[]>(`/obras/${obraId}/certificados`),
    enabled: !!obraId,
  });

  if (!obraId || !consolidado) return <p style={{ padding: 30, color: 'var(--muted)' }}>Cargando tu obra…</p>;

  const etapasConVenta = consolidado.etapas.map((et) => ({ ...et, ...etapaAvance(et) })).filter((e) => e.venta > 0);
  const totalVenta = etapasConVenta.reduce((s, e) => s + e.venta, 0);
  const avanceGlobal = totalVenta
    ? Math.round(etapasConVenta.reduce((s, e) => s + e.avance * e.venta, 0) / totalVenta)
    : 0;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 30px 70px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
        <strong style={{ letterSpacing: '.2em', fontSize: 14 }}>VIBRARQ</strong>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{user?.nombre}</span>
      </div>

      <div className="section-label">Tu obra</div>
      <h1 style={{ fontSize: 32, marginBottom: 20 }}>{obras?.[0]?.nombre}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div style={cardStyle}>
          <div className="section-label">Avance general</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 700, margin: '6px 0' }}>{avanceGlobal}%</div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--surf2)' }}>
            <div style={{ height: '100%', width: `${avanceGlobal}%`, borderRadius: 4, background: 'var(--green)' }} />
          </div>
        </div>
        <div style={cardStyle}>
          <div className="section-label">Inversión aprobada</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700, marginTop: 8 }}>{money(consolidado.montoTotal)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 12 }}>
            Etapas de la obra
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            {etapasConVenta.map((et) => (
              <div key={et.id} style={{ padding: '12px 16px', borderTop: '1px solid var(--lineSoft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>{et.nombre}</span>
                  <span style={{ fontWeight: 600 }}>{et.avance}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--surf2)' }}>
                  <div style={{ height: '100%', width: `${et.avance}%`, borderRadius: 3, background: 'var(--green)' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="section-label" style={{ marginBottom: 12 }}>
            Certificados
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {(certificados ?? []).map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--lineSoft)', fontSize: 13 }}>
                <span>{c.periodo}</span>
                <span>
                  {money(c.totalVenta)} · {c.estadoPago}
                </span>
              </div>
            ))}
            {certificados?.length === 0 && <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Todavía no hay certificados.</div>}
          </div>
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 12 }}>
            Asistente VIBRARQ
          </div>
          <AsistenteChat obraId={obraId} />
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { padding: '16px 18px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surf)' };
