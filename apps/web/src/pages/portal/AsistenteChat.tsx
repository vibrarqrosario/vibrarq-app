import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

type Mensaje = { role: 'user' | 'assistant'; content: string };

const SUGERENCIAS = ['¿Cómo va mi obra?', '¿Cuál es el próximo paso?', '¿Qué es un certificado de avance?', '¿Vamos en fecha?'];

export function AsistenteChat({ obraId }: { obraId: string }) {
  const [messages, setMessages] = useState<Mensaje[]>([
    { role: 'assistant', content: '¡Hola! Soy el asistente de VIBRARQ y te acompaño con tu obra. ¿Qué querés saber?' },
  ]);
  const [input, setInput] = useState('');

  const send = useMutation({
    mutationFn: (history: Mensaje[]) => api.post<Mensaje>(`/obras/${obraId}/asistente/chat`, { messages: history }),
    onSuccess: (reply) => setMessages((m) => [...m, reply]),
  });

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setInput('');
    send.mutate(next);
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surf)', display: 'flex', flexDirection: 'column', height: 480 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'assistant' ? 'flex-start' : 'flex-end' }}>
            <div
              style={{
                maxWidth: '80%',
                padding: '12px 15px',
                fontSize: 13.5,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                borderRadius: m.role === 'assistant' ? '4px 14px 14px 14px' : '14px 14px 4px 14px',
                background: m.role === 'assistant' ? 'var(--paper)' : 'var(--green)',
                color: m.role === 'assistant' ? 'var(--ink)' : '#fff',
                border: m.role === 'assistant' ? '1px solid var(--line)' : 'none',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {send.isPending && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Escribiendo…</div>}
      </div>

      {messages.length <= 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 16px 12px' }}>
          {SUGERENCIAS.map((s) => (
            <button key={s} onClick={() => submit(s)} style={suggStyle}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--line)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit(input)}
          placeholder="Escribí tu pregunta…"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)' }}
        />
        <button onClick={() => submit(input)} disabled={send.isPending} style={sendStyle}>
          →
        </button>
      </div>
    </div>
  );
}

const suggStyle: React.CSSProperties = { fontSize: 12, padding: '7px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink2)', cursor: 'pointer' };
const sendStyle: React.CSSProperties = { width: 38, height: 38, borderRadius: 9, border: 'none', background: 'var(--green)', color: '#fff', fontSize: 16, cursor: 'pointer' };
