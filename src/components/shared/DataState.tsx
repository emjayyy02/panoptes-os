import styles from './DataState.module.css'
export function DataState({ kind, title, message }: { kind: 'loading' | 'empty' | 'error'; title: string; message?: string }) {
  return <div className={`${styles.state} ${kind === 'error' ? styles.error : ''}`} role={kind === 'error' ? 'alert' : 'status'}>
    <span className={styles.marker} aria-hidden="true">{kind === 'error' ? '!' : '—'}</span>
    <div><p className={styles.title}>{title}</p>{message && <p className={styles.message}>{message}</p>}</div>
    {kind === 'loading' && <div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div>}
  </div>
}
export function RefreshWarning({ error }: { error: string }) {
  return <p className={styles.warning} role="alert">Refresh failed. Showing the last successful response. {error}</p>
}
