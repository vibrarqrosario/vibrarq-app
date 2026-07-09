import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile } from '../../lib/api';
import { money } from '../../lib/format';

type Certificado = {
  id: string;
  numero: number;
  periodo: string;
  totalCosto?: number;
  totalVenta: number;
  estadoPago: string;
  pdfProveedorUrl?: string | null;
  pdfClienteUrl: string | null;
  createdAt: string;
  pagado: number;
  saldo: number;
};

type Pago = {
  id: string;
  monto: number;
  fecha: string;
  medio: string | null;
  nota: string | null;
  certificado: { numero: number } | null;
};

const ESTADO_PAGO_COLOR: Record<string, string> = { PAGADO: 'var(--good)', PARCIAL: 'var(--warn)', PENDIENTE: 'var(--muted)', VENCIDO: 'var(--bad)' };

type PrepararItem = {
  itemId: string;
  presupuesto: string;
  etapaCode: string;
  etapaNombre: string;
  codigoCifras: string;
  desc: string;
  unidad: string;
  cantidad: number;
  cantidadAnterior: number;
  avanceAnteriorPct: number;
};

type Preparar = {
  numeroProximo: number;
  obraNombre: string;
  clienteNombre: string | null;
  presupuestosAprobados: number;
  items: PrepararItem[];
};

export function CertificadosTab({ obraId }: { obraId: string }) {
  const [armando, setArmando] = useState(false);
  const [avances, setAvances] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Pago: certificado al que se le está registrando un pago (null = ninguno)
  const [pagando, setPagando] = useState<string | null>(null);
  const [pagoForm, setPagoForm] = useState({ monto: '', medio: 'transferencia', nota: '' });
  const qc = useQueryClient();

  const { data: certificados, isLoading } = useQuery({
    queryKey: ['certificados', obraId],
    queryFn: () => api.get<Certificado[]>(`/obras/${obraId}/certificados`),
  });

  const { data: pagos } = useQuery({
    queryKey: ['pagos', obraId],
    queryFn: () => api.get<Pago[]>(`/obras/${obraId}/certificados/pagos`),
  });

  const registrarPago = useMutation({
    mutationFn: (certificadoId: string) =>
      api.post(`/obras/${obraId}/certificados/pagos`, {
        certificadoId,
        monto: parseFloat(pagoForm.monto) || 0,
        medio: pagoForm.medio,
        nota: pagoForm.nota || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificados', obraId] });
      qc.invalidateQueries({ queryKey: ['pagos', obraId] });
      setPagando(null);
      setPagoForm({ monto: '', medio: 'transferencia', nota: '' });
    },
  });

  const eliminarPago = useMutation({
    mutationFn: (pagoId: string) => api.delete(`/obras/${obraId}/certificados/pagos/${pagoId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificados', obraId] });
      qc.invalidateQueries({ queryKey: ['pagos', obraId] });
    },
  });

  const { data: preparar } = useQuery({
    queryKey: ['certificados', obraId, 'preparar'],
    queryFn: () => api.get<Preparar>(`/obras/${obraId}/certificados/preparar`),
    enabled: armando,
  });

  const createCert = useMutation({
    mutationFn: () => {
      const items = Object.entries(avances)
        .map(([itemId, v]) => ({ itemId, cantidadPresente: parseFloat(v) || 0 }))
        .filter((i) => i.cantidadPresente > 0);
      return api.post(`/obras/${obraId}/certificados`, { items });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificados', obraId] });
      setArmando(false);
      setAvances({});
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const totalAvances = useMemo(
    () => Object.values(avances).reduce((s, v) => s + (parseFloat(v) > 0 ? 1 : 0), 0),
    [avances],
  );

  // Agrupar ítems de la planilla por etapa
  const porEtapa = useMemo(() => {
    const map = new Map<string, PrepararItem[]>();
    for (const it of preparar?.items ?? []) {
      const key = `${it.etapaCode} · ${it.etapaNombre}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return [...map.entries()];
  }, [preparar]);

  if (isLoading) return <p style={{ color: 'var(--muted)' }}>Cargando certificados…</p>;

  return (
    <div>
      {/* Acción principal */}
      {!armando && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <button onClick={() => setArmando(true)} style={btnStyle}>
            + Nuevo certificado {certificados?.length ? `(N° ${certificados.length})` : '(N° 0)'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            La fecha se asigna automáticamente al generarlo. Genera PDF cliente y PDF proveedor.
          </span>
        </div>
      )}

      {/* Planilla de avance por cantidad */}
      {armando && (
        <div style={{ border: '1px solid var(--accent)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--surf2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <strong>Certificado N° {preparar?.numeroProximo ?? '…'}</strong>
              <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>
                Cargá la cantidad ejecutada en este período por ítem
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => createCert.mutate()}
                disabled={totalAvances === 0 || createCert.isPending}
                style={{ ...btnStyle, opacity: totalAvances === 0 ? 0.5 : 1 }}
              >
                {createCert.isPending ? 'Generando…' : `✓ Generar certificado (${totalAvances} ítems)`}
              </button>
              <button onClick={() => { setArmando(false); setAvances({}); setError(null); }} style={cancelBtn}>Cancelar</button>
            </div>
          </div>

          {error && <div style={{ padding: '10px 16px', color: 'var(--bad)', fontSize: 12.5, background: 'var(--surf)' }}>{error}</div>}

          {preparar && preparar.items.length === 0 && (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>
              No hay ítems para certificar. El presupuesto tiene que estar <strong>confirmado (CONTRATADO)</strong> y con cantidades cargadas.
            </div>
          )}

          {porEtapa.map(([etapa, items]) => (
            <div key={etapa}>
              <div style={{ padding: '7px 16px', background: 'var(--greenSoft)', fontSize: 12, fontWeight: 700 }}>{etapa}</div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Ítem</th>
                    <th style={thStyle}>U</th>
                    <th style={thStyle}>Contratado</th>
                    <th style={thStyle}>Anterior</th>
                    <th style={thStyle}>Presente</th>
                    <th style={thStyle}>Acumulado</th>
                    <th style={thStyle}>% Acum.</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const presente = parseFloat(avances[it.itemId]) || 0;
                    const acumulado = it.cantidadAnterior + presente;
                    const pct = it.cantidad > 0 ? Math.round((acumulado / it.cantidad) * 100) : 0;
                    const excede = acumulado > it.cantidad;
                    const restante = it.cantidad - it.cantidadAnterior;
                    return (
                      <tr key={it.itemId} style={{ borderTop: '1px solid var(--lineSoft)', opacity: restante <= 0 ? 0.45 : 1 }}>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>
                          {it.desc}
                          <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6 }}>{it.codigoCifras}</span>
                        </td>
                        <td style={tdStyle}>{it.unidad}</td>
                        <td style={tdStyle}>{it.cantidad}</td>
                        <td style={{ ...tdStyle, color: 'var(--muted)' }}>{it.cantidadAnterior}</td>
                        <td style={tdStyle}>
                          {restante > 0 ? (
                            <input
                              type="number"
                              min={0}
                              max={restante}
                              step="any"
                              value={avances[it.itemId] ?? ''}
                              placeholder="0"
                              onChange={(e) => setAvances((s) => ({ ...s, [it.itemId]: e.target.value }))}
                              style={{ ...numInput, borderColor: excede ? 'var(--bad)' : 'var(--line)' }}
                            />
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--good)', fontWeight: 600 }}>Completo</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: presente > 0 ? 700 : 400 }}>{acumulado}</td>
                        <td style={{ ...tdStyle, color: excede ? 'var(--bad)' : pct >= 100 ? 'var(--good)' : 'var(--ink)', fontWeight: 600 }}>
                          {pct}%{excede ? ' ⚠' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Historial */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {(certificados ?? []).map((c) => (
          <div key={c.id} style={{ borderTop: '1px solid var(--lineSoft)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  Certificado N° {c.numero} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· {c.periodo}</span>
                  <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: ESTADO_PAGO_COLOR[c.estadoPago] ?? 'var(--muted)' }}>
                    {c.estadoPago}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(c.createdAt).toLocaleDateString('es-AR')} ·{' '}
                  {c.totalCosto != null ? `proveedor ${money(c.totalCosto)} · ` : ''}cliente {money(c.totalVenta)}
                  {c.pagado > 0 && <> · pagado {money(c.pagado)}</>}
                  {c.saldo > 0.01 && <> · <span style={{ color: 'var(--warn)', fontWeight: 600 }}>saldo {money(c.saldo)}</span></>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {c.saldo > 0.01 && (
                  <button onClick={() => { setPagando(pagando === c.id ? null : c.id); setPagoForm({ monto: String(Math.round(c.saldo)), medio: 'transferencia', nota: '' }); }} style={{ ...linkStyle, color: '#fff', background: 'var(--green)', border: 'none' }}>
                    + Pago
                  </button>
                )}
                {c.pdfProveedorUrl && (
                  <button
                    onClick={() => downloadFile(`/obras/${obraId}/certificados/${c.id}/pdf?variant=proveedor`, `Certificado-${c.numero}-proveedor.pdf`)}
                    style={linkStyle}
                  >
                    ⬇ PDF proveedor
                  </button>
                )}
                <button
                  onClick={() => downloadFile(`/obras/${obraId}/certificados/${c.id}/pdf?variant=cliente`, `Certificado-${c.numero}-cliente.pdf`)}
                  style={linkStyle}
                >
                  ⬇ PDF cliente
                </button>
              </div>
            </div>

            {/* Mini-form de pago */}
            {pagando === c.id && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 16px 14px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Registrar pago:</span>
                <input
                  type="number" min={0} placeholder="Monto"
                  value={pagoForm.monto}
                  onChange={(e) => setPagoForm((f) => ({ ...f, monto: e.target.value }))}
                  style={{ ...inputMini, width: 120 }}
                />
                <select value={pagoForm.medio} onChange={(e) => setPagoForm((f) => ({ ...f, medio: e.target.value }))} style={inputMini}>
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="cheque">Cheque</option>
                  <option value="otro">Otro</option>
                </select>
                <input
                  placeholder="Nota (opcional)"
                  value={pagoForm.nota}
                  onChange={(e) => setPagoForm((f) => ({ ...f, nota: e.target.value }))}
                  style={{ ...inputMini, flex: 1, minWidth: 140 }}
                />
                <button
                  onClick={() => registrarPago.mutate(c.id)}
                  disabled={!(parseFloat(pagoForm.monto) > 0) || registrarPago.isPending}
                  style={btnStyle}
                >
                  {registrarPago.isPending ? 'Guardando…' : 'Confirmar pago'}
                </button>
                <button onClick={() => setPagando(null)} style={cancelBtn}>Cancelar</button>
              </div>
            )}
          </div>
        ))}
        {certificados?.length === 0 && <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Sin certificados todavía.</div>}
      </div>

      {/* Pagos de la obra */}
      {(pagos?.length ?? 0) > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Pagos recibidos</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            {pagos!.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--lineSoft)', fontSize: 12.5 }}>
                <div>
                  <strong>{money(p.monto)}</strong>
                  <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
                    {new Date(p.fecha).toLocaleDateString('es-AR')}
                    {p.certificado != null && <> · Certificado N° {p.certificado.numero}</>}
                    {p.medio && <> · {p.medio}</>}
                    {p.nota && <> · {p.nota}</>}
                  </span>
                </div>
                <button onClick={() => eliminarPago.mutate(p.id)} title="Eliminar pago" style={{ fontSize: 12, color: 'var(--bad)', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700, textAlign: 'right' }}>
              Total cobrado: {money(pagos!.reduce((s, p) => s + p.monto, 0))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--green)', border: 'none', borderRadius: 7, padding: '8px 14px', cursor: 'pointer' };
const cancelBtn: React.CSSProperties = { fontSize: 12.5, color: 'var(--ink2)', background: 'transparent', border: '1px solid var(--line)', borderRadius: 7, padding: '8px 14px', cursor: 'pointer' };
const linkStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--green)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px', background: 'var(--surf)', cursor: 'pointer' };
const thStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'right' };
const numInput: React.CSSProperties = { width: 70, textAlign: 'right', padding: '4px 6px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 12 };
const inputMini: React.CSSProperties = { padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 12 };
