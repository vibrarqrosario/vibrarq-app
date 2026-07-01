import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import type { Consolidado, Etapa, Presupuesto } from '../../types/presupuesto';

const UNIDADES = ['Gl', 'un', 'm²', 'm³', 'm', 'kg', 'hs', '%'];

function etapaTotales(etapa: Etapa) {
  let venta = 0; let costo = 0; let hecho = 0;
  for (const it of etapa.items) {
    venta += it.precioVenta;
    costo += it.costoProveedor;
    hecho += it.precioVenta * (it.avance / 100);
  }
  const avance = venta ? Math.round((hecho / venta) * 100) : 0;
  return { venta, costo, avance, margen: venta - costo, mpct: venta ? Math.round(((venta - costo) / venta) * 100) : 0 };
}

export function PresupuestoTab({ obraId, budgetSel }: { obraId: string; budgetSel: string }) {
  const isConsolidado = budgetSel === 'consol';
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmando, setConfirmando] = useState(false);

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
    mutationFn: ({ itemId, data }: { itemId: string; data: Record<string, unknown> }) =>
      api.patch(`/items/${itemId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presupuesto', budgetSel] }),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => api.delete(`/items/${itemId}`),
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

  const aplicarFuente = useMutation({
    mutationFn: (fuente: 'CIFRAS' | 'VIBRARQ') => api.post(`/presupuestos/${budgetSel}/aplicar-fuente`, { fuente }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presupuesto', budgetSel] }),
  });

  const confirmar = useMutation({
    mutationFn: () => api.post(`/presupuestos/${budgetSel}/confirmar`),
    onSuccess: () => { setConfirmando(false); qc.invalidateQueries({ queryKey: ['presupuesto', budgetSel] }); },
  });

  const totales = useMemo(() => {
    let venta = 0; let costo = 0;
    for (const et of etapas) { const t = etapaTotales(et); venta += t.venta; costo += t.costo; }
    return { venta, costo, margen: venta - costo, mpct: venta ? Math.round(((venta - costo) / venta) * 100) : 0 };
  }, [etapas]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Cargando presupuesto…</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 12, marginBottom: 16, background: isConsolidado ? 'var(--greenSoft)' : 'var(--surf)' }}>
        <div>
          <div style={{ fontWeight: 700 }}>{isConsolidado ? 'Obra completa (consolidado)' : (presupuestoQuery.data?.nombre ?? '—')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{isConsolidado ? 'Solo lectura · original + adicionales aprobados' : presupuestoQuery.data?.detalle}</div>
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{money(totales.venta)}</div>
          <div style={{ fontSize: 12.5, color: totales.mpct < 28 ? 'var(--bad)' : 'var(--good)' }}>margen {totales.mpct}%</div>
          {!isConsolidado && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Fuente:</span>
              {(['CIFRAS', 'VIBRARQ'] as const).map((f) => (
                <button key={f} onClick={() => aplicarFuente.mutate(f)} disabled={aplicarFuente.isPending} style={srcBtnStyle}>{f}</button>
              ))}
              <button
                onClick={() => setConfirmando(true)}
                style={{ ...srcBtnStyle, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
              >
                ✓ Confirmar presupuesto
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmar modal */}
      {confirmando && (
        <div style={{ background: 'var(--surf)', border: '1px solid var(--accent)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ flex: 1, fontSize: 13 }}>¿Confirmar presupuesto? Se eliminarán todos los ítems con cantidad 0 y el estado pasará a <strong>APROBADO</strong>.</span>
          <button onClick={() => confirmar.mutate()} disabled={confirmar.isPending} style={{ ...srcBtnStyle, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>Confirmar</button>
          <button onClick={() => setConfirmando(false)} style={srcBtnStyle}>Cancelar</button>
        </div>
      )}

      {/* Tabla por etapa */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {etapas.map((etapa) => {
          const t = etapaTotales(etapa);
          const isOpen = !!expanded[etapa.id];
          return (
            <div key={etapa.id} style={{ borderTop: '1px solid var(--lineSoft)' }}>
              <button onClick={() => setExpanded((s) => ({ ...s, [etapa.id]: !s[etapa.id] }))}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: isOpen ? 'var(--surf2)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span><strong>{etapa.code} · {etapa.nombre}</strong> <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>({etapa.items.length} ítems)</span></span>
                <span style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12.5 }}>
                  <span>{money(t.venta)}</span>
                  <span style={{ color: t.mpct < 28 ? 'var(--bad)' : 'var(--good)', fontWeight: 600 }}>{t.mpct}%</span>
                  <span>{isOpen ? '▾' : '▸'}</span>
                </span>
              </button>

              {isOpen && (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 900 }}>
                      <thead>
                        <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: 10.5, letterSpacing: '.06em' }}>
                          <th style={{ ...thStyle, textAlign: 'left' }}>Descripción</th>
                          <th style={thStyle}>Unidad</th>
                          <th style={thStyle}>Cant.</th>
                          {!isConsolidado && <th style={thStyle}>C.Unit.Prov.</th>}
                          {!isConsolidado && <th style={thStyle}>Subtotal Prov.</th>}
                          {!isConsolidado && <th style={thStyle}>Rentab.%</th>}
                          <th style={thStyle}>C.Unit.Venta</th>
                          <th style={thStyle}>Subtotal Venta</th>
                          <th style={thStyle}>Días</th>
                          {!isConsolidado && <th style={thStyle}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {etapa.items.map((it) => (
                          <ItemRow
                            key={it.id}
                            item={it}
                            isConsolidado={isConsolidado}
                            onUpdate={(data) => updateItem.mutate({ itemId: it.id, data })}
                            onRemove={() => removeItem.mutate(it.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!isConsolidado && (
                    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--lineSoft)' }}>
                      <button onClick={() => addItem.mutate(etapa.id)} disabled={addItem.isPending} style={addBtnStyle}>+ Agregar ítem</button>
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
          <button onClick={() => addEtapa.mutate()} disabled={addEtapa.isPending} style={addBtnStyle}>+ Agregar rubro</button>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, isConsolidado, onUpdate, onRemove }: {
  item: Etapa['items'][0]; isConsolidado: boolean;
  onUpdate: (data: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  // subtotalProv y subtotalVenta vienen calculados del backend
  const subtotalProv = item.costoProveedor;   // costoUnitario × cantidad
  const subtotalVenta = item.precioVenta;      // costoUnitarioVenta × cantidad

  return (
    <tr style={{ borderTop: '1px solid var(--lineSoft)', opacity: item.cantidad > 0 ? 1 : 0.45 }}>
      <td style={{ ...tdStyle, textAlign: 'left', minWidth: 180 }}>
        {isConsolidado ? item.desc : (
          <EditableText value={item.desc} onCommit={(v) => onUpdate({ desc: v })} />
        )}
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{item.codigoCifras}</div>
      </td>
      <td style={tdStyle}>
        {isConsolidado ? item.unidad : (
          <select
            value={item.unidad}
            onChange={(e) => onUpdate({ unidad: e.target.value })}
            style={{ fontSize: 11.5, padding: '3px 4px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
          >
            {UNIDADES.map((u) => <option key={u}>{u}</option>)}
          </select>
        )}
      </td>
      <td style={tdStyle}>
        {isConsolidado ? item.cantidad : (
          <EditableNumber value={item.cantidad} onCommit={(v) => onUpdate({ cantidad: v })} width={52} />
        )}
      </td>
      {/* Columnas solo para SOCIO */}
      {!isConsolidado && (
        <td style={tdStyle}>
          <EditableNumber value={item.costoUnitario} onCommit={(v) => onUpdate({ costoUnitario: v })} width={80} />
        </td>
      )}
      {!isConsolidado && (
        <td style={{ ...tdStyle, color: 'var(--muted)' }}>{money(subtotalProv)}</td>
      )}
      {!isConsolidado && (
        <td style={tdStyle}>
          <EditableNumber value={item.rentabilidad} onCommit={(v) => onUpdate({ rentabilidad: v })} width={48} suffix="%" />
        </td>
      )}
      {/* C.Unit.Venta: auto pero editable */}
      <td style={tdStyle}>
        {isConsolidado
          ? money(item.costoUnitarioVenta)
          : <EditableNumber value={item.costoUnitarioVenta} onCommit={(v) => onUpdate({ costoUnitarioVenta: v })} width={80} />
        }
      </td>
      {/* Subtotal Venta */}
      <td style={{ ...tdStyle, fontWeight: 600 }}>{money(subtotalVenta)}</td>
      {/* Días hábiles */}
      <td style={tdStyle}>
        {isConsolidado ? item.dias : (
          <EditableNumber value={item.dias} onCommit={(v) => onUpdate({ dias: Math.round(v) })} width={44} />
        )}
      </td>
      {!isConsolidado && (
        <td style={tdStyle}>
          <button onClick={onRemove} title="Eliminar ítem"
            style={{ fontSize: 13, color: 'var(--bad)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
        </td>
      )}
    </tr>
  );
}

function EditableText({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  const [dirty, setDirty] = useState(false);
  const commit = () => { if (dirty && local !== value) onCommit(local); setDirty(false); };
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input value={local} onChange={(e) => { setLocal(e.target.value); setDirty(true); }}
        onKeyDown={(e) => e.key === 'Enter' && commit()} onBlur={commit}
        style={{ width: 160, padding: '3px 5px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 12 }} />
      {dirty && <OkBtn onMouseDown={commit} />}
    </span>
  );
}

function EditableNumber({ value, onCommit, width = 64, suffix }: { value: number; onCommit: (v: number) => void; width?: number; suffix?: string }) {
  const [local, setLocal] = useState(String(value));
  const [dirty, setDirty] = useState(false);

  const commit = () => {
    let raw = local.replace(/^=/, '');
    let n: number;
    try { n = Function('"use strict"; return (' + raw + ')')(); } catch { n = parseFloat(raw); }
    if (!Number.isNaN(n)) { onCommit(n); setLocal(String(n)); }
    setDirty(false);
  };

  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      <input value={local}
        onChange={(e) => { setLocal(e.target.value); setDirty(true); }}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        onBlur={() => { if (!dirty) return; commit(); }}
        style={{ width, textAlign: 'right', padding: '3px 5px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 12 }} />
      {suffix && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{suffix}</span>}
      {dirty && <OkBtn onMouseDown={commit} />}
    </span>
  );
}

function OkBtn({ onMouseDown }: { onMouseDown: () => void }) {
  return (
    <button onMouseDown={(e) => { e.preventDefault(); onMouseDown(); }}
      style={{ padding: '2px 6px', fontSize: 10.5, borderRadius: 4, border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', cursor: 'pointer', lineHeight: 1 }}>
      OK
    </button>
  );
}

const srcBtnStyle: React.CSSProperties = { fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer' };
const addBtnStyle: React.CSSProperties = { fontSize: 12.5, color: 'var(--accent)', background: 'transparent', border: '1px dashed var(--accent)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' };
const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '6px 8px', textAlign: 'right' };
