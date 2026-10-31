import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          // El análisis de VirusTotal puede tardar cerca de un minuto.
          timeout: 180000,
          proxyTimeout: 180000,
        },
      },
      watch: {
        // Polling solo donde hace falta: Docker/VMs con bind mounts (en
        // Windows/macOS el fs montado no emite eventos inotify). En dev nativo
        // queda apagado para no quemar CPU. Activar con VITE_USE_POLLING=true.
        usePolling: process.env.VITE_USE_POLLING === 'true',
      },
    },
  }
})
