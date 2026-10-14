import type { SummaryResponse } from '../../types/panoptes'
import { number } from '../../utils/formatters'
import { UiIcon } from '../shared/UiIcon'
import type { IconName } from '../shared/UiIcon'
import styles from './SummaryMetrics.module.css'
export function SummaryMetrics({ summary }: { summary: SummaryResponse }) {
  const attention: { label: string; value: number; note: string; tone: IconName }[] = [
    { label: 'Awaiting approval', value: summary.totals.awaiting_approval, note: 'Pending operator decision', tone: 'warning' },
    { label: 'Escalated', value: summary.totals.escalated, note: 'Escalated recovery state', tone: 'critical' },
    { label: 'Human required', value: summary.totals.requiring_human, note: 'Flagged for human attention', tone: 'warning' },
  ]
  const routine = [
    { label: 'Total incidents', value: summary.totals.incidents },
    { label: 'Retry attempts', value: summary.recovery.total_retry_attempts },
    { label: 'Recovery pending', value: summary.totals.recovery_pending },
  ]
  return <div className={styles.summary}>
    <h2 className={styles.title}>Operator attention</h2>
    <dl className={styles.attention}>{attention.map(metric => <div className={styles.metric} key={metric.label}>
      <dt><UiIcon name={metric.tone} />{metric.label}</dt>
      <dd data-metric-value className={`${styles.value} ${metric.value > 0 ? styles[metric.tone] : ''}`}>{number(metric.value)}</dd>
      <dd className={styles.note}>{metric.note}</dd>
    </div>)}</dl>
    <dl className={styles.routine}>{routine.map(metric => <div key={metric.label}>
      <dt>{metric.label}</dt><dd data-metric-value>{number(metric.value)}</dd>
    </div>)}</dl>
  </div>
}
