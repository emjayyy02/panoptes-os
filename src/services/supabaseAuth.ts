import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthConfig } from '../config/env'

let storageKey = ''
let client: SupabaseClient | undefined
let operator: string | null = null
let boundary = new AbortController()
let onAccessFailure: ((status: 401 | 403) => void) | undefined

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const config = getAuthConfig()
    // Isolate the SDK's BroadcastChannel as well as its storage between tabs.
    const tabId = sessionStorage.getItem('panoptes.auth.tab') ?? crypto.randomUUID()
    sessionStorage.setItem('panoptes.auth.tab', tabId)
    storageKey = `panoptes.auth.session.${tabId}`
    client = createClient(config.url, config.key, {
      auth: { storage: sessionStorage, storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error',
        signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) }) },
    })
  }
  return client
}

export function setOperatorIdentity(id: string | null) {
  if (operator === id) return
  boundary.abort()
  boundary = new AbortController()
  operator = id
}

export function registerAccessFailure(handler: (status: 401 | 403) => void) {
  onAccessFailure = handler
  return () => { if (onAccessFailure === handler) onAccessFailure = undefined }
}

export function reportAccessFailure(status: 401 | 403) {
  setOperatorIdentity(null)
  onAccessFailure?.(status)
}

export async function getApiSession() {
  const signal = boundary.signal
  const expectedOperator = operator
  if (!expectedOperator) throw new Error('Sign in before requesting Panoptes data.')
  const { data, error } = await getSupabaseClient().auth.getSession()
  if (signal.aborted) throw new DOMException('Session changed', 'AbortError')
  if (error || !data.session || data.session.user.id !== expectedOperator) {
    reportAccessFailure(401)
    throw new Error('Your session has ended. Sign in again.')
  }
  return { token: data.session.access_token, operator: expectedOperator, signal }
}

export async function verifyOperatorSession(token: string, signal: AbortSignal): Promise<string> {
  const response = await fetch('/api/panoptes/session', {
    credentials: 'omit', cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
  })
  if (response.status === 401 || response.status === 403) throw new OperatorAccessError(response.status)
  if (!response.ok) throw new Error('Operator access could not be checked. Try again.')
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !('success' in body) || body.success !== true || !('operator' in body) || typeof body.operator !== 'string') throw new Error('Operator access could not be checked. Try again.')
  return body.operator
}

export class OperatorAccessError extends Error {
  status: 401 | 403
  constructor(status: 401 | 403) { super(status === 403 ? 'This account is not an authorized Panoptes operator.' : 'Your session has ended. Sign in again.'); this.status = status }
}

export async function signOutCurrentSession() {
  setOperatorIdentity(null)
  try {
    const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' })
    if (error) throw new Error('Signed out on this tab. The Auth service could not confirm server-side logout.')
  } finally { sessionStorage.removeItem(storageKey) }
}
