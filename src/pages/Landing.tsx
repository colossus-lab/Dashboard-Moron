import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { getPoblacionReports, getSectorialReports } from '../data/reportRegistry';
import { SectionReveal } from '../components/ui/SectionReveal';
import type { ReportEntry } from '../types/report';

// ─── Macro KPIs for the hero ───
const HERO_STATS = [
  { value: 331183, label: 'Habitantes', suffix: '' },
  { value: 55, label: 'km²', suffix: '' },
  { value: 5, label: 'Localidades', suffix: '' },
  { value: 11, label: 'Informes', suffix: '' },
];

// ─── Resumen del partido (Cuadro 1.2 bloque Gobierno Local, INDEC 2022) ───
// Valores espejados en public/data/resumen.json — fuente única de verdad.
// Se hardcodean acá para renderizar sin loading state en el primer fold.
const RESUMEN = {
  categoria: 'Municipio de única categoría',
  stats: [
    { value: '141.287', label: 'Viviendas totales', hint: '141.238 particulares · 49 colectivas' },
    { value: '329.517', label: 'Población en viviendas particulares' },
    { value: '1.623', label: 'Población en viviendas colectivas', hint: 'Geriátricos, hospitales, hogares de menores, cuarteles' },
    { value: '43', label: 'Personas en situación de calle' },
  ],
};

// ─── Mini-stats per report (contextual data for cards) ───
const MINI_STATS: Record<string, string> = {
  'poblacion-estructura': '331K hab · +3,1%',
  'poblacion-viviendas': '141K viviendas',
  'poblacion-hogares': '129K hogares',
  'poblacion-habitacional-personas': '81% gas de red',
  'poblacion-salud': '76% obra social',
  'poblacion-prevision': '33% percibe',
  'poblacion-actividad-economica': '58,6% empleo',
  'poblacion-educacion': '13,2% universitario',
  'poblacion-fecundidad': '0,99 hijos/mujer',
  'seguridad-snic': '13,4K hechos 2024',
  'seguridad-muertes-viales': '94 víctimas 2017-23',
};

export function Landing() {
  const poblacion = getPoblacionReports();
  const sectoriales = getSectorialReports();

  return (
    <div className="landing-page">
      {/* ─── Animated Hero ─── */}
      <SectionReveal>
        <header className="landing-hero">
          {/* Floating particles */}
          <div className="hero-particles" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="hero-particle" style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>

          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              Datos abiertos · Morón
            </div>
            <h1 className="hero-title">
              Morón en números
            </h1>
            <p className="hero-subtitle">
              Hecho desde{' '}
              <a href="https://colossuslab.org" target="_blank" rel="noopener noreferrer" className="hero-link">
                Colossus Lab
              </a>{' '}
              con datos abiertos vía{' '}
              <a href="https://www.openarg.org" target="_blank" rel="noopener noreferrer" className="hero-link hero-highlight">
                OpenArg
              </a>{' '}
              🇦🇷
            </p>

            {/* ─── Count-up Stats ─── */}
            <div className="hero-stats">
              {HERO_STATS.map((stat, i) => (
                <div key={stat.label}>
                  {i > 0 && <span className="hero-stat-divider" />}
                  <div className="hero-stat">
                    <CountUp target={stat.value} suffix={stat.suffix} />
                    <span className="hero-stat-label">{stat.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>
      </SectionReveal>

      {/* ─── Cuadro resumen — Gobierno local y viviendas colectivas ─── */}
      <SectionReveal>
        <section className="resumen-card" aria-labelledby="resumen-titulo">
          <div className="resumen-card-header">
            <span className="resumen-card-eyebrow">Resumen del partido</span>
            <h2 id="resumen-titulo" className="resumen-card-title">
              {RESUMEN.categoria}
            </h2>
            <p className="resumen-card-source">
              Censo Nacional 2022 (INDEC) — bloque Gobierno Local. Datos no cubiertos en los otros informes.
            </p>
          </div>
          <div className="resumen-card-grid">
            {RESUMEN.stats.map(stat => (
              <div key={stat.label} className="resumen-stat">
                <span className="resumen-stat-value">{stat.value}</span>
                <span className="resumen-stat-label">{stat.label}</span>
                {stat.hint && <span className="resumen-stat-hint">{stat.hint}</span>}
              </div>
            ))}
          </div>
        </section>
      </SectionReveal>

      {/* ─── Intro a categorías ─── */}
      <SectionReveal>
        <div className="categorias-intro">
          <h2 className="categorias-intro-title">Explorá las categorías</h2>
        </div>
      </SectionReveal>

      {/* ─── Población Grid ─── */}
      <SectionReveal>
        <section className="landing-section">
          <div className="section-header">
            <div className="section-number">01</div>
            <div>
              <h2 className="section-title">Quiénes somos en Morón</h2>
              <p className="section-desc">Cuántos somos, cómo vivimos, de dónde venimos. La foto del Censo 2022 del partido.</p>
            </div>
          </div>
          <div className="report-grid">
            {poblacion.map((report, i) => (
              <ReportCard key={report.id} report={report} index={i} />
            ))}
          </div>
        </section>
      </SectionReveal>

      {/* ─── Sectoriales Grid ─── */}
      <SectionReveal>
        <section className="landing-section">
          <div className="section-header">
            <div className="section-number">02</div>
            <div>
              <h2 className="section-title">Seguridad en el barrio</h2>
              <p className="section-desc">25 años de delitos y 7 años de víctimas viales. Lo que pasa en Morón, con números oficiales.</p>
            </div>
          </div>
          <div className="report-grid">
            {sectoriales.map((report, i) => (
              <ReportCard key={report.id} report={report} index={i} />
            ))}
          </div>
        </section>
      </SectionReveal>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="footer-rule" />
        <p>
          <a href="https://colossuslab.org" target="_blank" rel="noopener noreferrer" className="footer-link">
            ColossusLab.org
          </a>{' '}
          •{' '}
          <a href="https://www.openarg.org" target="_blank" rel="noopener noreferrer" className="footer-link">
            OpenArg.org
          </a>
        </p>
      </footer>
    </div>
  );
}

// ═══════ Components ═══════

function ReportCard({ report, index }: { report: ReportEntry; index: number }) {
  const miniStat = MINI_STATS[report.id] || '';

  return (
    <Link
      to={`/${report.slug}`}
      className="report-card"
      style={{
        '--card-color': report.color,
        animationDelay: `${index * 80}ms`,
      } as React.CSSProperties}
    >
      <div className="report-card-glow" aria-hidden="true" />
      <div className="report-card-header">
        <span className="report-card-icon">{report.icon}</span>
        <span className="report-card-arrow">→</span>
      </div>
      <div className="report-card-body">
        <span className="report-card-title">{report.shortTitle}</span>
        <span className="report-card-desc">{report.title}</span>
      </div>
      {miniStat && (
        <div className="report-card-stat">
          <span className="report-card-stat-value">{miniStat}</span>
        </div>
      )}
    </Link>
  );
}

// ─── Count-up Animation ───
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  const animate = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    const duration = 2000;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) animate(); },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);

  const formatted = value >= 1000000
    ? `${(value / 1000000).toFixed(1).replace('.', ',')}M`
    : value >= 1000
    ? value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    : `${value}`;

  return (
    <span ref={ref} className="hero-stat-value">
      {formatted}{suffix}
    </span>
  );
}
