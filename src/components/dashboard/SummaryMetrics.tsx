import type { SummaryResponse } from '../../types/panoptes'
import { number } from '../../utils/formatters'
import styles from './SummaryMetrics.module.css'
export function SummaryMetrics({ summary }: { summary: SummaryResponse }) {
  const metrics = [
    { label: 'Total incidents', value: summary.totals.incidents, note: 'Recorded incidents', tone: '' },
    { label: 'Escalated', value: summary.totals.escalated, note: 'Escalated recovery state', tone: 'danger' },
    { label: 'Awaiting approval', value: summary.totals.awaiting_approval, note: 'Pending operator decision', tone: 'warning' },
    { label: 'Human required', value: summary.totals.requiring_human, note: 'Flagged for human attention', tone: 'warning' },
    { label: 'Retry attempts', value: summary.recovery.total_retry_attempts, note: 'Attempts across incidents', tone: '' },
    { label: 'Recovery pending', value: summary.totals.recovery_pending, note: 'Pending recovery state', tone: 'active' },
  ]
  return <dl className={styles.metrics}>{metrics.map(metric => <div className={styles.metric} key={metric.label}>
    <dt>{metric.label}</dt><dd data-metric-value className={`${styles.value} ${styles[metric.tone] ?? ''}`}>{number(metric.value)}</dd><dd className={styles.note}>{metric.note}</dd>
  </div>)}</dl>
}
