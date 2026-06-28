import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Consolidado, Presupuesto } from '../../types/presupuesto';

// Gantt automático portado de buildGantt() en designs/Detalle de Obra.dc.html:
// etapas encadenadas en secuencia constructiva, ancho proporcional a sus días.
export function PlanificacionTab({ obraId, budgetSel }: { obraId: string; budgetSel: string }) {
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

  const gantt = useMemo(() => {
    const filas = etapas
      .map((et) => {
        const venta = et.items.reduce((s, it) => s + it.cantidad * it.precioVenta, 0);
        const hecho = et.items.reduce((s, it) => s + it.cantidad * it.precioVenta * (it.avance / 100), 0);
        const dias = et.items.reduce((s, it) => s + it.dias, 0);
        const avance = venta ? Math.round((hecho / venta) * 100) : 0;
        return { code: et.code, nombre: et.nombre, dias, avance, ventaRaw: venta };
      })
      .filter((f) => f.ventaRaw > 0);

    const totalDias = filas.reduce((s, f) => s + f.dias, 0);
    const totalWeeks = Math.max(1, Math.ceil(totalDias / 5));
    let cursor = 0;
    const rows = filas.map((f) => {
      const startW = cursor / 5;
      const spanW = Math.max(0.5, f.dias / 5);
      cursor += f.dias;
      const left = (startW / totalWeeks) * 100;
      const width = (spanW / totalWeeks) * 100;
      return { ...f, left, width };
    });
    return { rows, totalWeeks };
  }, [etapas]);

  return (
    <div>
      <div className="section-label" style={{ marginBottom: 14 }}>
        Planificación · {gantt.totalWeeks} semana(s) estimadas
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
        {gantt.rows.map((row) => (
          <div key={row.code} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12.5 }}>
              {row.code} · {row.nombre}
            </div>
            <div style={{ position: 'relative', height: 22, background: 'var(--surf2)', borderRadius: 6 }}>
              <div
                style={{
                  position: 'absolute',
                  left: `${row.left}%`,
                  width: `${row.width}%`,
                  top: 2,
                  height: 18,
                  background: 'var(--greenSoft)',
                  border: '1px solid var(--green)',
                  borderRadius: 5,
                  overflow: 'hidden',
                }}
              >
                <div style={{ height: '100%', width: `${row.avance}%`, background: 'var(--green)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
