import type { Incident } from '../../types/panoptes'
import { label, recentIncidents, timestamp } from '../../utils/formatters'
import { StatusBadge } from '../shared/StatusBadge'
import { DataState } from '../shared/DataState'
import styles from './RecentIncidentsTable.module.css'
export function RecentIncidentsTable({ incidents }: { incidents: Incident[] }) {
  const recent = recentIncidents(incidents)
  if (!recent.length) return <DataState kind="empty" title="No incidents returned" message="New workflow incidents will appear here after a refresh." />
  return <>
    <p className={styles.hint} id="table-hint">Newest occurrence first. Scroll horizontally to see every column.</p>
    <div className={styles.scroll} role="region" aria-label="Recent incidents table" aria-describedby="table-hint" tabIndex={0}>
      <table className={styles.table}>
        <caption className="sr-only">Up to ten most recent returned incidents, sorted by occurred_at descending.</caption>
        <thead><tr><th scope="col">Workflow / incident</th><th scope="col">Failure type</th><th scope="col">Recovery status</th><th scope="col">Retry safety</th><th scope="col">Human required</th><th scope="col">Occurred / updated</th></tr></thead>
        <tbody>{recent.map(incident => <tr key={incident.incident_id}>
          <th scope="row" className={styles.identity}><span className={styles.workflow}>{incident.workflow.name ?? 'Workflow name unavailable'}</span><span className={styles.id}>{incident.incident_id}</span></th>
          <td className={styles.failure}>{label(incident.diagnosis.failure_type)}</td>
          <td><StatusBadge value={incident.recovery.status} /></td>
          <td><StatusBadge value={incident.diagnosis.retry_safety} /></td>
          <td><span className={incident.recovery.human_required ? styles.required : styles.notRequired}>{incident.recovery.human_required ? 'Yes' : 'No'}</span></td>
          <td className={styles.time}><time dateTime={incident.timestamps.occurred_at} title={incident.timestamps.occurred_at}>{timestamp(incident.timestamps.occurred_at)}</time><span>Updated <time dateTime={incident.timestamps.updated_at} title={incident.timestamps.updated_at}>{timestamp(incident.timestamps.updated_at)}</time></span></td>
        </tr>)}</tbody>
      </table>
    </div>
  </>
}
