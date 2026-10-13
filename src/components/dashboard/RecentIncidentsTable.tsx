import type { Incident } from '../../types/panoptes'
import { label, recentIncidents, timestamp } from '../../utils/formatters'
import { StatusBadge } from '../shared/StatusBadge'
import { DataState } from '../shared/DataState'
import styles from './RecentIncidentsTable.module.css'
import { incidentHref, isAwaitingDecision } from '../../utils/incidentPresentation'
export function RecentIncidentsTable({ incidents, view, onIncidentOpen }: { incidents: Incident[]; view: 'recent' | 'approval'; onIncidentOpen: (id: string, element: HTMLElement) => void }) {
  const recent = view === 'recent' ? recentIncidents(incidents) : incidents.filter(isAwaitingDecision)
  if (!recent.length) return <DataState kind="empty" title={view === 'recent' ? 'No incidents returned' : 'No pending decisions returned'} message={view === 'recent' ? 'New workflow incidents will appear here after a refresh.' : 'Only incidents with WAITING_FOR_APPROVAL and PENDING appear in this view.'} />
  return <>
    <p className={styles.hint} id="table-hint">Newest occurrence first. Scroll horizontally to see every column.</p>
    <div className={styles.scroll} role="region" aria-label="Recent incidents table" aria-describedby="table-hint" tabIndex={0}>
      <table className={styles.table}>
        <caption className="sr-only">{view === 'recent' ? 'Up to ten most recent returned incidents, sorted by occurred_at descending.' : 'All returned incidents awaiting a pending operator decision.'}</caption>
        <thead><tr><th scope="col">Workflow / incident</th><th scope="col">Failure type</th><th scope="col">Recovery status</th><th scope="col">Retry safety</th><th scope="col">Human required</th><th scope="col">Occurred / updated</th></tr></thead>
        <tbody>{recent.map(incident => <tr key={incident.incident_id} onClick={event => {
          const target = event.target as HTMLElement
          if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || target.closest('a, button') || window.getSelection()?.toString()) return
          const link = event.currentTarget.querySelector('a')
          if (link) onIncidentOpen(incident.incident_id, link)
        }}>
          <th scope="row" className={styles.identity}><a className={styles.incidentLink} href={incidentHref(incident.incident_id)} onClick={event => {
            if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
            event.preventDefault(); onIncidentOpen(incident.incident_id, event.currentTarget)
          }}><span className={styles.workflow}>{incident.workflow.name ?? 'Workflow name unavailable'}</span><span className={styles.id}>{incident.incident_id}</span></a></th>
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
