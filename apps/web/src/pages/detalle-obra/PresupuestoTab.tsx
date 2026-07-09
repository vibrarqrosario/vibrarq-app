import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile } from '../../lib/api';
import { money } from '../../lib/format';
import type { Consolidado, Etapa, Presupuesto } from '../../types/presupuesto';

const UNIDADES = ['Gl', 'un', 'm²', 'm³', 'm', 'kg', 'hs', '%'];

function etapaTotales(etapa: Etapa) {
  let totalCliente = 0; let totalProveedor = 0; let hecho = 0;
  for (const it of etapa.items) {
    const tc = it.subTotalMaterial + it.precioVenta;
    const tp = it.subTotalMaterial + it.costoProveedor;
    totalCliente += tc;
    totalProveedor += tp;
    hecho += tc * (it.avance / 100);
  }
  const avance = totalCliente ? Math.round((hecho / totalCliente) * 100) : 0;
  const margen = totalCliente - totalProveedor;
  const mpct = totalCliente ? Math.round((margen / totalCliente) * 100) : 0;
  return { totalCliente, totalProveedor, avance, margen, mpct };
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
  const cifrasMetaQuery = useQuery({
    queryKey: ['config', 'cifras-meta'],
    queryFn: () => api.get<{ edicion: number | null; fechaCierre: string | null } | null>('/configuracion/cifras/meta'),
    staleTime: 10 * 60 * 1000,
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
    let totalCliente = 0; let totalProveedor = 0;
    for (const et of etapas) { const t = etapaTotales(et); totalCliente += t.totalCliente; totalProveedor += t.totalProveedor; }
    const margen = totalCliente - totalProveedor;
    const mpct = totalCliente ? Math.round((margen / totalCliente) * 100) : 0;
    return { totalCliente, totalProveedor, margen, mpct };
  }, [etapas]);

  // Días hábiles totales (suma de dias × cantidad de items)
  const diasTotales = useMemo(() => {
    let d = 0;
    for (const et of etapas) for (const it of et.items) d += it.dias;
    return d;
  }, [etapas]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Cargando presupuesto…</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 12, marginBottom: 16, background: isConsolidado ? 'var(--greenSoft)' : 'var(--surf)' }}>
        <div>
          <div style={{ fontWeight: 700 }}>{isConsolidado ? 'Obra completa (consolidado)' : (presupuestoQuery.data?.nombre ?? '—')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{isConsolidado ? 'Solo lectura · original + adicionales aprobados' : presupuestoQuery.data?.detalle}</div>
          {diasTotales > 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Plazo estimado: <strong>{diasTotales} días hábiles</strong>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{money(totales.totalCliente)}</div>
          <div style={{ fontSize: 12.5, color: totales.mpct < 28 ? 'var(--bad)' : 'var(--good)' }}>margen {totales.mpct}%</div>
          {!isConsolidado && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                Fuente{cifrasMetaQuery.data?.edicion ? ` (CIFRAS #${cifrasMetaQuery.data.edicion}${cifrasMetaQuery.data.fechaCierre ? ` · ${cifrasMetaQuery.data.fechaCierre}` : ''})` : ''}:
              </span>
              {(['CIFRAS', 'VIBRARQ'] as const).map((f) => (
                <button key={f} onClick={() => aplicarFuente.mutate(f)} disabled={aplicarFuente.isPending} style={srcBtnStyle}>{f}</button>
              ))}
              <button
                onClick={() => setConfirmando(true)}
                style={{ ...srcBtnStyle, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
              >
                ✓ Confirmar presupuesto
              </button>
              <button
                onClick={() => downloadFile(`/presupuestos/${budgetSel}/pdf?variant=cliente`, `Presupuesto-${presupuestoQuery.data?.numero ?? budgetSel}-cliente.pdf`)}
                style={srcBtnStyle}
                title="PDF para enviar al cliente (sin costos internos)"
              >
                ⬇ PDF cliente
              </button>
              <button
                onClick={() => downloadFile(`/presupuestos/${budgetSel}/pdf?variant=proveedor`, `Presupuesto-${presupuestoQuery.data?.numero ?? budgetSel}-proveedor.pdf`)}
                style={srcBtnStyle}
                title="PDF interno con costos de ejecución del proveedor"
              >
                ⬇ PDF proveedor
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmar modal */}
      {confirmando && (
        <div style={{ background: 'var(--surf)', border: '1px solid var(--accent)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ flex: 1, fontSize: 13 }}>
            ¿Confirmar presupuesto? Se eliminarán los ítems con cantidad 0 y el estado pasará a <strong>APROBADO</strong>.
            Plazo estimado: <strong>{diasTotales} días hábiles</strong>.
          </span>
          <button onClick={() => confirmar.mutate()} disabled={confirmar.isPending} style={{ ...srcBtnStyle, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>Confirmar</button>
          <button onClick={() => setConfirmando(false)} style={srcBtnStyle}>Cancelar</button>
        </div>
      )}

      {/* Leyenda columnas */}
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--ink2)' }}>Cols. internas (ocultas al cliente):</span>
        <span>④ C.Mat(un) · ⑤ Subt.Mat · ⑥ C.Ejec(un) · ⑦ Subt.Ejec · ⑧ Rentab.%</span>
      </div>

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
                  <span>{money(t.totalCliente)}</span>
                  <span style={{ color: t.mpct < 28 ? 'var(--bad)' : 'var(--good)', fontWeight: 600 }}>{t.mpct}%</span>
                  <span>{isOpen ? '▾' : '▸'}</span>
                </span>
              </button>

              {isOpen && (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse', minWidth: 1100 }}>
                      <thead>
                        <tr style={{ color: 'var(--muted)', textTransform: 'uppercase', fontSize: 9.5, letterSpacing: '.06em', background: 'var(--surf2)' }}>
                          <th style={{ ...thStyle, textAlign: 'left' }}>① Descripción / Código</th>
                          <th style={thStyle}>② Unid.</th>
                          <th style={thStyle}>③ Cant.</th>
                          {/* Columnas internas — nunca visibles al cliente */}
                          {!isConsolidado && <th style={{ ...thStyle, color: '#b08020' }}>④ C.Mat(un)</th>}
                          {!isConsolidado && <th style={{ ...thStyle, color: '#b08020' }}>⑤ Subt.Mat</th>}
                          {!isConsolidado && <th style={{ ...thStyle, color: '#b08020' }}>⑥ C.Ejec(un)</th>}
                          {!isConsolidado && <th style={{ ...thStyle, color: '#b08020' }}>⑦ Subt.Ejec</th>}
                          {!isConsolidado && <th style={{ ...thStyle, color: '#b08020' }}>⑧ Rentab.%</th>}
                          {/* Columnas visibles al cliente */}
                          <th style={thStyle}>⑨ V.Ejec(un)</th>
                          <th style={thStyle}>⑩ Subt.Ejec</th>
                          <th style={{ ...thStyle, fontWeight: 700 }}>⑪ Total</th>
                          <th style={thStyle}>⑫ Días</th>
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
                      <tfoot>
                        <tr style={{ borderTop: '2px solid var(--line)', background: 'var(--surf2)', fontWeight: 700, fontSize: 11 }}>
                          <td style={{ ...tdStyle, textAlign: 'left' }} colSpan={3}>Subtotal {etapa.nombre}</td>
                          {!isConsolidado && <td style={tdStyle} colSpan={5} />}
                          <td style={tdStyle} />
                          <td style={tdStyle} />
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{money(t.totalCliente)}</td>
                          <td style={tdStyle} />
                          {!isConsolidado && <td style={tdStyle} />}
                        </tr>
                      </tfoot>
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

      {/* Totales generales */}
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <Kpi label="Total cliente" value={money(totales.totalCliente)} />
        {!isConsolidado && <Kpi label="Costo proveedor" value={money(totales.totalProveedor)} dim />}
        {!isConsolidado && <Kpi label="Margen" value={`${money(totales.margen)} (${totales.mpct}%)`} ok={totales.mpct >= 28} />}
        <Kpi label="Días hábiles totales" value={`${diasTotales} días`} />
      </div>
    </div>
  );
}

function Kpi({ label, value, dim, ok }: { label: string; value: string; dim?: boolean; ok?: boolean }) {
  return (
    <div style={{ padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surf)' }}>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, color: dim ? 'var(--ink2)' : ok === false ? 'var(--bad)' : ok === true ? 'var(--good)' : 'var(--ink)' }}>{value}</div>
    </div>
  );
}

function ItemRow({ item, isConsolidado, onUpdate, onRemove }: {
  item: Etapa['items'][0]; isConsolidado: boolean;
  onUpdate: (data: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const total = item.subTotalMaterial + item.precioVenta;

  return (
    <tr style={{ borderTop: '1px solid var(--lineSoft)', opacity: item.cantidad > 0 ? 1 : 0.4 }}>
      {/* ① Descripción */}
      <td style={{ ...tdStyle, textAlign: 'left', minWidth: 200 }}>
        {isConsolidado ? item.desc : (
          <EditableText value={item.desc} onCommit={(v) => onUpdate({ desc: v })} />
        )}
        <div style={{ fontSize: 9.5, color: 'var(--muted)' }}>{item.codigoCifras}</div>
      </td>

      {/* ② Unidad */}
      <td style={tdStyle}>
        {isConsolidado ? item.unidad : (
          <select value={item.unidad} onChange={(e) => onUpdate({ unidad: e.target.value })}
            style={{ fontSize: 11, padding: '3px 4px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}>
            {UNIDADES.map((u) => <option key={u}>{u}</option>)}
          </select>
        )}
      </td>

      {/* ③ Cantidad */}
      <td style={tdStyle}>
        {isConsolidado ? item.cantidad : (
          <EditableNumber value={item.cantidad} onCommit={(v) => onUpdate({ cantidad: v })} width={52} />
        )}
      </td>

      {/* ④ C.Material (un) — solo interno */}
      {!isConsolidado && (
        <td style={{ ...tdStyle, color: '#b08020' }}>
          <EditableNumber value={item.costoMaterial} onCommit={(v) => onUpdate({ costoMaterial: v })} width={80} />
        </td>
      )}

      {/* ⑤ Subt.Material — solo interno */}
      {!isConsolidado && (
        <td style={{ ...tdStyle, color: '#b08020' }}>{money(item.subTotalMaterial)}</td>
      )}

      {/* ⑥ C.Ejecución (un) — solo interno */}
      {!isConsolidado && (
        <td style={{ ...tdStyle, color: '#b08020' }}>
          <EditableNumber value={item.costoUnitario} onCommit={(v) => onUpdate({ costoUnitario: v })} width={80} />
        </td>
      )}

      {/* ⑦ Subt.Ejecución — solo interno (para certificado proveedor) */}
      {!isConsolidado && (
        <td style={{ ...tdStyle, color: '#b08020' }}>{money(item.costoProveedor)}</td>
      )}

      {/* ⑧ Rentabilidad % — solo interno */}
      {!isConsolidado && (
        <td style={{ ...tdStyle, color: '#b08020' }}>
          <EditableNumber value={item.rentabilidad} onCommit={(v) => onUpdate({ rentabilidad: v })} width={48} suffix="%" />
        </td>
      )}

      {/* ⑨ Valor Ejecución (un) — visible al cliente */}
      <td style={tdStyle}>
        {isConsolidado
          ? money(item.costoUnitarioVenta)
          : <EditableNumber value={item.costoUnitarioVenta} onCommit={(v) => onUpdate({ costoUnitarioVenta: v })} width={80} />
        }
      </td>

      {/* ⑩ Subtotal Valor Ejecución — visible al cliente */}
      <td style={{ ...tdStyle, fontWeight: 600 }}>
        {isConsolidado
          ? money(item.precioVenta)
          : <EditableNumber value={item.precioVenta} onCommit={(v) => onUpdate({ precioVenta: v })} width={80} />
        }
      </td>

      {/* ⑪ Total = SubtMaterial + SubtValEjec — visible al cliente */}
      <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--ink)' }}>{money(total)}</td>

      {/* ⑫ Días hábiles */}
      <td style={tdStyle}>
        {isConsolidado ? item.dias : (
          <EditableNumber value={item.dias} onCommit={(v) => onUpdate({ dias: Math.round(v) })} width={44} />
        )}
      </td>

      {/* Eliminar */}
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
        style={{ width: 180, padding: '3px 5px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 11.5 }} />
      {dirty && <OkBtn onMouseDown={commit} />}
    </span>
  );
}

function EditableNumber({ value, onCommit, width = 64, suffix }: { value: number; onCommit: (v: number) => void; width?: number; suffix?: string }) {
  const [local, setLocal] = useState(String(value));
  const [dirty, setDirty] = useState(false);

  const commit = () => {
    const raw = local.replace(/^=/, '');
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
        style={{ width, textAlign: 'right', padding: '3px 5px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 11.5 }} />
      {suffix && <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{suffix}</span>}
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
const thStyle: React.CSSProperties = { padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '5px 7px', textAlign: 'right' };
