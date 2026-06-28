import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

type MoodboardItem = { id: string; tipo: string; label: string | null; hex: string | null };

export function MoodboardTab({ obraId }: { obraId: string }) {
  const { data } = useQuery({ queryKey: ['moodboard', obraId], queryFn: () => api.get<MoodboardItem[]>(`/obras/${obraId}/moodboard`) });

  const materiales = (data ?? []).filter((i) => i.tipo === 'paleta-material');
  const colores = (data ?? []).filter((i) => i.tipo === 'paleta-color');
  const concepto = (data ?? []).find((i) => i.tipo === 'concepto');

  return (
    <div>
      {concepto && (
        <div style={{ marginBottom: 24, padding: 16, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surf)' }}>
          <div className="section-label" style={{ marginBottom: 8 }}>
            Concepto del proyecto
          </div>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 18, margin: 0, fontStyle: 'italic' }}>{concepto.label}</p>
        </div>
      )}

      <div className="section-label" style={{ marginBottom: 10 }}>
        Paleta de materiales
      </div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        {materiales.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: m.hex ?? '#ccc', border: '1px solid rgba(0,0,0,.12)' }} />
            <span style={{ fontSize: 12.5 }}>{m.label}</span>
          </div>
        ))}
      </div>

      <div className="section-label" style={{ marginBottom: 10 }}>
        Paleta cromática
      </div>
      <div style={{ display: 'flex', height: 48, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {colores.map((c) => (
          <div key={c.id} style={{ flex: 1, background: c.hex ?? '#ccc' }} title={c.label ?? ''} />
        ))}
      </div>
    </div>
  );
}
