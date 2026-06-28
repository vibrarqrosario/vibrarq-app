import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile } from '../../lib/api';
import { money } from '../../lib/format';

type Certificado = {
  id: string;
  periodo: string;
  totalCosto?: number;
  totalVenta: number;
  estadoPago: string;
  pdfProveedorUrl?: string | null;
  pdfClienteUrl: string | null;
};

export function CertificadosTab({ obraId }: { obraId: string }) {
  const [periodo, setPeriodo] = useState('');
  const qc = useQueryClient();

  const { data: certificados, isLoading } = useQuery({
    queryKey: ['certificados', obraId],
    queryFn: () => api.get<Certificado[]>(`/obras/${obraId}/certificados`),
  });

  const createCert = useMutation({
    mutationFn: () => api.post(`/obras/${obraId}/certificados`, { periodo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificados', obraId] });
      setPeriodo('');
    },
  });

  if (isLoading) return <p style={{ color: 'var(--muted)' }}>Cargando certificados…</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          placeholder="Período (ej: Jul 2026)"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          style={inputStyle}
        />
        <button onClick={() => createCert.mutate()} disabled={!periodo || createCert.isPending} style={btnStyle}>
          Generar certificado
        </button>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        {(certificados ?? []).map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              borderTop: '1px solid var(--lineSoft)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{c.periodo}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {c.totalCosto != null ? `costo ${money(c.totalCosto)} · ` : ''}venta {money(c.totalVenta)} · {c.estadoPago}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {c.pdfProveedorUrl && (
                <button onClick={() => downloadFile(`/obras/${obraId}/certificados/${c.id}/pdf?variant=proveedor`)} style={linkStyle}>
                  PDF proveedor
                </button>
              )}
              <button onClick={() => downloadFile(`/obras/${obraId}/certificados/${c.id}/pdf?variant=cliente`)} style={linkStyle}>
                PDF cliente
              </button>
            </div>
          </div>
        ))}
        {certificados?.length === 0 && <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Sin certificados todavía.</div>}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { flex: 1, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' };
const btnStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--green)', border: 'none', borderRadius: 7, padding: '8px 14px', cursor: 'pointer' };
const linkStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--green)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px', background: 'var(--surf)', cursor: 'pointer' };
