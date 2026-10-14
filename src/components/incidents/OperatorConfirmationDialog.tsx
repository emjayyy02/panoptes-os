import { useEffect, useRef } from 'react'
import type { ApprovalDecision, IncidentDetail } from '../../types/panoptes'
import type { useApprovalAction } from '../../hooks/useApprovalAction'
import { provided } from '../../utils/incidentPresentation'
import { StatusBadge } from '../shared/StatusBadge'
import styles from './IncidentDetail.module.css'

export interface DecisionDraft { incident: IncidentDetail; decision: ApprovalDecision; revision: number }
export function OperatorConfirmationDialog({ draft, action, onCancel, onConfirm }: {
  draft: DecisionDraft | null; action: ReturnType<typeof useApprovalAction>; onCancel: () => void; onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)
  const restore = useRef<HTMLElement | null>(null)
  const isOpen = !!draft
  useEffect(() => {
    const node = dialog.current
    if (isOpen && node && !node.open) {
      restore.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      node.showModal(); cancel.current?.focus({ preventScroll: true })
    }
    if (!isOpen && node?.open) {
      node.close()
      const heading = document.getElementById('incident-panel-title')
      if (heading?.closest('dialog')?.open) {
        const target = restore.current
        if (target?.isConnected && !target.matches(':disabled') && target.closest('dialog')?.open) target.focus({ preventScroll: true })
        else heading.focus({ preventScroll: true })
      }
    }
  }, [isOpen])
  const incident = draft?.incident
  return <dialog ref={dialog} className={styles.confirmation} aria-labelledby="confirmation-title" aria-describedby="confirmation-description" onCancel={event => { event.preventDefault(); if (!action.busy) onCancel() }} onKeyDown={event => {
    if (event.key !== 'Tab') return
    if (action.busy) { event.preventDefault(); return }
    if (event.shiftKey && document.activeElement === cancel.current) { event.preventDefault(); confirm.current?.focus() }
    if (!event.shiftKey && document.activeElement === confirm.current) { event.preventDefault(); cancel.current?.focus() }
  }}>
    <div className={styles.confirmationContent}>
      <h2 id="confirmation-title">{draft?.decision === 'REJECT' ? 'Reject recovery?' : 'Approve recovery?'}</h2>
      <p id="confirmation-description" className={styles.prose}>{draft?.decision === 'REJECT' ? 'Send a rejection to Panoptes. The backend records the decision and determines the resulting incident state.' : 'Send approval to Panoptes to continue the proposed recovery. The backend still governs recovery and its outcome.'}</p>
      {incident && <>
        <p className={styles.incidentId}>{incident.incident_id}</p><p className={styles.workflow}>{provided(incident.workflow.name)}</p>
        <dl className={styles.facts}>
          <div><dt>Proposed action</dt><dd>{provided(incident.recovery.proposed_action)}</dd></div>
          <div><dt>Retries / budget</dt><dd>{incident.recovery.retry_count} / {incident.recovery.max_retries}</dd></div>
          <div><dt>Retry safety</dt><dd><StatusBadge value={incident.diagnosis.retry_safety} /></dd></div>
          <div><dt>Side-effect risk</dt><dd>{incident.diagnosis.side_effect_risk}</dd></div>
          <div><dt>Idempotency guaranteed</dt><dd>{incident.config.idempotency_guaranteed ? 'Yes' : 'No'}</dd></div>
        </dl>
      </>}
      <p className={styles.caption}>The current incident is fetched again before any decision is submitted.</p>
      <div className={styles.actions}>
        <button ref={cancel} className={styles.button} disabled={action.busy} onClick={onCancel}>Cancel</button>
        <button ref={confirm} className={`${styles.button} ${draft?.decision === 'REJECT' ? styles.reject : styles.primary}`} disabled={action.busy || !draft} onClick={onConfirm}>{action.busy ? action.phase === 'checking' ? 'Checking current state…' : action.phase === 'submitting' ? 'Submitting decision…' : 'Fetching updated incident…' : draft?.decision === 'REJECT' ? 'Confirm rejection' : 'Confirm approval'}</button>
      </div>
    </div>
  </dialog>
}
