import react from '@vitejs/plugin-react'
import { validateHeaderName, validateHeaderValue } from 'node:http'
import { defineConfig, loadEnv } from 'vite'
import type { UserConfig, ViteDevServer } from 'vite'

export default defineConfig(({ command, mode, isPreview }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '')
  const useDevProxy = command === 'serve' && !isPreview
  const target = env.PANOPTES_DEV_PROXY_TARGET
  // These values stay in Node-side closures, never in define/import.meta.env or client headers.
  const approvalHeaderName = env.PANOPTES_APPROVAL_HEADER_NAME?.trim() ?? ''
  const approvalHeaderValue = env.PANOPTES_APPROVAL_HEADER_VALUE ?? ''
  let approvalConfigurationError: string | null = null
  if (!approvalHeaderName || !approvalHeaderValue.trim()) {
    approvalConfigurationError = 'Approval proxy is not configured. Set server-only PANOPTES_APPROVAL_HEADER_NAME and PANOPTES_APPROVAL_HEADER_VALUE in .env.local and restart Vite.'
  } else {
    try {
      validateHeaderName(approvalHeaderName)
      validateHeaderValue(approvalHeaderName, approvalHeaderValue)
    } catch {
      // Node validation errors can contain supplied values; never forward or log those errors.
      approvalConfigurationError = 'Approval proxy configuration is invalid. Check the server-only header name/value in .env.local and restart Vite.'
    }
  }
  if (useDevProxy && (!target || !/^https?:\/\//.test(target))) {
    throw new Error('Set PANOPTES_DEV_PROXY_TARGET to the upstream origin in .env.local.')
  }
  return {
    plugins: [react(), ...(useDevProxy ? [{
      name: 'panoptes-approval-config-guard',
      configureServer(server: ViteDevServer) {
        // Runs before Vite's proxy middleware, so missing auth never reaches the webhook.
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url?.split('?')[0] === '/api/panoptes/approval' && approvalConfigurationError) {
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ success: false, message: approvalConfigurationError }))
            return
          }
          next()
        })
      },
    }] : [])],
    server: {
      host: '127.0.0.1', port: 5173, strictPort: true,
      proxy: useDevProxy ? {
        '/api/panoptes': {
          target, changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/panoptes(?=\/|\?|$)/, '/webhook/panoptes'),
          headers: { 'ngrok-skip-browser-warning': 'true' },
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq, req) => {
              // Vite rewrites req.url before proxy.web emits proxyReq.
              if (req.method === 'POST' && req.url?.split('?')[0] === '/webhook/panoptes/approval' && !approvalConfigurationError) {
                proxyReq.setHeader(approvalHeaderName, approvalHeaderValue)
              }
            })
          },
        },
      } : {},
    },
    preview: { proxy: {} },
  }
})
