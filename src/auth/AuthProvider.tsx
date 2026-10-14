import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from './authContext'
import type { AuthState } from './authContext'
import { getSupabaseClient, OperatorAccessError, registerAccessFailure, setOperatorIdentity, signOutCurrentSession, verifyOperatorSession } from '../services/supabaseAuth'

const signedOut: AuthState = { phase: 'signedOut', operator: null, email: null, message: null }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [setup] = useState(() => {
    try { return { client: getSupabaseClient(), message: null } }
    catch (error) { return { client: null, message: error instanceof Error ? error.message : 'Supabase sign-in is not configured.' } }
  })
  const [state, setState] = useState<AuthState>({ ...signedOut, phase: setup.client ? 'loading' : 'configuration', message: setup.message })
  const check = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const authorized = useRef<string | null>(null)

  const checkSession = useCallback(async (session: Session | null) => {
    check.current?.abort()
    const controller = new AbortController()
    check.current = controller
    if (!session) {
      authorized.current = null
      setOperatorIdentity(null)
      if (mounted.current) setState(signedOut)
      return
    }
    if (authorized.current === session.user.id) return
    setOperatorIdentity(null)
    if (mounted.current) setState({ ...signedOut, phase: 'checking' })
    try {
      const operator = await verifyOperatorSession(session.access_token, controller.signal)
      if (operator !== session.user.id) throw new Error('Operator identity does not match the signed-in account.')
      if (!mounted.current || controller.signal.aborted) return
      authorized.current = operator
      setOperatorIdentity(operator)
      setState({ phase: 'authorized', operator, email: session.user.email ?? null, message: null })
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return
      authorized.current = null
      setOperatorIdentity(null)
      setState({ ...signedOut, phase: error instanceof OperatorAccessError ? error.status === 403 ? 'denied' : 'signedOut' : 'unavailable',
        message: error instanceof OperatorAccessError ? error.message : 'Operator access could not be checked. Try again.' })
      if (error instanceof OperatorAccessError && error.status === 401) void signOutCurrentSession().catch(() => {})
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    let unsubscribe = () => {}
    let removeHandler = () => {}
    if (setup.client) {
      const client = setup.client
      const { data } = client.auth.onAuthStateChange((_event, session) => { if (mounted.current) void checkSession(session) })
      unsubscribe = () => data.subscription.unsubscribe()
      removeHandler = registerAccessFailure(status => {
        check.current?.abort()
        authorized.current = null
        setState({ ...signedOut, phase: status === 403 ? 'denied' : 'signedOut', message: status === 403 ? 'This account is not an authorized Panoptes operator.' : 'Your session has ended. Sign in again.' })
        if (status === 401) void signOutCurrentSession().catch(() => {})
      })
    }
    return () => {
      mounted.current = false
      unsubscribe()
      removeHandler()
      check.current?.abort()
      authorized.current = null
      setOperatorIdentity(null)
    }
  }, [checkSession, setup])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
    if (error) throw new Error('Sign-in failed. Check your email and password, or try again when Auth is available.')
  }, [])
  const signOut = useCallback(async () => {
    check.current?.abort()
    authorized.current = null
    setState(signedOut)
    try { await signOutCurrentSession() }
    catch (error) { if (mounted.current) setState({ ...signedOut, message: error instanceof Error ? error.message : 'Signed out on this tab.' }) }
  }, [])
  const retry = useCallback(() => {
    authorized.current = null
    void getSupabaseClient().auth.getSession().then(({ data }) => checkSession(data.session))
  }, [checkSession])

  return <AuthContext value={{ ...state, signIn, signOut, retry }}>{children}</AuthContext>
}
