import type { ReactNode } from 'react'
import { ThemeControl } from './ThemeControl'
import styles from './ConsoleShell.module.css'
import { useAuth } from '../../auth/authContext'
import authStyles from '../../auth/AuthGate.module.css'
export function ConsoleShell({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return <>
    <a className="skip-link" href="#main">Skip to dashboard</a>
    <header className={styles.header}>
      <div className={styles.brand}>
        <svg aria-hidden="true" viewBox="0 0 32 32" className={styles.mark}><path d="M3 16 10 6h12l7 10-7 10H10Z" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="16" cy="16" r="5" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/></svg>
        <div><div className={styles.name}>PANOPTES <span>OS</span></div><p>Incident Operations Console</p></div>
      </div>
      <div className={styles.headerTools}><p className={styles.tagline}>Observe <span>·</span> Diagnose <span>·</span> Govern <span>·</span> Recover</p><ThemeControl /></div>
    </header>
    <main id="main" tabIndex={-1} className={styles.main}>
      {auth.phase === 'authorized' && <div className={authStyles.operator}><span className={authStyles.identity}>Signed in as {auth.email ?? auth.operator}</span><button className={authStyles.logout} onClick={() => { void auth.signOut() }}>Sign out</button></div>}
      {children}
    </main>
    <footer className={styles.footer}><span>Panoptes OS · Operator Console</span><span>AI recommends. Deterministic policy governs recovery.</span></footer>
  </>
}
