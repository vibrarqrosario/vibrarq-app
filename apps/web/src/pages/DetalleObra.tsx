import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { money } from '../lib/format';
import type { ObraDetalle } from '../types/presupuesto';
import { CotizacionesTab } from './detalle-obra/CotizacionesTab';
import { PresupuestoTab } from './detalle-obra/PresupuestoTab';
import { MaterialesTab } from './detalle-obra/MaterialesTab';
import { PlanificacionTab } from './detalle-obra/PlanificacionTab';
import { CertificadosTab } from './detalle-obra/CertificadosTab';
import { AmbientesTab } from './detalle-obra/AmbientesTab';
import { MoodboardTab } from './detalle-obra/MoodboardTab';
import { PlanosTab } from './detalle-obra/PlanosTab';

const TABS = [
  { key: 'cotiz', label: 'Cotizaciones' },
  { key: 'ppto', label: 'Presupuesto' },
  { key: 'plan', label: 'Planificación' },
  { key: 'cert', label: 'Certificados' },
  { key: 'mat', label: 'Materiales' },
  { key: 'amb', label: 'Ambientes' },
  { key: 'mood', label: 'Moodboard' },
  { key: 'planos', label: 'Planos' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function DetalleObra() {
  const { obraId } = useParams<{ obraId: string }>();
  const [tab, setTab] = useState<TabKey>('cotiz');
  const [budgetSel, setBudgetSel] = useState<string>('');

  const { data: obra, isLoading } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => api.get<ObraDetalle>(`/obras/${obraId}`),
    enabled: !!obraId,
  });

  useEffect(() => {
    if (obra && !budgetSel) {
      const original = obra.cotizaciones.find((c) => c.tipo === 'ORIGINAL');
      setBudgetSel(original?.id ?? obra.cotizaciones[0]?.id ?? '');
    }
  }, [obra, budgetSel]);

  if (isLoading || !obra) return <p style={{ color: 'var(--muted)' }}>Cargando obra…</p>;

  return (
    <div>
      <div className="section-label">{obra.cliente.nombre}</div>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>{obra.nombre}</h1>
      <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        {obra.ubicacion} · {obra.tipo} · {obra.m2} m² · {obra.plantas} planta(s)
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 22 }}>
        <div style={kpiStyle}>
          <div className="section-label">Venta consolidada</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{money(obra.consolidadoMonto)}</div>
        </div>
        <div style={kpiStyle}>
          <div className="section-label">Adicionales</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{obra.adicionalCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '11px 17px',
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 500,
              color: tab === t.key ? 'var(--ink)' : 'var(--muted)',
              borderBottom: tab === t.key ? '2px solid var(--green)' : '2px solid transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              background: 'transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cotiz' && (
        <CotizacionesTab
          obra={obra}
          budgetSel={budgetSel}
          onSelect={(id, goTab) => {
            setBudgetSel(id);
            if (goTab) setTab(goTab);
          }}
        />
      )}
      {tab === 'ppto' && budgetSel && <PresupuestoTab obraId={obra.id} budgetSel={budgetSel} />}
      {tab === 'plan' && budgetSel && <PlanificacionTab obraId={obra.id} budgetSel={budgetSel} />}
      {tab === 'cert' && <CertificadosTab obraId={obra.id} />}
      {tab === 'mat' && budgetSel && <MaterialesTab obraId={obra.id} budgetSel={budgetSel} />}
      {tab === 'amb' && <AmbientesTab obraId={obra.id} />}
      {tab === 'mood' && <MoodboardTab obraId={obra.id} />}
      {tab === 'planos' && <PlanosTab obraId={obra.id} />}
    </div>
  );
}

const kpiStyle: React.CSSProperties = { padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surf)' };
