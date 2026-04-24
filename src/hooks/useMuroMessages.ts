// Hook que trae mensajes del muro con filtro por localidad y los mantiene
// al día con Supabase Realtime (INSERT). Además expone una acción optimista
// para agregar un mensaje recién creado sin esperar al evento realtime.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import type { Localidad, MuroMessage } from '../types/muro';
import { sortByCreatedDesc } from '../lib/muroApi';

const PAGE_SIZE = 50;

type LocalidadFilter = Localidad | 'all';

export interface UseMuroMessagesResult {
  messages: MuroMessage[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  prependMessage: (msg: MuroMessage) => void;
  configured: boolean;
}

export function useMuroMessages(filter: LocalidadFilter): UseMuroMessagesResult {
  const [messages, setMessages] = useState<MuroMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mantenemos el filtro actual en un ref para leerlo dentro de la subscripción
  // realtime sin tener que re-suscribirnos en cada cambio de prop.
  const filterRef = useRef<LocalidadFilter>(filter);
  filterRef.current = filter;

  const fetchMessages = useCallback(async () => {
    if (!SUPABASE_CONFIGURED || !supabase) {
      setLoading(false);
      setError('not_configured');
      return;
    }
    setLoading(true);
    setError(null);

    let query = supabase
      .from('messages')
      .select('id, created_at, localidad, nickname, body, status')
      .eq('status', 'ok')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (filter !== 'all') {
      query = query.eq('localidad', filter);
    }

    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
      setMessages([]);
    } else {
      setMessages((data ?? []) as MuroMessage[]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  // Realtime: escuchamos INSERTs en `messages` y los agregamos si cumplen el filtro.
  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !supabase) return;

    const channel = supabase
      .channel('muro-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const incoming = payload.new as MuroMessage;
          if (incoming.status !== 'ok') return;
          const currentFilter = filterRef.current;
          if (currentFilter !== 'all' && incoming.localidad !== currentFilter) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return sortByCreatedDesc([incoming, ...prev]).slice(0, PAGE_SIZE);
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new as MuroMessage;
          setMessages((prev) => {
            // Si el mensaje pasó a "reported"/"removed", lo sacamos del feed
            if (updated.status !== 'ok') {
              return prev.filter((m) => m.id !== updated.id);
            }
            return prev.map((m) => (m.id === updated.id ? updated : m));
          });
        },
      )
      .subscribe();

    const client = supabase;
    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  const prependMessage = useCallback((msg: MuroMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return sortByCreatedDesc([msg, ...prev]).slice(0, PAGE_SIZE);
    });
  }, []);

  return {
    messages,
    loading,
    error,
    refetch: fetchMessages,
    prependMessage,
    configured: SUPABASE_CONFIGURED,
  };
}
