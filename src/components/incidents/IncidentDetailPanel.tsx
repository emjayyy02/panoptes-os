import { useEffect, useRef } from 'react'
import type { ApprovalDecision } from '../../types/panoptes'
import type { useIncidentDetail } from '../../hooks/useIncidentDetail'
import type { useApprovalAction } from '../../hooks/useApprovalAction'
import { DataState, RefreshWarning } from '../shared/DataState'
import { StatusBadge } from '../shared/StatusBadge'
import { IncidentEvidence } from './IncidentEvidence'
import { RecoveryDetails } from './RecoveryDetails'
import { IncidentTimeline } from './IncidentTimeline'
import { OperatorDecisionControls } from './OperatorDecisionControls'
import { timestamp } from '../../utils/formatters'
import styles from './IncidentDetail.module.css'

export function IncidentDetailPanel({ selectedId, detail, action, onClose, onDecision }: {
  selectedId: string | null; detail: ReturnType<typeof useIncidentDetail>; action: ReturnType<typeof useApprovalAction>
  onClose: () => void; onDecision: (decision: ApprovalDecision) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = dialog.current
    if (selectedId && node && !node.open) { node.showModal(); heading.current?.focus({ preventScroll: true }) }
    if (!selectedId && node?.open) node.close()
    if (selectedId && body.current) body.current.scrollTop = 0
  }, [selectedId])
  useEffect(() => {
    if (!selectedId) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [selectedId])
  return <dialog ref={dialog} className={styles.panel} aria-labelledby="incident-panel-title" onCancel={event => { event.preventDefault(); if (!action.busy) onClose() }}>
    <header className={styles.header}>
      <div className={styles.headerIdentity}><p className={styles.eyebrow}>INCIDENT EXPLORER</p><h2 id="incident-panel-title" ref={heading} tabIndex={-1}>Incident detail</h2><p className={styles.incidentId}>{selectedId}</p></div>
      <button className={styles.button} disabled={action.busy} onClick={onClose} aria-label="Close incident detail">Close</button>
    </header>
    <div className={styles.toolbar}>
      {detail.data && <StatusBadge value={detail.data.incident.recovery.status} />}
      <span className={styles.caption} role="status">{detail.loading ? 'Refreshing detail…' : detail.error ? 'Detail unavailable or stale' : detail.data ? `Fetched ${timestamp(detail.fetchedAt, true)}` : ''}</span>
      <button className={styles.button} disabled={!selectedId || detail.loading || action.busy} onClick={detail.refresh}>Refresh incident</button>
    </div>
    <div ref={body} className={styles.panelBody} aria-busy={detail.loading}>
      {detail.data ? <>
        {detail.error && <RefreshWarning error={detail.error} />}
        <IncidentEvidence incident={detail.data.incident} />
        <RecoveryDetails incident={detail.data.incident} />
        <OperatorDecisionControls incident={detail.data.incident} fresh={!detail.loading && !detail.error} action={action} onDecision={onDecision} />
        <IncidentTimeline events={detail.data.timeline} />
      </> : <DataState kind={detail.loading ? 'loading' : 'error'} title={detail.loading ? 'Loading incident detail' : detail.notFound ? 'Incident not found' : 'Incident detail unavailable'} message={detail.error ?? 'Requesting live evidence and event history from Panoptes.'} />}
    </div>
  </dialog>
}
