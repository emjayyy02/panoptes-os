import type { IncidentDetail } from '../../types/panoptes'
import { provided } from '../../utils/incidentPresentation'
import { StatusBadge } from '../shared/StatusBadge'
import styles from './IncidentDetail.module.css'

export function RecoveryDetails({ incident }: { incident: IncidentDetail }) {
  const { recovery, config } = incident
  return <>
    <section className={styles.section} aria-labelledby="recovery-title">
      <h3 id="recovery-title">Recovery <span className={styles.sectionNote}>Backend policy and state</span></h3>
      <dl className={styles.facts}>
        <div><dt>Current status</dt><dd><StatusBadge value={recovery.status} /></dd></div>
        <div><dt>Retries / maximum budget</dt><dd className={styles.mono} data-testid="retry-budget">{recovery.retry_count} / {recovery.max_retries}</dd></div>
        <div><dt>Proposed action</dt><dd className={styles.mono}>{provided(recovery.proposed_action)}</dd></div>
        <div><dt>Approval status</dt><dd className={styles.mono}>{recovery.approval_status}</dd></div>
        <div><dt>Human required</dt><dd>{recovery.human_required ? 'Yes' : 'No'}</dd></div>
        <div><dt>Last action</dt><dd className={styles.mono}>{provided(recovery.last_action)}</dd></div>
      </dl>
      {recovery.last_action_result === null ? <p className={styles.caption}>No last-action result recorded.</p>
        : <details className={styles.result}><summary>Last-action result</summary><pre className={styles.raw}>{JSON.stringify(recovery.last_action_result, null, 2)}</pre></details>}
    </section>
    <section className={styles.section} aria-labelledby="config-title">
      <h3 id="config-title">Trusted configuration</h3>
      <dl className={styles.facts}>
        <div><dt>Automatic recovery</dt><dd>{config.auto_recovery_enabled ? 'Enabled' : 'Disabled'}</dd></div>
        <div><dt>Idempotency guaranteed</dt><dd>{config.idempotency_guaranteed ? 'Yes' : 'No'}</dd></div>
      </dl>
      <p className={styles.caption}>Workflow configuration is trusted backend data. The AI diagnosis does not grant recovery permission.</p>
    </section>
  </>
}
