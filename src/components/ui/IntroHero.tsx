import { useState } from 'react';

// IntroHero — overlay de bienvenida (estilo CABA editorial: gradient drift + partículas).
// Reemplaza el typewriter previo. La lógica de "primera visita" vive en FirstVisitIntro.

interface Props {
  onDismiss: () => void;
}

export function IntroHero({ onDismiss }: Props) {
  const [leaving, setLeaving] = useState(false);

  function handleDismiss() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onDismiss, 520);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') handleDismiss();
  }

  return (
    <div
      className={`intro-overlay ${leaving ? 'leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida al Dashboard Morón"
      onKeyDown={handleKey}
      tabIndex={-1}
    >
      <div className="intro-overlay-particles" aria-hidden="true">
        <span /><span /><span /><span /><span /><span />
      </div>

      <div className="intro-overlay-content">
        <span className="intro-badge">Datos abiertos · Morón</span>

        <h1 className="intro-title">En Morón son 331.182 personas y vos.</h1>

        <div className="intro-subtitle">
          <p>
            Construimos esta plataforma desde <strong>Colossus Lab</strong> para
            hacerle llegar a la gente de Morón una radiografía lo más completa
            que pudimos.
          </p>
          <p>
            Tu aporte siempre va a ser nuestro dato más significativo. Podés
            hacerlo a{' '}
            <a href="mailto:devops@colossuslab.org" className="intro-mail">
              devops@colossuslab.org
            </a>
            . Muchas gracias.
          </p>

          <button
            type="button"
            className="intro-cta"
            onClick={handleDismiss}
            autoFocus
          >
            Entrar al Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}
