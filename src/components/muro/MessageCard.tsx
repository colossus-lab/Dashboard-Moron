import { useState } from 'react';
import { LOCALIDADES, type MuroMessage } from '../../types/muro';
import { reportMessage, MuroApiError } from '../../lib/muroApi';

interface Props {
  message: MuroMessage;
  onReported?: (id: string) => void;
}

const LOCALIDAD_LABEL = Object.fromEntries(
  LOCALIDADES.map((l) => [l.id, l.label]),
) as Record<string, string>;

export function MessageCard({ message, onReported }: Props) {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nickname = message.nickname?.trim() || 'Anónimo';
  const locality = LOCALIDAD_LABEL[message.localidad] ?? message.localidad;

  async function handleReport() {
    if (reporting || reported) return;
    const ok = window.confirm(
      '¿Reportar este mensaje por ofensivo, spam o inapropiado? Si varios vecinos lo reportan, se oculta automáticamente.',
    );
    if (!ok) return;

    setReporting(true);
    setError(null);
    try {
      const res = await reportMessage(message.id);
      setReported(true);
      if (res.status && res.status !== 'ok') {
        onReported?.(message.id);
      }
    } catch (err) {
      if (err instanceof MuroApiError) {
        setError(err.message);
      } else {
        setError('No se pudo reportar el mensaje.');
      }
    } finally {
      setReporting(false);
    }
  }

  return (
    <article className="muro-card" aria-label={`Mensaje de ${nickname} en ${locality}`}>
      <header className="muro-card-header">
        <div className="muro-card-meta">
          <span className="muro-card-nickname">{nickname}</span>
          <span className="muro-card-dot" aria-hidden="true">·</span>
          <span className="muro-card-locality">{locality}</span>
        </div>
        <time className="muro-card-time" dateTime={message.created_at}>
          {formatRelative(message.created_at)}
        </time>
      </header>

      <p className="muro-card-body">{message.body}</p>

      <footer className="muro-card-footer">
        {error && <span className="muro-card-error">{error}</span>}
        <button
          type="button"
          className="muro-card-report"
          onClick={handleReport}
          disabled={reporting || reported}
          aria-label="Reportar este mensaje"
        >
          {reported ? 'Reportado' : reporting ? 'Reportando…' : 'Reportar'}
        </button>
      </footer>
    </article>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'hace unos segundos';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `hace ${day} d`;
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
