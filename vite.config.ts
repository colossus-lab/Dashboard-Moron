import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// En Vercel las envs vienen por `process.env`, no por archivos .env.
// Las inyectamos manualmente con `define` para que estén disponibles en el
// bundle del cliente tanto como VITE_* como NEXT_PUBLIC_*.
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_'])

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = fileEnv[k] ?? process.env[k]
      if (v) return v
    }
    return ''
  }

  const SUPABASE_URL = pick('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
  const SUPABASE_ANON_KEY = pick(
    'VITE_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  )

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(SUPABASE_URL),
      'import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':
        JSON.stringify(SUPABASE_ANON_KEY),
    },
    server: {
      port: 5173,
      open: true,
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  }
})
