import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

type Archivo = {
  id?: string;
  nombre: string | null;
  extension: string;
  version?: number;
  autor?: string | null;
  modifiedTime?: string;
  webViewLink?: string;
};
type Carpeta = { id: string; nombre: string; fuente: 'mock' | 'drive'; archivos: Archivo[] };

const BADGE_COLOR: Record<string, string> = { pdf: 'var(--bad)', dwg: 'var(--green)', jpg: 'var(--warn)', skp: '#6b7a9e' };

// El ID se extrae de la URL de Drive: drive.google.com/drive/folders/<ID>
function extractFolderId(input: string) {
  const match = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

export function PlanosTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [folderInput, setFolderInput] = useState('');
  const { data } = useQuery({ queryKey: ['planos', obraId], queryFn: () => api.get<Carpeta[]>(`/obras/${obraId}/planos`) });

  const linkFolder = useMutation({
    mutationFn: () => api.patch(`/obras/${obraId}/drive-folder`, { driveFolderId: extractFolderId(folderInput) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planos', obraId] });
      setFolderInput('');
    },
  });

  const esDrive = data?.[0]?.fuente === 'drive';

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
        <input
          placeholder="Pegá el link de la carpeta de Drive…"
          value={folderInput}
          onChange={(e) => setFolderInput(e.target.value)}
          style={inputStyle}
        />
        <button onClick={() => linkFolder.mutate()} disabled={!folderInput.trim() || linkFolder.isPending} style={btnStyle}>
          Vincular carpeta
        </button>
        {esDrive && <span style={{ fontSize: 11.5, color: 'var(--good)', fontWeight: 600 }}>● Conectado a Drive</span>}
      </div>

      {data && data.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>Sin planos todavía. Vinculá una carpeta de Drive o conectá la integración en Configuración.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {(data ?? []).map((carpeta) => (
          <div key={carpeta.id} style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--surf2)', fontWeight: 600, fontSize: 13.5 }}>
              {carpeta.nombre} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {carpeta.archivos.length} archivos</span>
            </div>
            {carpeta.archivos.map((a, i) => (
              <div key={a.id ?? i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--lineSoft)', fontSize: 12.5 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '.06em',
                    color: '#fff',
                    background: BADGE_COLOR[a.extension] ?? 'var(--muted)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    flex: 'none',
                  }}
                >
                  {(a.extension || 'doc').toUpperCase()}
                </span>
                {a.webViewLink ? (
                  <a href={a.webViewLink} target="_blank" style={{ flex: 1, color: 'var(--ink)' }}>
                    {a.nombre}
                  </a>
                ) : (
                  <span style={{ flex: 1 }}>{a.nombre}</span>
                )}
                {a.version != null && <span style={{ color: 'var(--muted)' }}>v{a.version}</span>}
                {a.modifiedTime && <span style={{ color: 'var(--muted)' }}>{new Date(a.modifiedTime).toLocaleDateString('es-AR')}</span>}
                {a.autor && <span style={{ color: 'var(--muted)' }}>{a.autor}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { flex: 1, padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 };
const btnStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: '#fff', background: 'var(--green)', border: 'none', borderRadius: 7, padding: '9px 14px', cursor: 'pointer', whiteSpace: 'nowrap' };
