import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionReveal } from '../components/ui/SectionReveal';
import { LocalidadFilter } from '../components/muro/LocalidadFilter';
import { MessageForm } from '../components/muro/MessageForm';
import { MessageList } from '../components/muro/MessageList';
import { useMuroMessages } from '../hooks/useMuroMessages';
import type { Localidad, MuroMessage } from '../types/muro';

type Filter = Localidad | 'all';

export function Muro() {
  const [filter, setFilter] = useState<Filter>('all');
  const { messages, loading, error, prependMessage, configured } =
    useMuroMessages(filter);

  // Título de la pestaña solo en esta página.
  useEffect(() => {
    const prev = document.title;
    document.title = 'Muro comunitario · Morón en números';
    return () => {
      document.title = prev;
    };
  }, []);

  const handlePosted = useCallback(
    (msg: MuroMessage) => {
      // Si el filtro activo no incluye la localidad del mensaje, movemos
      // el filtro a "Todas" para que el autor vea su publicación.
      if (filter !== 'all' && msg.localidad !== filter) {
        setFilter('all');
      }
      prependMessage(msg);
    },
    [filter, prependMessage],
  );

  const handleReported = useCallback(
    (id: string) => {
      // Cuando el threshold se cruza, el backend pasa el status a "reported"
      // y la subscripción realtime ya se encarga de removerlo. Este callback
      // queda para posibles efectos visuales futuros.
      void id;
    },
    [],
  );

  const counter = useMemo(() => {
    if (loading && messages.length === 0) return 'Cargando…';
    if (messages.length === 0) return 'Sin mensajes todavía';
    return `${messages.length} ${messages.length === 1 ? 'mensaje' : 'mensajes'}`;
  }, [messages.length, loading]);

  return (
    <div className="muro-page">
      <SectionReveal>
        <header className="muro-hero">
          <div className="muro-hero-badge">
            <span className="muro-hero-badge-dot" />
            Comunidad · Morón
          </div>
          <h1 className="muro-hero-title">Muro comunitario</h1>
          <p className="muro-hero-subtitle">
            Un espacio anónimo para que los vecinos y vecinas de Morón, Castelar,
            Haedo, El Palomar y Villa Sarmiento dejen un mensaje, cuenten qué les
            pasa en su barrio y se lean entre sí.
          </p>
          <ul className="muro-hero-rules">
            <li>Publicás sin cuenta, identificado solo con un apodo opcional.</li>
            <li>Cualquiera puede reportar contenido ofensivo o spam.</li>
            <li>Los mensajes con varios reportes se ocultan automáticamente.</li>
          </ul>
        </header>
      </SectionReveal>

      <SectionReveal>
        <section className="muro-compose" aria-label="Publicar un mensaje">
          <h2 className="muro-section-title">Dejá tu mensaje</h2>
          {!configured ? (
            <p className="muro-disabled">
              El muro está deshabilitado porque faltan las credenciales de
              Supabase (<code>NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>).
            </p>
          ) : (
            <MessageForm onPosted={handlePosted} />
          )}
        </section>
      </SectionReveal>

      <SectionReveal>
        <section className="muro-feed" aria-label="Mensajes publicados">
          <div className="muro-feed-header">
            <h2 className="muro-section-title">Lo que dice Morón</h2>
            <span className="muro-feed-counter" aria-live="polite">
              {counter}
            </span>
          </div>
          <LocalidadFilter value={filter} onChange={setFilter} />
          <MessageList
            messages={messages}
            loading={loading}
            error={error}
            onReported={handleReported}
          />
        </section>
      </SectionReveal>
    </div>
  );
}
