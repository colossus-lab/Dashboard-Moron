import { useState } from 'react';
import { LOCALIDADES, type Localidad, type MuroMessage } from '../../types/muro';
import { postMessage, MuroApiError } from '../../lib/muroApi';

const MAX_BODY = 500;
const MAX_NICK = 40;

interface Props {
  defaultLocalidad?: Localidad;
  onPosted?: (msg: MuroMessage) => void;
}

export function MessageForm({ defaultLocalidad, onPosted }: Props) {
  const [localidad, setLocalidad] = useState<Localidad>(
    defaultLocalidad ?? LOCALIDADES[0].id,
  );
  const [nickname, setNickname] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const remaining = MAX_BODY - body.length;
  const canSubmit = body.trim().length > 0 && body.length <= MAX_BODY && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const { message } = await postMessage({
        localidad,
        nickname: nickname.trim() || undefined,
        body: body.trim(),
      });
      setBody('');
      setNickname('');
      setSuccess(true);
      onPosted?.(message);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      console.error('[muro] postMessage falló', err);
      if (err instanceof MuroApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(`Ocurrió un error: ${err.message}`);
      } else {
        setError('Ocurrió un error. Intentá de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="muro-form" onSubmit={handleSubmit} noValidate>
      <div className="muro-form-row">
        <label className="muro-form-field">
          <span className="muro-form-label">Localidad</span>
          <select
            className="muro-form-input"
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value as Localidad)}
            disabled={submitting}
          >
            {LOCALIDADES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="muro-form-field">
          <span className="muro-form-label">
            Apodo <span className="muro-form-label-hint">(opcional)</span>
          </span>
          <input
            className="muro-form-input"
            type="text"
            maxLength={MAX_NICK}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Vecin@ de Haedo"
            disabled={submitting}
          />
        </label>
      </div>

      <label className="muro-form-field">
        <span className="muro-form-label">Mensaje</span>
        <textarea
          className="muro-form-textarea"
          rows={4}
          maxLength={MAX_BODY}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Contá qué pasa en tu barrio, qué funciona, qué falta…"
          disabled={submitting}
          required
        />
        <span
          className={`muro-form-counter${remaining < 40 ? ' is-warning' : ''}`}
          aria-live="polite"
        >
          {remaining} caracteres restantes
        </span>
      </label>

      {error && (
        <div className="muro-form-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="muro-form-success" role="status">
          {'¡Listo! Tu mensaje ya está en el muro.'}
        </div>
      )}

      <div className="muro-form-actions">
        <p className="muro-form-hint">
          Los mensajes son anónimos y públicos. Evitá insultos y datos personales.
        </p>
        <button
          type="submit"
          className="muro-form-submit"
          disabled={!canSubmit}
        >
          {submitting ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
    </form>
  );
}
