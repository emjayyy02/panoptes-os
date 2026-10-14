import { useEffect, useState } from 'react'
import { ConsoleShell } from './components/layout/ConsoleShell'
import { DashboardPage } from './pages/DashboardPage'
import { IncidentDetailPanel } from './components/incidents/IncidentDetailPanel'
import { OperatorConfirmationDialog } from './components/incidents/OperatorConfirmationDialog'
import type { DecisionDraft } from './components/incidents/OperatorConfirmationDialog'
import { useDashboardData } from './hooks/useDashboardData'
import { useIncidentSelection } from './hooks/useIncidentSelection'
import { useIncidentDetail } from './hooks/useIncidentDetail'
import { useApprovalAction } from './hooks/useApprovalAction'
import { isAwaitingDecision } from './utils/incidentPresentation'
import type { ApprovalDecision } from './types/panoptes'
import styles from './components/incidents/IncidentDetail.module.css'
import { AuthGate } from './auth/AuthGate'
import { useAuth } from './auth/authContext'

export default function App() {
  const { operator } = useAuth()
  return <AuthGate><OperatorConsole key={operator} /></AuthGate>
}

function OperatorConsole() {
  const dashboard = useDashboardData()
  const selection = useIncidentSelection()
  const detail = useIncidentDetail(selection.id, selection.revision)
  const action = useApprovalAction({ onDetail: detail.accept, onDashboardRefresh: dashboard.refresh })
  const { observeDetail } = action
  const [draft, setDraft] = useState<DecisionDraft | null>(null)
  const visibleDraft = draft?.incident.incident_id === selection.id && draft.revision === selection.revision ? draft : null
  useEffect(() => {
    if (detail.data && !detail.error && !detail.loading) observeDetail(detail.data, detail.fetchedAt)
  }, [detail.data, detail.error, detail.loading, detail.fetchedAt, observeDetail])
  const openDecision = (decision: ApprovalDecision) => {
    if (!detail.data || detail.error || detail.loading || action.busy || !isAwaitingDecision(detail.data.incident)) return
    setDraft({ incident: detail.data.incident, decision, revision: selection.revision })
  }
  const confirm = async () => {
    if (!visibleDraft) return
    const submitted = visibleDraft
    const completed = await action.confirm(submitted.incident.incident_id, submitted.decision)
    if (completed) setDraft(previous => previous === submitted ? null : previous)
  }
  return <>
    <ConsoleShell>
      <DashboardPage dashboard={dashboard} onIncidentOpen={selection.open} />
      {action.incidentId && action.incidentId !== selection.id && (action.busy || action.message) && <p role="status" className={styles.backgroundMessage}>Decision for {action.incidentId}: {action.busy ? 'Request in progress. Do not resubmit.' : action.message}</p>}
    </ConsoleShell>
    <IncidentDetailPanel selectedId={selection.id} detail={detail} action={action} onClose={selection.close} onDecision={openDecision} />
    <OperatorConfirmationDialog draft={visibleDraft} action={action} onCancel={() => setDraft(null)} onConfirm={() => { void confirm() }} />
  </>
}
