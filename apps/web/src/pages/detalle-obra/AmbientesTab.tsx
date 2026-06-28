import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

type Ambiente = { id: string; nombre: string; nota: string | null; terminado: boolean };

export function AmbientesTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['ambientes', obraId], queryFn: () => api.get<Ambiente[]>(`/obras/${obraId}/ambientes`) });

  const toggleTerminado = useMutation({
    mutationFn: ({ id, terminado }: { id: string; terminado: boolean }) => api.patch(`/obras/${obraId}/ambientes/${id}`, { terminado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ambientes', obraId] }),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {(data ?? []).map((amb) => (
        <div key={amb.id} style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--surf)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 120 }}>
            <div style={phStyle}>Foto ANTES</div>
            <div style={{ ...phStyle, borderLeft: '1px solid var(--lineSoft)' }}>Foto DESPUÉS</div>
          </div>
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <strong style={{ fontSize: 13.5 }}>{amb.nombre}</strong>
              <button
                onClick={() => toggleTerminado.mutate({ id: amb.id, terminado: !amb.terminado })}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  padding: '4px 9px',
                  borderRadius: 6,
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  background: amb.terminado ? 'var(--greenSoft)' : 'var(--surf2)',
                  color: amb.terminado ? 'var(--good)' : 'var(--muted)',
                }}
              >
                {amb.terminado ? 'Terminado' : 'En proceso'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{amb.nota}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const phStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  color: 'var(--muted)',
  background: 'var(--surf2)',
};
