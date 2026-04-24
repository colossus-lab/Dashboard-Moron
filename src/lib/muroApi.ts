// Helpers para llamar a las Edge Functions `post-message` y `report-message`.

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED } from './supabase';
import type {
  MuroMessage,
  PostMessageInput,
  PostMessageSuccess,
  ReportMessageResponse,
} from '../types/muro';

export class MuroApiError extends Error {
  code: string;
  status: number;
  extra: Record<string, unknown>;
  constructor(message: string, code: string, status: number, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'MuroApiError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

function functionsUrl(name: string) {
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`;
}

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  if (!SUPABASE_CONFIGURED) {
    throw new MuroApiError(
      'Supabase no está configurado en el frontend.',
      'not_configured',
      0,
    );
  }
  const res = await fetch(functionsUrl(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* noop: respuesta vacía */
  }

  if (!res.ok) {
    const code =
      (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : 'unknown_error');
    throw new MuroApiError(friendlyError(code), code, res.status, (payload as Record<string, unknown>) ?? {});
  }

  return payload as T;
}

export function postMessage(input: PostMessageInput): Promise<PostMessageSuccess> {
  return callFunction<PostMessageSuccess>('post-message', input);
}

export function reportMessage(messageId: string, reason?: string): Promise<ReportMessageResponse> {
  return callFunction<ReportMessageResponse>('report-message', {
    message_id: messageId,
    reason: reason ?? null,
  });
}

function friendlyError(code: string): string {
  switch (code) {
    case 'invalid_localidad':
      return 'Elegí una localidad válida.';
    case 'invalid_body_length':
      return 'El mensaje debe tener entre 1 y 500 caracteres.';
    case 'invalid_nickname_length':
      return 'El apodo puede tener hasta 40 caracteres.';
    case 'banned_word':
      return 'Tu mensaje contiene lenguaje que no está permitido en el muro.';
    case 'rate_limited':
      return 'Estás publicando muy rápido. Probá de nuevo en unos minutos.';
    case 'invalid_message_id':
      return 'No se pudo identificar el mensaje.';
    case 'message_not_found':
      return 'El mensaje ya no existe.';
    case 'not_configured':
      return 'El muro no está configurado todavía.';
    default:
      return 'Ocurrió un error. Probá de nuevo en un rato.';
  }
}

// Util para ordenar/formatear mensajes que vienen de realtime o del SELECT.
export function sortByCreatedDesc(messages: MuroMessage[]): MuroMessage[] {
  return [...messages].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
