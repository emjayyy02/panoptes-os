import type { IncidentDetail } from '../../types/panoptes'
import { timestamp, label } from '../../utils/formatters'
import { executionHref, provided } from '../../utils/incidentPresentation'
import { StatusBadge } from '../shared/StatusBadge'
import styles from './IncidentDetail.module.css'

export function IncidentEvidence({ incident }: { incident: IncidentDetail }) {
  const { workflow, execution, timestamps, diagnosis } = incident
  const executionUrl = executionHref(execution.url)
  const confidence = diagnosis.confidence >= 0 && diagnosis.confidence <= 1 ? `${Math.round(diagnosis.confidence * 100)}%` : String(diagnosis.confidence)
  return <>
    <section className={styles.section} aria-labelledby="failure-title">
      <h3 id="failure-title">What happened <span className={styles.sectionNote}>Raw execution evidence</span></h3>
      <p className={styles.errorName}>{provided(execution.error.name)}</p>
      <pre className={styles.raw}>{provided(execution.error.message)}</pre>
      <dl className={styles.facts}>
        <div><dt>Workflow ID</dt><dd className={styles.mono}>{workflow.id}</dd></div>
        <div><dt>Execution ID</dt><dd className={styles.mono}>{executionUrl ? <a href={executionUrl} target="_blank" rel="noopener noreferrer">{execution.id} <span className={styles.muted}>(opens new tab)</span></a> : execution.id}</dd></div>
        <div><dt>Failed node</dt><dd>{provided(execution.failed_node)}</dd></div>
        <div><dt>Execution mode</dt><dd>{provided(execution.mode)}</dd></div>
      </dl>
      <p className={styles.caption}>Local time. Backend timestamps are preserved.</p>
      <dl className={styles.facts}>{(['occurred_at', 'created_at', 'updated_at', 'resolved_at'] as const).map(key => <div key={key}>
        <dt>{label(key)}</dt><dd><time dateTime={timestamps[key] ?? undefined} title={timestamps[key] ?? undefined}>{timestamp(timestamps[key], true)}</time></dd>
      </div>)}</dl>
    </section>
    <section className={`${styles.section} ${styles.assessment}`} aria-labelledby="diagnosis-title">
      <h3 id="diagnosis-title">AI assessment <span className={styles.assessmentNote}>Assessment, not authorization</span></h3>
      <p className={styles.prose}>{diagnosis.summary === null ? 'No diagnosis summary recorded.' : diagnosis.summary}</p>
      <dl className={styles.facts}>
        <div><dt>Failure type</dt><dd>{label(diagnosis.failure_type)}</dd></div>
        <div><dt>Transience</dt><dd>{label(diagnosis.transience)}</dd></div>
        <div><dt>Retry safety</dt><dd><StatusBadge value={diagnosis.retry_safety} /></dd></div>
        <div><dt>Side-effect risk</dt><dd>{label(diagnosis.side_effect_risk)}</dd></div>
        <div><dt>Reported confidence</dt><dd title={`Backend confidence: ${diagnosis.confidence}`}>{confidence}</dd></div>
      </dl>
    </section>
  </>
}
