import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ClienteConObras } from '../types/obras';
import type { ObraDetalle, Presupuesto } from '../types/presupuesto';

type Proveedor = { id: string; nombre: string; contacto: string | null };
type OrdenCompra = {
  id: string;
  codigo: string;
  estado: string;
  proveedor: Proveedor;
  items: { id: string; cantidad: number; item: { desc: string; codigoCifras: string } }[];
};

export function OrdenesCompra() {
  const qc = useQueryClient();
  const [obraId, setObraId] = useState('');
  const [presupuestoId, setPresupuestoId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [seleccion, setSeleccion] = useState<Record<string, number>>({});

  const { data: clientes } = useQuery({ queryKey: ['obras'], queryFn: () => api.get<ClienteConObras[]>('/obras') });
  const { data: proveedores } = useQuery({ queryKey: ['proveedores'], queryFn: () => api.get<Proveedor[]>('/proveedores') });
  const { data: ordenes } = useQuery({ queryKey: ['ordenes-compra'], queryFn: () => api.get<OrdenCompra[]>('/ordenes-compra') });
  const { data: obraDetalle } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => api.get<ObraDetalle>(`/obras/${obraId}`),
    enabled: !!obraId,
  });
  const { data: presupuesto } = useQuery({
    queryKey: ['presupuesto', presupuestoId],
    queryFn: () => api.get<Presupuesto>(`/presupuestos/${presupuestoId}`),
    enabled: !!presupuestoId,
  });

  const obras = useMemo(() => (clientes ?? []).flatMap((c) => c.obras.map((o) => ({ ...o, cliente: c.nombre }))), [clientes]);

  const createOC = useMutation({
    mutationFn: () =>
      api.post('/ordenes-compra', {
        presupuestoId,
        proveedorId,
        items: Object.entries(seleccion).map(([itemId, cantidad]) => ({ itemId, cantidad })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordenes-compra'] });
      setSeleccion({});
      setProveedorId('');
    },
  });

  const marcarRecibida = useMutation({
    mutationFn: (id: string) => api.patch(`/ordenes-compra/${id}/recibida`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordenes-compra'] }),
  });

  return (
    <div>
      <div className="section-label">Compras</div>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>Órdenes de Compra</h1>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 10 }}>
          Armar orden desde un presupuesto
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <select value={obraId} onChange={(e) => { setObraId(e.target.value); setPresupuestoId(''); }} style={selectStyle}>
            <option value="">Elegir obra…</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.cliente} · {o.nombre}
              </option>
            ))}
          </select>
          <select value={presupuestoId} onChange={(e) => setPresupuestoId(e.target.value)} style={selectStyle} disabled={!obraDetalle}>
            <option value="">Elegir presupuesto…</option>
            {obraDetalle?.cotizaciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} · {c.nombre}
              </option>
            ))}
          </select>
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} style={selectStyle}>
            <option value="">Elegir proveedor…</option>
            {(proveedores ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {presupuesto && (
          <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--lineSoft)', borderRadius: 8 }}>
            {presupuesto.etapas.flatMap((et) =>
              et.items
                .filter((it) => it.cantidad > 0)
                .map((it) => (
                  <label key={it.id} style={itemRowStyle}>
                    <input
                      type="checkbox"
                      checked={it.id in seleccion}
                      onChange={(e) =>
                        setSeleccion((s) => {
                          const next = { ...s };
                          if (e.target.checked) next[it.id] = it.cantidad;
                          else delete next[it.id];
                          return next;
                        })
                      }
                    />
                    <span style={{ flex: 1 }}>
                      {it.codigoCifras} · {it.desc}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>
                      {it.cantidad} {it.unidad}
                    </span>
                  </label>
                )),
            )}
          </div>
        )}

        <button
          onClick={() => createOC.mutate()}
          disabled={!presupuestoId || !proveedorId || Object.keys(seleccion).length === 0 || createOC.isPending}
          style={{ ...btnStyle, marginTop: 14 }}
        >
          Emitir orden de compra
        </button>
      </div>

      <div className="section-label" style={{ marginBottom: 10 }}>
        Historial reciente
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {(ordenes ?? []).map((oc) => (
          <div key={oc.id} style={rowStyle}>
            <span style={{ fontWeight: 600 }}>{oc.codigo}</span>
            <span>{oc.proveedor.nombre}</span>
            <span>{oc.items.length} ítem(s)</span>
            <span style={{ color: oc.estado === 'RECIBIDA' ? 'var(--good)' : 'var(--warn)' }}>{oc.estado}</span>
            {oc.estado !== 'RECIBIDA' ? (
              <button onClick={() => marcarRecibida.mutate(oc.id)} style={smallBtnStyle}>
                Marcar recibida
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = { flex: 1, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' };
const itemRowStyle: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', fontSize: 12.5, borderBottom: '1px solid var(--lineSoft)' };
const btnStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--green)', border: 'none', borderRadius: 7, padding: '10px 16px', cursor: 'pointer' };
const smallBtnStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--green)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 10px', background: 'var(--surf)', cursor: 'pointer' };
const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '90px 1.5fr 90px 90px 130px', gap: 10, alignItems: 'center', padding: '10px 14px', fontSize: 12.5, borderTop: '1px solid var(--lineSoft)' };
