import type { IncidentEvent } from '../../types/panoptes'
import { label, number, timestamp } from '../../utils/formatters'
import { provided } from '../../utils/incidentPresentation'
import { UiIcon } from '../shared/UiIcon'
import type { IconName } from '../shared/UiIcon'
import styles from './IncidentDetail.module.css'

const emphasis: Record<string, IconName> = { APPROVAL_REQUESTED: 'warning', APPROVAL_GRANTED: 'success', APPROVAL_REJECTED: 'warning', INCIDENT_RECOVERED: 'success', INCIDENT_ESCALATED: 'critical', RETRY_FAILED: 'critical', RETRY_EXHAUSTED: 'critical', RECOVERY_ATTEMPTED: 'info' }
const eventTone = (type: string): IconName => Object.hasOwn(emphasis, type) ? emphasis[type] : 'neutral'
export function IncidentTimeline({ events }: { events: IncidentEvent[] }) {
  return <section className={styles.section} aria-labelledby="timeline-title">
    <h3 id="timeline-title">Event timeline <span className={styles.sectionNote}>{number(events.length)} events</span></h3>
    <p className={styles.caption}>Chronological history in the order supplied by Panoptes.</p>
    {!events.length ? <p className={styles.prose}>No events returned for this incident.</p> : <ol className={styles.timeline}>
      {events.map((event, index) => <li key={`${event.event_id}:${index}`} data-event-id={event.event_id}>
        <div className={`${styles.eventMarker} ${styles[eventTone(event.type)]}`} aria-hidden="true"><UiIcon name={eventTone(event.type)} /></div>
        <div className={styles.eventContent}>
          <p className={styles.eventType} title={event.type}>{label(event.type)}</p>
          <time dateTime={event.timestamp} title={event.timestamp} className={styles.eventTime}>{timestamp(event.timestamp, true)}</time>
          <p className={styles.prose}>{provided(event.message)}</p>
          {(event.old_status !== null || event.new_status !== null) && <p className={styles.transition}>{provided(event.old_status)} <span aria-label="to">→</span> {provided(event.new_status)}</p>}
          {event.tool_name !== null && <p className={styles.caption}>Tool <span className={styles.mono}>{event.tool_name}</span></p>}
          {event.tool_result !== null && <details className={styles.result}><summary>Tool result</summary><pre className={styles.raw}>{JSON.stringify(event.tool_result, null, 2)}</pre></details>}
        </div>
      </li>)}
    </ol>}
  </section>
}
