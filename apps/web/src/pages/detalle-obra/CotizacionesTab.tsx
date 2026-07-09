import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import type { ObraDetalle } from '../../types/presupuesto';

const ESTADO_LABEL: Record<string, string> = { ENVIADO: 'Enviado', PROCESO: 'En proceso', APROBADO: 'Contratado' };
const ESTADO_COLOR: Record<string, string> = {
  ENVIADO: 'var(--ink2)',
  PROCESO: 'var(--warn)',
  APROBADO: 'var(--good)',
};

function avanceLabel(estado: string, pct: number) {
  if (estado !== 'APROBADO') return { label: '—', color: 'var(--muted)' };
  if (pct <= 0) return { label: 'Por iniciar', color: 'var(--muted)' };
  if (pct >= 100) return { label: 'Finalizado', color: 'var(--good)' };
  return { label: `En avance · ${pct}%`, color: 'var(--warn)' };
}

export function CotizacionesTab({
  obra,
  budgetSel,
  onSelect,
}: {
  obra: ObraDetalle;
  budgetSel: string;
  onSelect: (id: string, tab?: 'cotiz' | 'ppto') => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [detalle, setDetalle] = useState('');
  const qc = useQueryClient();

  const createAdicional = useMutation({
    mutationFn: () => api.post(`/obras/${obra.id}/presupuestos`, { nombre, detalle }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obra', obra.id] });
      setShowForm(false);
      setNombre('');
      setDetalle('');
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="section-label">Presupuestos de la obra</div>
        <button onClick={() => setShowForm((v) => !v)} style={btnStyle}>
          {obra.cotizaciones.length === 0 ? '+ Crear presupuesto original' : '+ Nuevo presupuesto adicional'}
        </button>
      </div>

      {showForm && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', gap: 10 }}>
          <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
          <input placeholder="Detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} style={inputStyle} />
          <button onClick={() => createAdicional.mutate()} disabled={!nombre || createAdicional.isPending} style={btnStyle}>
            Crear
          </button>
        </div>
      )}

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ ...rowStyle, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          <span>N°</span>
          <span>Nombre</span>
          <span>Monto</span>
          <span>Estado</span>
          <span>Avance</span>
          <span />
        </div>
        {obra.cotizaciones.map((c) => {
          const av = avanceLabel(c.estado, c.avance);
          const active = budgetSel === c.id;
          return (
            <div key={c.id} style={{ ...rowStyle, background: active ? 'var(--surf2)' : 'transparent', borderTop: '1px solid var(--lineSoft)' }}>
              <span>{c.numero}</span>
              <span>
                <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.detalle}</div>
              </span>
              <span>{money(c.montoVenta)}</span>
              <span style={{ color: ESTADO_COLOR[c.estado], fontWeight: 600, fontSize: 12.5 }}>{ESTADO_LABEL[c.estado]}</span>
              <span style={{ color: av.color, fontWeight: 600, fontSize: 12.5 }}>{av.label}</span>
              <button onClick={() => onSelect(c.id, 'ppto')} style={verBtnStyle}>
                Ver
              </button>
            </div>
          );
        })}
      </div>

      {obra.consolidadoCount > 0 && (
        <div
          style={{
            marginTop: 18,
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--greenSoft)',
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>Obra completa · consolidado</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
              {obra.consolidadoCount} presupuesto(s) contratado(s) · {money(obra.consolidadoMonto)}
            </div>
          </div>
          <button onClick={() => onSelect('consol', 'ppto')} style={btnStyle}>
            Analizar obra completa
          </button>
        </div>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '70px 1.6fr 120px 110px 130px 70px',
  gap: 14,
  alignItems: 'center',
  padding: '12px 16px',
};

const btnStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: '#fff',
  background: 'var(--green)',
  border: 'none',
  borderRadius: 7,
  padding: '8px 12px',
  cursor: 'pointer',
};

const verBtnStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--green)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: '6px 10px',
  background: 'var(--surf)',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  borderRadius: 7,
  border: '1px solid var(--line)',
  background: 'var(--paper)',
  color: 'var(--ink)',
};
