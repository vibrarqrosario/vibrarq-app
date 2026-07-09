import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { money } from '../lib/format';
import type { EstimarInput, EstimarResult, Inmueble, Terminacion, TipoObra } from '../types/cotizacion';

type Screen = 'home' | 'wizard' | 'result' | 'exact' | 'done';

const TIPO_OBRA_LABEL: Record<TipoObra, string> = { nueva: 'Obra nueva', remod: 'Remodelación', ampliacion: 'Ampliación' };
const INMUEBLE_LABEL: Record<Inmueble, string> = { casa: 'Casa', depto: 'Departamento', local: 'Local', oficina: 'Oficina', industria: 'Industria' };
const TERM_LABEL: Record<Terminacion, string> = { economica: 'Económica', estandar: 'Estándar', premium: 'Premium' };

export function CotizacionPublica() {
  const [screen, setScreen] = useState<Screen>('home');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<EstimarInput>({
    tipoObra: 'nueva',
    inmueble: 'casa',
    m2: 120,
    plantas: 1,
    banos: 2,
    cocinas: 1,
    term: 'estandar',
  });
  const [resultado, setResultado] = useState<EstimarResult | null>(null);
  const [lead, setLead] = useState({ nombre: '', email: '', telefono: '', ubicacion: '', descripcion: '' });

  useEffect(() => {
    document.documentElement.dataset.theme = 'editorial';
  }, []);

  const estimar = useMutation({
    mutationFn: () => api.post<EstimarResult>('/cotizacion-publica/estimar', form),
    onSuccess: (data) => {
      setResultado(data);
      setScreen('result');
    },
  });

  const enviarExacta = useMutation({
    mutationFn: () => api.post('/cotizacion-publica/exacta', { ...lead, estimacion: resultado ?? undefined }),
    onSuccess: () => setScreen('done'),
  });

  return (
    <div style={{ minHeight: '100svh', background: 'var(--paper)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 30px', maxWidth: 900, margin: '0 auto' }}>
        <strong style={{ letterSpacing: '.2em', fontSize: 14 }}>VIBRARQ</strong>
        <span style={{ fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Estudio de Arquitectura · Rosario
        </span>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 30px 70px' }}>
        {screen === 'home' && (
          <div>
            <div className="section-label" style={{ marginBottom: 14 }}>
              Presupuestos de obra · online
            </div>
            <h1 style={{ fontSize: 40, marginBottom: 16 }}>Tu obra empieza con una idea clara de su costo.</h1>
            <p style={{ color: 'var(--ink2)', maxWidth: 480, marginBottom: 28 }}>
              Contanos qué querés construir y obtené una estimación al instante, con mano de obra y materiales separados.
            </p>
            <div style={{ display: 'flex', gap: 14 }}>
              <button onClick={() => setScreen('wizard')} style={primaryBtn}>
                Calcular estimación →
              </button>
              <button onClick={() => setScreen('exact')} style={secondaryBtn}>
                Pedir cotización exacta
              </button>
            </div>
          </div>
        )}

        {screen === 'wizard' && (
          <div>
            <button onClick={() => setScreen('home')} style={backLink}>
              ← Volver al inicio
            </button>
            <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= step ? 'var(--green)' : 'var(--line)' }} />
              ))}
            </div>

            {step === 1 && (
              <StepCard title="¿Qué tipo de obra es?">
                {(['nueva', 'remod', 'ampliacion'] as TipoObra[]).map((v) => (
                  <Option key={v} active={form.tipoObra === v} onClick={() => setForm((f) => ({ ...f, tipoObra: v }))}>
                    {TIPO_OBRA_LABEL[v]}
                  </Option>
                ))}
              </StepCard>
            )}
            {step === 2 && (
              <StepCard title="¿Qué tipo de inmueble?">
                {(['casa', 'depto', 'local', 'oficina', 'industria'] as Inmueble[]).map((v) => (
                  <Option key={v} active={form.inmueble === v} onClick={() => setForm((f) => ({ ...f, inmueble: v }))}>
                    {INMUEBLE_LABEL[v]}
                  </Option>
                ))}
              </StepCard>
            )}
            {step === 3 && (
              <StepCard title="Superficie y plantas">
                <label style={lblStyle}>Superficie aproximada (m²)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, m2: Math.max(10, f.m2 - 5) }))}
                    style={spinBtnStyle}
                  >−</button>
                  <input
                    type="number"
                    value={form.m2 === 0 ? '' : form.m2}
                    min={10}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setForm((f) => ({ ...f, m2: isNaN(v) ? 0 : v }));
                    }}
                    onBlur={() => setForm((f) => ({ ...f, m2: Math.max(10, f.m2 || 10) }))}
                    style={{ ...inputStyle, width: 100, textAlign: 'center' }}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, m2: f.m2 + 5 }))}
                    style={spinBtnStyle}
                  >+</button>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>m²</span>
                </div>
                <label style={{ ...lblStyle, marginTop: 14 }}>Plantas</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[1, 2, 3].map((p) => (
                    <Option key={p} active={form.plantas === p} onClick={() => setForm((f) => ({ ...f, plantas: p }))}>
                      {p}
                    </Option>
                  ))}
                </div>
              </StepCard>
            )}
            {step === 4 && (
              <StepCard title="Ambientes">
                <label style={lblStyle}>Baños</label>
                <input
                  type="number"
                  value={form.banos}
                  min={0}
                  onChange={(e) => setForm((f) => ({ ...f, banos: Math.max(0, parseInt(e.target.value) || 0) }))}
                  style={inputStyle}
                />
                <label style={{ ...lblStyle, marginTop: 14 }}>Cocinas</label>
                <input
                  type="number"
                  value={form.cocinas}
                  min={0}
                  onChange={(e) => setForm((f) => ({ ...f, cocinas: Math.max(0, parseInt(e.target.value) || 0) }))}
                  style={inputStyle}
                />
              </StepCard>
            )}
            {step === 5 && (
              <StepCard title="Nivel de terminación">
                {(['economica', 'estandar', 'premium'] as Terminacion[]).map((v) => (
                  <Option key={v} active={form.term === v} onClick={() => setForm((f) => ({ ...f, term: v }))}>
                    {TERM_LABEL[v]}
                  </Option>
                ))}
              </StepCard>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step <= 1} style={secondaryBtn}>
                Atrás
              </button>
              {step < 5 ? (
                <button onClick={() => setStep((s) => Math.min(5, s + 1))} style={primaryBtn}>
                  Siguiente
                </button>
              ) : (
                <button onClick={() => estimar.mutate()} disabled={estimar.isPending} style={primaryBtn}>
                  Ver estimación
                </button>
              )}
            </div>
          </div>
        )}

        {screen === 'result' && resultado && (
          <div>
            <button onClick={() => setScreen('wizard')} style={backLink}>
              ← Ajustar respuestas
            </button>
            <div className="section-label">Estimación</div>
            <h1 style={{ fontSize: 38, margin: '6px 0 4px' }}>{money(resultado.total)}</h1>
            <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
              Entre {money(resultado.low)} y {money(resultado.high)} · {money(resultado.porM2)}/m²
            </p>
            {resultado.fuente && (
              <p style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginBottom: 24 }}>
                Valores según {resultado.fuente.nombre}
                {resultado.fuente.fechaCierre ? ` · cierre ${resultado.fuente.fechaCierre}` : ''}
              </p>
            )}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <div style={kpiCard}>
                <div className="section-label">Materiales</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700 }}>{money(resultado.material)}</div>
              </div>
              <div style={kpiCard}>
                <div className="section-label">Mano de obra</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700 }}>{money(resultado.mano)}</div>
              </div>
            </div>
            <div className="section-label" style={{ marginBottom: 10 }}>
              Desglose por rubro
            </div>
            {resultado.desglose.map((d) => (
              <div key={d.nombre} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12.5 }}>{d.nombre}</div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--surf2)', marginTop: 3 }}>
                    <div style={{ height: '100%', width: `${(d.pct / 20) * 100}%`, background: 'var(--green)', borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12.5 }}>{money(d.monto)}</div>
              </div>
            ))}

            {resultado.composicion && (
              <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surf)' }}>
                <div className="section-label" style={{ marginBottom: 10 }}>Composición del precio</div>
                {[
                  ['Costo directo (materiales + ejecución)', resultado.composicion.costoDirecto],
                  [`Gastos generales (${resultado.composicion.gastosGeneralesPct}%)`, resultado.composicion.gastosGenerales],
                  [`Beneficios (${resultado.composicion.beneficiosPct}%)`, resultado.composicion.beneficios],
                  [`IVA (${resultado.composicion.ivaPct}%)`, resultado.composicion.iva],
                ].map(([label, monto]) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ color: 'var(--ink2)' }}>{label as string}</span>
                    <span>{money(monto as number)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 6 }}>
                  <span>Precio final estimado</span>
                  <span>{money(resultado.total)}</span>
                </div>
              </div>
            )}

            {resultado.fuente && (
              <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginTop: 16 }}>
                {resultado.fuente.aclaraciones}
              </p>
            )}

            <button onClick={() => setScreen('exact')} style={{ ...primaryBtn, marginTop: 20 }}>
              Pedir cotización exacta con esta base
            </button>
          </div>
        )}

        {screen === 'exact' && (
          <div>
            <button onClick={() => setScreen('home')} style={backLink}>
              ← Volver al inicio
            </button>
            <div className="section-label">Cotización exacta</div>
            <h1 style={{ fontSize: 32, marginBottom: 18 }}>Contanos tu proyecto</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
              <input placeholder="Nombre" value={lead.nombre} onChange={(e) => setLead((l) => ({ ...l, nombre: e.target.value }))} style={inputStyle} />
              <input placeholder="Email" value={lead.email} onChange={(e) => setLead((l) => ({ ...l, email: e.target.value }))} style={inputStyle} />
              <input placeholder="Teléfono" value={lead.telefono} onChange={(e) => setLead((l) => ({ ...l, telefono: e.target.value }))} style={inputStyle} />
              <input placeholder="Ubicación" value={lead.ubicacion} onChange={(e) => setLead((l) => ({ ...l, ubicacion: e.target.value }))} style={inputStyle} />
              <textarea
                placeholder="Descripción del proyecto"
                value={lead.descripcion}
                onChange={(e) => setLead((l) => ({ ...l, descripcion: e.target.value }))}
                style={{ ...inputStyle, minHeight: 90 }}
              />
              <button onClick={() => enviarExacta.mutate()} disabled={!lead.nombre || !lead.email || enviarExacta.isPending} style={primaryBtn}>
                Enviar
              </button>
            </div>
          </div>
        )}

        {screen === 'done' && (
          <div>
            <div className="section-label">¡Listo!</div>
            <h1 style={{ fontSize: 32 }}>Recibimos tu consulta</h1>
            <p style={{ color: 'var(--ink2)' }}>Nuestro equipo se va a poner en contacto en las próximas 48 horas.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, marginBottom: 16 }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Option({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: active ? '2px solid var(--green)' : '1px solid var(--line)',
        borderRadius: 10,
        background: 'var(--surf)',
        padding: '14px 16px',
        fontSize: 14,
        cursor: 'pointer',
        color: 'var(--ink)',
      }}
    >
      {children}
    </button>
  );
}

const spinBtnStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: 8, border: '2px solid var(--ink)', background: 'var(--surf)', color: 'var(--ink)', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };
const primaryBtn: React.CSSProperties = { background: 'var(--green)', color: '#fff', borderRadius: 9, padding: '13px 22px', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' };
const secondaryBtn: React.CSSProperties = { border: '1px solid var(--green)', borderRadius: 9, padding: '13px 22px', fontSize: 14, fontWeight: 600, color: 'var(--green)', background: 'var(--surf)', cursor: 'pointer' };
const backLink: React.CSSProperties = { fontSize: 12.5, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 };
const lblStyle: React.CSSProperties = { fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 };
const inputStyle: React.CSSProperties = { fontSize: 14, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--surf)', color: 'var(--ink)', width: '100%' };
const kpiCard: React.CSSProperties = { flex: 1, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surf)' };
