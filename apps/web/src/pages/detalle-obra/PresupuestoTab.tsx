import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import type { Consolidado, Etapa, Presupuesto } from '../../types/presupuesto';

function etapaTotales(etapa: Etapa) {
  let venta = 0;
  let costo = 0;
  let hecho = 0;
  for (const it of etapa.items) {
    const sv = it.cantidad * it.precioVenta;
    venta += sv;
    costo += it.cantidad * it.costoProveedor;
    hecho += sv * (it.avance / 100);
  }
  const avance = venta ? Math.round((hecho / venta) * 100) : 0;
  const margen = venta - costo;
  const mpct = venta ? Math.round((margen / venta) * 100) : 0;
  return { venta, costo, avance, margen, mpct };
}

export function PresupuestoTab({ obraId, budgetSel }: { obraId: string; budgetSel: string }) {
  const isConsolidado = budgetSel === 'consol';
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const etapas: Etapa[] = isConsolidado ? consolidadoQuery.data?.etapas ?? [] : presupuestoQuery.data?.etapas ?? [];
  const loading = isConsolidado ? consolidadoQuery.isLoading : presupuestoQuery.isLoading;

  const updateItem = useMutation({
    mutationFn: ({ itemId, field, value }: { itemId: string; field: string; value: number }) =>
      api.patch(`/items/${itemId}`, { [field]: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presupuesto', budgetSel] }),
  });

  const addItem = useMutation({
    mutationFn: (etapaId: string) => api.post(`/etapas/${etapaId}/items`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presupuesto', budgetSel] }),
  });

  const addEtapa = useMutation({
    mutationFn: () => api.post(`/presupuestos/${budgetSel}/etapas`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presupuesto', budgetSel] }),
  });

  const totales = useMemo(() => {
    let venta = 0;
    let costo = 0;
    for (const et of etapas) {
      const t = etapaTotales(et);
      venta += t.venta;
      costo += t.costo;
    }
    return { venta, costo, margen: venta - costo, mpct: venta ? Math.round(((venta - costo) / venta) * 100) : 0 };
  }, [etapas]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Cargando presupuesto…</p>;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '14px 16px',
          border: '1px solid var(--line)',
          borderRadius: 12,
          marginBottom: 16,
          background: isConsolidado ? 'var(--greenSoft)' : 'var(--surf)',
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>{isConsolidado ? 'Obra completa (consolidado)' : (presupuestoQuery.data?.nombre ?? '—')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{isConsolidado ? 'Solo lectura · original + adicionales aprobados' : presupuestoQuery.data?.detalle}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{money(totales.venta)}</div>
          <div style={{ fontSize: 12.5, color: totales.mpct < 32 ? 'var(--bad)' : 'var(--good)' }}>margen {totales.mpct}%</div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {etapas.map((etapa) => {
          const t = etapaTotales(etapa);
          const isOpen = !!expanded[etapa.id];
          return (
            <div key={etapa.id} style={{ borderTop: '1px solid var(--lineSoft)' }}>
              <button
                onClick={() => setExpanded((s) => ({ ...s, [etapa.id]: !s[etapa.id] }))}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: isOpen ? 'var(--surf2)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>
                  <strong>
                    {etapa.code} · {etapa.nombre}
                  </strong>{' '}
                  <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>({etapa.items.length} ítems)</span>
                </span>
                <span style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12.5 }}>
                  <span>{money(t.venta)}</span>
                  <span style={{ color: t.mpct < 30 ? 'var(--bad)' : 'var(--good)', fontWeight: 600 }}>{t.mpct}%</span>
                  <span>{isOpen ? '▾' : '▸'}</span>
                </span>
              </button>
              {isOpen && (
                <>
                  <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '.06em' }}>
                        <th style={thStyle}>Código</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>Descripción</th>
                        <th style={thStyle}>Cant.</th>
                        {!isConsolidado && <th style={thStyle}>Costo prov.</th>}
                        <th style={thStyle}>Venta</th>
                        <th style={thStyle}>Días</th>
                        <th style={thStyle}>Avance %</th>
                        <th style={thStyle}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etapa.items.map((it) => (
                        <tr key={it.id} style={{ borderTop: '1px solid var(--lineSoft)', opacity: it.cantidad > 0 ? 1 : 0.5 }}>
                          <td style={tdStyle}>{it.codigoCifras}</td>
                          <td style={{ ...tdStyle, textAlign: 'left' }}>{it.desc}</td>
                          <td style={tdStyle}>
                            {isConsolidado ? it.cantidad : (
                              <EditableNumber value={it.cantidad} onCommit={(v) => updateItem.mutate({ itemId: it.id, field: 'cantidad', value: v })} />
                            )}
                          </td>
                          {!isConsolidado && (
                            <td style={tdStyle}>
                              <EditableNumber value={it.costoProveedor} onCommit={(v) => updateItem.mutate({ itemId: it.id, field: 'costoProveedor', value: v })} />
                            </td>
                          )}
                          <td style={tdStyle}>
                            {isConsolidado ? money(it.precioVenta) : (
                              <EditableNumber value={it.precioVenta} onCommit={(v) => updateItem.mutate({ itemId: it.id, field: 'precioVenta', value: v })} />
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isConsolidado ? it.dias : (
                              <EditableNumber value={it.dias} onCommit={(v) => updateItem.mutate({ itemId: it.id, field: 'dias', value: v })} />
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isConsolidado ? `${it.avance}%` : (
                              <EditableNumber value={it.avance} onCommit={(v) => updateItem.mutate({ itemId: it.id, field: 'avance', value: Math.max(0, Math.min(100, v)) })} />
                            )}
                          </td>
                          <td style={tdStyle}>{money(it.cantidad * it.precioVenta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!isConsolidado && (
                    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--lineSoft)' }}>
                      <button
                        onClick={() => addItem.mutate(etapa.id)}
                        disabled={addItem.isPending}
                        style={addBtnStyle}
                      >
                        + Agregar ítem
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {!isConsolidado && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => addEtapa.mutate()}
            disabled={addEtapa.isPending}
            style={addBtnStyle}
          >
            + Agregar rubro
          </button>
        </div>
      )}
    </div>
  );
}

function EditableNumber({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  const [dirty, setDirty] = useState(false);

  const commit = () => {
    const n = parseFloat(local);
    if (!Number.isNaN(n) && n !== value) onCommit(n);
    setDirty(false);
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        value={local}
        onChange={(e) => { setLocal(e.target.value); setDirty(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        onBlur={() => { if (!dirty) return; commit(); }}
        style={{
          width: 64,
          textAlign: 'right',
          padding: '4px 6px',
          borderRadius: 5,
          border: '1px solid var(--line)',
          background: 'var(--paper)',
          color: 'var(--ink)',
          fontSize: 12.5,
        }}
      />
      {dirty && (
        <button
          onMouseDown={(e) => { e.preventDefault(); commit(); }}
          style={{
            padding: '3px 7px',
            fontSize: 11,
            borderRadius: 5,
            border: '1px solid var(--accent)',
            background: 'var(--accent)',
            color: '#fff',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          OK
        </button>
      )}
    </span>
  );
}

const addBtnStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--accent)',
  background: 'transparent',
  border: '1px dashed var(--accent)',
  borderRadius: 6,
  padding: '5px 12px',
  cursor: 'pointer',
};

const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'right' };
const tdStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'right' };
