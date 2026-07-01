import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const SLIDES = [
  { src: '/services/hero.jpg', label: 'VIBRARQ', sub: 'De la idea a la obra' },
  { src: '/services/anteproyecto.jpg', label: 'Anteproyecto', sub: 'La idea toma forma' },
  { src: '/services/proyecto-ejecutivo.jpg', label: 'Proyecto Ejecutivo', sub: 'Del diseño a la obra' },
  { src: '/services/tramites.jpg', label: 'Trámites y Gestión', sub: 'Todo en regla, sin complicaciones' },
  { src: '/services/direccion-obra.jpg', label: 'Dirección de Obra', sub: 'Del proyecto a la realidad' },
];

const SERVICES = [
  { num: '01', title: 'Anteproyecto', desc: 'Definimos los lineamientos principales que darán forma a tu futura obra. Volumetría, orientación, iluminación y diseño funcional.' },
  { num: '02', title: 'Proyecto Ejecutivo', desc: 'Documentación técnica completa lista para construir. Planos, estructuras, instalaciones y detalles constructivos.' },
  { num: '03', title: 'Trámites y Gestión', desc: 'Nos ocupamos de toda la gestión municipal y profesional para que tu proyecto pueda avanzar sin complicaciones.' },
  { num: '04', title: 'Dirección de Obra', desc: 'Acompañamos cada etapa de la construcción para que el proceso sea ordenado, transparente y sin imprevistos.' },
];

export function Landing() {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = 'editorial';
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ fontFamily: 'var(--sans)', background: '#faf9f7', color: '#1a1a1a', minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 40px', background: 'rgba(250,249,247,0.92)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/services/logo.jpg" alt="VIBRARQ" style={{ height: 52, width: 'auto' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontFamily: 'var(--serif)', fontSize: 20, letterSpacing: '0.15em', fontWeight: 400, color: '#1a1a1a' }}>VIBRARQ</span>
        </a>

        {/* Desktop nav links */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }} className="nav-links">
          <a href="#servicios" style={navLinkStyle}>Servicios</a>
          <a href="#cotizar" style={navLinkStyle}>Cotizador</a>
          <a href="https://tiendavibrarq.mitiendanube.com/" target="_blank" rel="noreferrer" style={navLinkStyle}>Tienda</a>
          <a href="https://www.instagram.com/vibrarq.estudio" target="_blank" rel="noreferrer" style={navLinkStyle}>Instagram</a>
          <Link to="/login" style={{
            padding: '8px 20px', borderRadius: 6,
            background: '#4a6741', color: '#fff', textDecoration: 'none',
            fontSize: 13, fontWeight: 600, letterSpacing: '.03em',
          }}>Acceso ↗</Link>
        </div>
      </nav>

      {/* HERO SLIDESHOW */}
      <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        {SLIDES.map((s, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0,
            opacity: i === slide ? 1 : 0,
            transition: 'opacity 1s ease',
          }}>
            <img src={s.src} alt={s.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 100%)',
            }} />
          </div>
        ))}

        {/* Slide text */}
        <div style={{ position: 'absolute', bottom: 80, left: 60, color: '#fff' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.8, marginBottom: 8 }}>
            {String(slide + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
          </div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 48, fontWeight: 400, margin: '0 0 8px', lineHeight: 1.1 }}>
            {SLIDES[slide].label}
          </h2>
          <p style={{ fontSize: 18, opacity: 0.85, margin: 0 }}>{SLIDES[slide].sub}</p>
        </div>

        {/* Dot indicators */}
        <div style={{ position: 'absolute', bottom: 32, left: 60, display: 'flex', gap: 8 }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)} style={{
              width: i === slide ? 24 : 8, height: 8, borderRadius: 4,
              background: '#fff', opacity: i === slide ? 1 : 0.4,
              border: 'none', cursor: 'pointer', transition: 'all .3s',
              padding: 0,
            }} />
          ))}
        </div>

        {/* Scroll hint */}
        <div style={{ position: 'absolute', bottom: 36, right: 60, color: '#fff', opacity: 0.6, fontSize: 12, letterSpacing: '.08em' }}>
          ARQUITECTURA QUE CONECTA CON VOS
        </div>
      </div>

      {/* SERVICIOS */}
      <section id="servicios" style={{ padding: '80px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4a6741', marginBottom: 12 }}>Nuestros servicios</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 38, fontWeight: 400, margin: 0 }}>Acompañamos tu proyecto de principio a fin</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
          {SERVICES.map((sv) => (
            <div key={sv.num} style={{ borderTop: '2px solid #4a6741', paddingTop: 20 }}>
              <div style={{ fontSize: 11, color: '#4a6741', letterSpacing: '.15em', marginBottom: 10 }}>{sv.num}</div>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, margin: '0 0 12px' }}>{sv.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: '#555', margin: 0 }}>{sv.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 40, fontSize: 13, color: '#888', letterSpacing: '.08em', textAlign: 'center' }}>
          VIVIENDAS · LOCALES · REFORMAS · AMPLIACIONES
        </div>
      </section>

      {/* COTIZADOR CTA */}
      <section id="cotizar" style={{ background: '#4a6741', color: '#fff', padding: '64px 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 16 }}>Herramienta online</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 400, margin: '0 0 16px' }}>Calculá el costo aproximado de tu obra</h2>
        <p style={{ fontSize: 15, opacity: 0.85, maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.6 }}>
          Usamos los costos actualizados de la Revista CIFRAS para darte una estimación rápida y confiable. Si necesitás una cotización precisa, te contactamos.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/cotizar" style={{
            padding: '12px 28px', borderRadius: 6, background: '#fff', color: '#4a6741',
            textDecoration: 'none', fontWeight: 700, fontSize: 14,
          }}>Cotizador online →</Link>
          <a href="mailto:vibrarq.rosario@gmail.com" style={{
            padding: '12px 28px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.6)',
            color: '#fff', textDecoration: 'none', fontSize: 14,
          }}>Solicitar cotización exacta</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#1a1a1a', color: '#aaa', padding: '40px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, color: '#fff', letterSpacing: '.15em', marginBottom: 6 }}>VIBRARQ</div>
          <div style={{ fontSize: 12 }}>Rosario, Argentina · <a href="mailto:vibrarq.rosario@gmail.com" style={{ color: '#aaa' }}>vibrarq.rosario@gmail.com</a></div>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
          <a href="https://www.instagram.com/vibrarq.estudio" target="_blank" rel="noreferrer" style={{ color: '#aaa', textDecoration: 'none' }}>Instagram</a>
          <a href="https://tiendavibrarq.mitiendanube.com/" target="_blank" rel="noreferrer" style={{ color: '#aaa', textDecoration: 'none' }}>Tienda</a>
          <Link to="/cotizar" style={{ color: '#aaa', textDecoration: 'none' }}>Cotizador</Link>
          <Link to="/login" style={{ color: '#aaa', textDecoration: 'none' }}>Acceso</Link>
        </div>
      </footer>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: 13, color: '#1a1a1a', textDecoration: 'none',
  letterSpacing: '.03em', opacity: 0.75,
};
