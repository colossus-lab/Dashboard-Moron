import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  // Exponemos tanto VITE_* como NEXT_PUBLIC_* para aprovechar los env vars
  // que inyecta la integración Supabase de Vercel sin tener que duplicarlos.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    port: 5173,
    open: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
