import { validateHeaderName, validateHeaderValue } from 'node:http'

export interface GatewayConfig {
  supabaseUrl: string
  supabaseKey: string
  operatorIds: ReadonlySet<string>
  consoleOrigin: string
  n8nOrigin: string
  approvalHeaderName: string
  approvalHeaderValue: string
  development: boolean
  host: string
  port: number
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const loopback = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname)

export function validatePublicKey(key: string): void {
  let allowed = key.startsWith('sb_publishable_')
  if (!allowed) {
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString())
      allowed = claims.role === 'anon'
    } catch { /* Only public publishable or legacy anon keys are accepted. */ }
  }
  if (!allowed) throw new Error('Supabase requires a publishable or legacy anon key; privileged keys are forbidden.')
}

function origin(value: string, name: string, development: boolean): string {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error()
    if (url.protocol !== 'https:' && !(development && url.protocol === 'http:' && loopback(url.hostname))) throw new Error()
    return url.origin
  } catch { throw new Error(`Invalid ${name}: require an HTTPS origin (loopback HTTP is allowed only in development).`) }
}

export function readGatewayPort(value: string | undefined): number {
  const port = Number(value ?? '3001')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PANOPTES_GATEWAY_PORT.')
  return port
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const required = (name: string) => {
    const value = env[name]?.trim()
    if (!value) throw new Error(`Missing ${name}.`)
    return value
  }
  if (env.NODE_ENV !== undefined && !['development', 'test', 'production'].includes(env.NODE_ENV)) throw new Error('Invalid NODE_ENV.')
  const development = env.NODE_ENV !== 'production'
  const supabaseKey = required('SUPABASE_PUBLISHABLE_KEY')
  validatePublicKey(supabaseKey)
  const operatorIds = new Set(required('PANOPTES_OPERATOR_IDS').split(',').map(id => id.trim()))
  if ([...operatorIds].some(id => !uuid.test(id))) throw new Error('PANOPTES_OPERATOR_IDS must contain Supabase user UUIDs.')
  const approvalHeaderName = required('PANOPTES_APPROVAL_HEADER_NAME')
  const approvalHeaderValue = env.PANOPTES_APPROVAL_HEADER_VALUE ?? ''
  try {
    validateHeaderName(approvalHeaderName)
    validateHeaderValue(approvalHeaderName, approvalHeaderValue)
    if (!approvalHeaderValue.trim() || /^(host|cookie|content-length|content-type|connection|transfer-encoding|upgrade|proxy-.*|sec-.*)$/i.test(approvalHeaderName)) throw new Error()
  } catch { throw new Error('Invalid server-only approval header configuration.') }
  const port = readGatewayPort(env.PANOPTES_GATEWAY_PORT)
  return {
    supabaseUrl: origin(required('SUPABASE_URL'), 'SUPABASE_URL', development),
    supabaseKey, operatorIds,
    consoleOrigin: origin(required('PANOPTES_CONSOLE_ORIGIN'), 'PANOPTES_CONSOLE_ORIGIN', development),
    n8nOrigin: origin(required('PANOPTES_N8N_ORIGIN'), 'PANOPTES_N8N_ORIGIN', development),
    approvalHeaderName, approvalHeaderValue, development,
    host: env.PANOPTES_GATEWAY_HOST?.trim() || '127.0.0.1', port,
  }
}
