import { label } from '../../utils/formatters'
import styles from './StatusBadge.module.css'
const tone: Record<string, string> = {
  ESCALATED: 'danger', UNSAFE: 'danger', WAITING_FOR_APPROVAL: 'warning', CONDITIONAL: 'warning',
  RECOVERED: 'success', SAFE: 'success', RECOVERING: 'active', VERIFYING: 'active', RECOVERY_PENDING: 'active',
}
export function StatusBadge({ value }: { value: string }) {
  return <span className={`${styles.badge} ${styles[tone[value] ?? 'neutral']}`} title={value}>{label(value)}</span>
}
