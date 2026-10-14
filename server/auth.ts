import { createClient } from '@supabase/supabase-js'
import type { GatewayConfig } from './config.js'

export class AuthBoundaryError extends Error {
  status: number
  constructor(status: number) {
    super(status === 401 ? 'Sign in to access Panoptes.' : 'Authentication is temporarily unavailable. Try again.')
    this.status = status
  }
}

export type VerifyToken = (token: string, signal: AbortSignal) => Promise<string>

export function createTokenVerifier(config: GatewayConfig): VerifyToken {
  // No session or user bearer token is ever stored on this shared server client.
  const client = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init, redirect: 'error',
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(5_000)]) : AbortSignal.timeout(5_000),
    }) },
  })
  return async (token, signal) => {
    if (signal.aborted) throw new AuthBoundaryError(503)
    try {
      const { data, error } = await client.auth.getUser(token)
      if (signal.aborted) throw new AuthBoundaryError(503)
      if (error) throw new AuthBoundaryError(error.status && [400, 401, 403, 422].includes(error.status) ? 401 : 503)
      if (!data.user?.id || data.user.is_anonymous || !data.user.email) throw new AuthBoundaryError(401)
      return data.user.id
    } catch (error) {
      if (error instanceof AuthBoundaryError) throw error
      throw new AuthBoundaryError(503)
    }
  }
}
