import type { IncidentDetail } from '../../types/panoptes'
import { operatorTimeZone, timestamp, label } from '../../utils/formatters'
import { executionHref, provided } from '../../utils/incidentPresentation'
import { StatusBadge } from '../shared/StatusBadge'
import styles from './IncidentDetail.module.css'

export function IncidentEvidence({ incident }: { incident: IncidentDetail }) {
  const { workflow, execution, timestamps, diagnosis } = incident
  const executionUrl = executionHref(execution.url)
  const confidence = diagnosis.confidence >= 0 && diagnosis.confidence <= 1 ? `${Math.round(diagnosis.confidence * 100)}%` : String(diagnosis.confidence)
  return <>
    <section className={styles.section} aria-labelledby="overview-title">
      <h3 id="overview-title">Overview</h3>
      <p className={styles.workflow}>{provided(workflow.name)}</p>
      <dl className={styles.facts}>
        <div><dt>Workflow ID</dt><dd className={styles.mono}>{workflow.id}</dd></div>
        <div><dt>Execution ID</dt><dd>{executionUrl ? <a href={executionUrl} target="_blank" rel="noopener noreferrer">{execution.id} <span className={styles.muted}>(opens new tab)</span></a> : execution.id}</dd></div>
        <div><dt>Failed node</dt><dd>{provided(execution.failed_node)}</dd></div>
        <div><dt>Execution mode</dt><dd>{provided(execution.mode)}</dd></div>
      </dl>
      <p className={styles.caption}>Times in {operatorTimeZone}. Backend timestamps are preserved.</p>
      <dl className={styles.facts}>{(['occurred_at', 'created_at', 'updated_at', 'resolved_at'] as const).map(key => <div key={key}>
        <dt>{label(key)}</dt><dd><time dateTime={timestamps[key] ?? undefined} title={timestamps[key] ?? undefined}>{timestamp(timestamps[key], true)}</time></dd>
      </div>)}</dl>
    </section>
    <section className={styles.section} aria-labelledby="failure-title">
      <h3 id="failure-title">Failure <span className={styles.sectionNote}>Raw execution evidence</span></h3>
      <p className={styles.mono}>{provided(execution.error.name)}</p>
      <pre className={styles.raw}>{provided(execution.error.message)}</pre>
    </section>
    <section className={styles.section} aria-labelledby="diagnosis-title">
      <h3 id="diagnosis-title">AI diagnosis <span className={styles.sectionNote}>Assessment, not authorization</span></h3>
      <dl className={styles.facts}>
        <div><dt>Failure type</dt><dd className={styles.mono}>{label(diagnosis.failure_type)}</dd></div>
        <div><dt>Transience</dt><dd className={styles.mono}>{label(diagnosis.transience)}</dd></div>
        <div><dt>Retry safety</dt><dd><StatusBadge value={diagnosis.retry_safety} /></dd></div>
        <div><dt>Side-effect risk</dt><dd className={styles.mono}>{label(diagnosis.side_effect_risk)}</dd></div>
        <div><dt>Reported confidence</dt><dd title={`Backend confidence: ${diagnosis.confidence}`}>{confidence}</dd></div>
      </dl>
      <p className={styles.prose}>{diagnosis.summary === null ? 'No diagnosis summary recorded.' : diagnosis.summary}</p>
    </section>
  </>
}
