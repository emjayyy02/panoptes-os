import { label } from '../../utils/formatters'
import { UiIcon } from './UiIcon'
import type { IconName } from './UiIcon'
import styles from './StatusBadge.module.css'
const tone: Record<string, IconName> = {
  ESCALATED: 'critical', FAILED: 'critical', RECOVERY_FAILED: 'critical', RETRY_FAILED: 'critical', UNSAFE: 'critical',
  WAITING_FOR_APPROVAL: 'warning', HUMAN_REQUIRED: 'warning', CONDITIONAL: 'warning',
  RECOVERED: 'success', SUCCESS: 'success', SAFE: 'success',
  RECOVERING: 'info', VERIFYING: 'info', RECOVERY_PENDING: 'info', IN_PROGRESS: 'info',
}
export function StatusBadge({ value }: { value: string }) {
  const semantic = Object.hasOwn(tone, value) ? tone[value] : 'neutral'
  return <span className={`${styles.badge} ${styles[semantic]}`} title={value} data-status={value}>
    <UiIcon name={semantic} /><span>{label(value)}</span>
  </span>
}
