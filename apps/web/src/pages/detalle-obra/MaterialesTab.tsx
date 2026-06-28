import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import type { Consolidado, Presupuesto } from '../../types/presupuesto';

export function MaterialesTab({ obraId, budgetSel }: { obraId: string; budgetSel: string }) {
  const isConsolidado = budgetSel === 'consol';
  const presupuestoQuery = useQuery({
    queryKey: ['presupuesto', budgetSel],
    queryFn: () => api.get<Presupuesto>(`/presupuestos/${budgetSel}`),
    enabled: !isConsolidado,
  });
  const consolidadoQuery = useQuery({
    queryKey: ['obra', obraId, 'consolidado'],
    queryFn: () => api.get<Consolidado>(`/obras/${obraId}/consolidado`),
    enabled: isConsolidado,
  });

  const etapas = isConsolidado ? consolidadoQuery.data?.etapas ?? [] : presupuestoQuery.data?.etapas ?? [];

  const rows = useMemo(() => {
    const out: { code: string; desc: string; unidad: string; cantidad: number; mat: number; mano: number }[] = [];
    let totMat = 0;
    let totMano = 0;
    for (const et of etapas) {
      for (const it of et.items) {
        const mat = it.cantidad * it.costoProveedor * (it.ratioMaterial ?? 0);
        const mano = it.cantidad * it.costoProveedor * (1 - (it.ratioMaterial ?? 0));
        totMat += mat;
        totMano += mano;
        if (mat > 0) out.push({ code: it.codigoCifras, desc: it.desc, unidad: it.unidad, cantidad: it.cantidad, mat, mano });
      }
    }
    return { rows: out, totMat, totMano };
  }, [etapas]);

  const total = rows.totMat + rows.totMano;
  const matPct = total ? Math.round((rows.totMat / total) * 100) : 0;

  if (isConsolidado) {
    return <p style={{ color: 'var(--muted)' }}>El desglose de materiales no está disponible en la vista consolidada (costos por presupuesto).</p>;
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div className="section-label">Materiales</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{money(rows.totMat)}</div>
        </div>
        <div style={cardStyle}>
          <div className="section-label">Mano de obra</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{money(rows.totMano)}</div>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--surf2)', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${matPct}%`, background: 'var(--green)' }} />
      </div>
      <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: 10.5 }}>
            <th style={thStyle}>Código</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>Descripción</th>
            <th style={thStyle}>Cant.</th>
            <th style={thStyle}>Material</th>
            <th style={thStyle}>Mano de obra</th>
          </tr>
        </thead>
        <tbody>
          {rows.rows.map((r) => (
            <tr key={r.code} style={{ borderTop: '1px solid var(--lineSoft)' }}>
              <td style={tdStyle}>{r.code}</td>
              <td style={{ ...tdStyle, textAlign: 'left' }}>{r.desc}</td>
              <td style={tdStyle}>
                {r.cantidad} {r.unidad}
              </td>
              <td style={tdStyle}>{money(r.mat)}</td>
              <td style={tdStyle}>{money(r.mano)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cardStyle: React.CSSProperties = { padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surf)' };
const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'right' };
const tdStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'right' };
