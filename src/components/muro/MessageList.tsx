import { MessageCard } from './MessageCard';
import type { MuroMessage } from '../../types/muro';

interface Props {
  messages: MuroMessage[];
  loading: boolean;
  error: string | null;
  onReported: (id: string) => void;
}

export function MessageList({ messages, loading, error, onReported }: Props) {
  if (loading && messages.length === 0) {
    return (
      <div className="muro-list muro-list-state" aria-busy="true">
        <div className="muro-skeleton" />
        <div className="muro-skeleton" />
        <div className="muro-skeleton" />
      </div>
    );
  }

  if (error === 'not_configured') {
    return (
      <div className="muro-list-state muro-empty">
        <p>
          El muro todavía no está configurado. Pedile al equipo que conecte
          Supabase en el dashboard de Vercel.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="muro-list-state muro-empty">
        <p>No pudimos cargar los mensajes. Refrescá en un rato.</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="muro-list-state muro-empty">
        <p>Todavía no hay mensajes en esta localidad. ¡Sé el primero!</p>
      </div>
    );
  }

  return (
    <ul className="muro-list" aria-live="polite">
      {messages.map((m) => (
        <li key={m.id}>
          <MessageCard message={m} onReported={onReported} />
        </li>
      ))}
    </ul>
  );
}
