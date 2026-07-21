import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  return {
    plugins: [react()],
    base: './',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    // ⚠️ Nenhuma chave de IA aqui. Toda chamada de IA vai pelo backend
    // (services/aiService.ts → OPENROUTER_API_KEY só no servidor). O antigo
    // `define` embutia a chave do Gemini no bundle — vazou em produção.
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:10004',
          changeOrigin: true,
        },
      },
    },
  }
})
