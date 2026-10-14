import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useAuth } from './authContext'
import { ConsoleShell } from '../components/layout/ConsoleShell'
import styles from './AuthGate.module.css'

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (auth.phase === 'authorized') return children
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const submittedPassword = password
    setPassword('')
    try { await auth.signIn(email.trim(), submittedPassword) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Sign-in failed. Try again.') }
    finally { setBusy(false) }
  }
  const waiting = auth.phase === 'loading' || auth.phase === 'checking'
  return <ConsoleShell><section className={styles.gate} aria-labelledby="auth-title" aria-busy={waiting || busy}>
    <h1 id="auth-title">{waiting ? 'Checking operator access' : auth.phase === 'signedOut' ? 'Operator sign-in' : auth.phase === 'denied' ? 'Operator access denied' : 'Sign-in unavailable'}</h1>
    {waiting ? <p role="status">Checking your session before loading incident data.</p> : <>
      <p>{auth.phase === 'signedOut' ? 'Sign in with your provisioned operator account to access Panoptes.' : auth.message}</p>
      {auth.phase === 'signedOut' && <form className={styles.form} onSubmit={event => { void submit(event) }}>
        <label htmlFor="operator-email">Email<input id="operator-email" type="email" autoComplete="username" required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
        <label htmlFor="operator-password">Password<input id="operator-password" type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>}
      {(error || (auth.phase === 'signedOut' && auth.message)) && <p role="alert">{error ?? auth.message}</p>}
      {auth.phase === 'unavailable' && <button onClick={auth.retry}>Check access again</button>}
      {(auth.phase === 'denied' || auth.phase === 'unavailable') && <button onClick={() => { setPassword(''); setError(null); void auth.signOut() }}>Sign out</button>}
    </>}
  </section></ConsoleShell>
}
