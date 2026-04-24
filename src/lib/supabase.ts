// Cliente único de Supabase para uso en el browser.
// Lee las credenciales que inyecta la integración de Vercel/Supabase.
// Admite tanto VITE_* como NEXT_PUBLIC_* (configurado en vite.config.ts).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type ImportMetaEnv = Record<string, string | undefined>;

const env = import.meta.env as ImportMetaEnv;

const SUPABASE_URL =
  env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Si no hay credenciales, exportamos `null` y los componentes deben
// mostrar un estado de "no configurado" en vez de crashear.
export const supabase: SupabaseClient | null = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

export { SUPABASE_URL, SUPABASE_ANON_KEY };
