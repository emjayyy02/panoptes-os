import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { UserConfig } from 'vite'

export default defineConfig(({ command, mode, isPreview }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '')
  const useDevProxy = command === 'serve' && !isPreview
  const target = env.PANOPTES_DEV_PROXY_TARGET
  if (useDevProxy && (!target || !/^https?:\/\//.test(target))) {
    throw new Error('Set PANOPTES_DEV_PROXY_TARGET to the upstream origin in .env.local.')
  }
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1', port: 5173, strictPort: true,
      proxy: useDevProxy ? {
        '/api/panoptes': {
          target, changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/panoptes(?=\/|\?|$)/, '/webhook/panoptes'),
          headers: { 'ngrok-skip-browser-warning': 'true' },
        },
      } : {},
    },
    preview: { proxy: {} },
  }
})
