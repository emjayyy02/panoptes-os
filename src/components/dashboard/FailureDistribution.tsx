import { label, number } from '../../utils/formatters'
import { DataState } from '../shared/DataState'
import styles from './FailureDistribution.module.css'
const knownTypes = new Set(['REQUEST_TIMEOUT', 'RATE_LIMIT', 'INVALID_DATA', 'AUTH_FAILURE'])
export function FailureDistribution({ failures }: { failures: Record<string, number> }) {
  const entries = Object.entries(failures).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  if (!entries.length || total === 0) return <DataState kind="empty" title="No failure distribution" message="The summary contains no recorded failures." />
  return <div className={styles.distribution}>
    <ul>{entries.map(([type, count]) => <li key={type}>
      <div className={styles.label}><span title={type}>{label(type)}</span><span className={styles.count}>{number(count)} <small>{Math.round(count / total * 100)}%</small></span></div>
      <div className={`${styles.track} ${knownTypes.has(type) ? '' : styles.neutral}`} aria-hidden="true"><span style={{ width: `${count / total * 100}%` }} /></div>
    </li>)}</ul>
    <p>Share of {number(total)} classified incidents. UNKNOWN is a backend classification.</p>
  </div>
}
