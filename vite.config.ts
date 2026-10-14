import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { UserConfig } from 'vite'
import { readGatewayPort, validatePublicKey } from './server/config.js'

export default defineConfig(({ command, mode, isPreview }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (env.VITE_SUPABASE_PUBLISHABLE_KEY) validatePublicKey(env.VITE_SUPABASE_PUBLISHABLE_KEY)
  const useDevProxy = command === 'serve' && !isPreview
  const gatewayPort = useDevProxy ? readGatewayPort(loadEnv(mode, process.cwd(), 'PANOPTES_GATEWAY_PORT').PANOPTES_GATEWAY_PORT) : undefined
  return {
    plugins: [react()],
    build: { sourcemap: false },
    server: {
      host: '127.0.0.1', port: 5173, strictPort: true,
      // Fixed local gateway target; Vite never calls n8n or reads its credentials.
      proxy: useDevProxy ? { '/api/panoptes': { target: `http://127.0.0.1:${gatewayPort}`, changeOrigin: false } } : {},
    },
    preview: { proxy: {} },
  }
})
