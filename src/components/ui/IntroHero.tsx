import { useEffect, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════
// IntroHero — Overlay de bienvenida para la primera visita.
// Aparece con fondo difuminado negro y escribe el título con efecto
// "typewriter" (caracter por caracter + cursor parpadeante). Al
// terminar el título aparece el subtítulo y un botón para ingresar.
// ═══════════════════════════════════════════════════════════════════

const TITLE = 'En Morón son 331.182 personas y vos.';
const TYPE_SPEED = 55; // ms por caracter
const SUBTITLE_DELAY = 450; // ms tras terminar de escribir

interface Props {
  onDismiss: () => void;
}

export function IntroHero({ onDismiss }: Props) {
  const [typed, setTyped] = useState('');
  const [showSub, setShowSub] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setTyped(TITLE.slice(0, i));
      if (i >= TITLE.length) {
        window.clearInterval(id);
        window.setTimeout(() => setShowSub(true), SUBTITLE_DELAY);
      }
    }, TYPE_SPEED);
    return () => window.clearInterval(id);
  }, []);

  const finished = typed.length >= TITLE.length;

  function handleDismiss() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onDismiss, 520);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!finished) return;
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
      <div className="intro-overlay-scanlines" aria-hidden="true" />
      <div className="intro-overlay-content">
        <h1 className="intro-title">
          <span>{typed}</span>
          <span className={`intro-cursor ${finished ? 'done' : ''}`}>▌</span>
        </h1>

        <div className={`intro-subtitle ${showSub ? 'shown' : ''}`}>
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
            Entrar al Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
