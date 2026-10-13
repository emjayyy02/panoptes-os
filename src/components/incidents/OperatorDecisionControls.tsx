import type { ApprovalDecision, IncidentDetail } from '../../types/panoptes'
import type { useApprovalAction } from '../../hooks/useApprovalAction'
import { isAwaitingDecision } from '../../utils/incidentPresentation'
import styles from './IncidentDetail.module.css'

export function OperatorDecisionControls({ incident, fresh, action, onDecision }: {
  incident: IncidentDetail; fresh: boolean; action: ReturnType<typeof useApprovalAction>; onDecision: (decision: ApprovalDecision) => void
}) {
  const relevant = action.incidentId === incident.incident_id
  const accepted = relevant && !!action.receipt
  const disabled = !fresh || action.busy || (relevant && action.needsRefresh) || accepted
  return <section className={styles.section} aria-labelledby="decision-title">
    <h3 id="decision-title">Operator decision</h3>
    {relevant && action.message && <div className={styles.actionMessage} role={action.phase === 'error' || action.phase === 'uncertain' ? 'alert' : 'status'}>
      {action.phase === 'uncertain' && <strong>Submission outcome could not be confirmed. </strong>}{action.message}
      {action.phase === 'uncertain' && <p>No automatic retry was sent. Review the latest backend state before another deliberate decision.</p>}
      {action.refreshError && <p>{action.refreshError}</p>}
    </div>}
    {isAwaitingDecision(incident) ? <>
      <p className={styles.prose}>{accepted ? 'A decision has already been accepted in this session. Refresh the incident to inspect its current recovery state.' : 'Panoptes is waiting for a human decision. Approval submits permission to continue recovery; it does not guarantee recovery succeeds.'}</p>
      <div className={styles.actions}>
        <button className={`${styles.button} ${styles.primary}`} disabled={disabled} onClick={() => onDecision('APPROVE')}>Approve recovery</button>
        <button className={`${styles.button} ${styles.reject}`} disabled={disabled} onClick={() => onDecision('REJECT')}>Reject recovery</button>
      </div>
      {!fresh && <p className={styles.caption}>Decision controls require a successful current detail response.</p>}
      {relevant && action.needsRefresh && <p className={styles.caption}>Refresh this incident before making another decision.</p>}
    </> : <p className={styles.caption}>No pending operator decision in the current backend state.</p>}
  </section>
}
