import { useCallback, useEffect, useRef, useState } from 'react'
import { getIncident, PanoptesApiError, submitApproval } from '../services/panoptesApi'
import type { ApprovalDecision, ApprovalResponse, IncidentDetailResponse } from '../types/panoptes'
import { isAwaitingDecision } from '../utils/incidentPresentation'

interface ActionState {
  incidentId: string | null; decision: ApprovalDecision | null
  phase: 'idle' | 'checking' | 'submitting' | 'reconciling' | 'success' | 'error' | 'uncertain'
  message: string | null; receipt: ApprovalResponse | null; refreshError: string | null
  needsRefresh: boolean; startedAt: number
}
const initial: ActionState = { incidentId: null, decision: null, phase: 'idle', message: null, receipt: null, refreshError: null, needsRefresh: false, startedAt: 0 }
interface Callbacks { onDetail: (data: IncidentDetailResponse) => void; onDashboardRefresh: () => void }

export function useApprovalAction(callbacks: Callbacks) {
  const [state, setState] = useState<ActionState>(initial)
  const locked = useRef(false)
  const mounted = useRef(false)
  const latestCallbacks = useRef(callbacks)
  useEffect(() => { latestCallbacks.current = callbacks }, [callbacks])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const confirm = useCallback(async (id: string, decision: ApprovalDecision) => {
    if (locked.current) return false
    locked.current = true
    const startedAt = Date.now()
    let sent = false
    const update = (next: ActionState) => { if (mounted.current) setState(next) }
    const base = { ...initial, incidentId: id, decision, startedAt }
    update({ ...base, phase: 'checking' })
    try {
      const current = await getIncident(id)
      if (!mounted.current) return false
      latestCallbacks.current.onDetail(current)
      if (!isAwaitingDecision(current.incident)) {
        update({ ...base, phase: 'error', message: 'This incident no longer has a pending approval. No decision was submitted.' })
        latestCallbacks.current.onDashboardRefresh()
        return true
      }
      update({ ...base, phase: 'submitting' })
      sent = true
      const receipt = await submitApproval(id, decision)
      update({ ...base, phase: 'reconciling', receipt, message: receipt.message, needsRefresh: true })
      if (mounted.current) latestCallbacks.current.onDashboardRefresh()
      try {
        const fresh = await getIncident(id)
        if (mounted.current) latestCallbacks.current.onDetail(fresh)
        update({ ...base, phase: 'success', receipt, message: receipt.message })
      } catch (error) {
        update({ ...base, phase: 'success', receipt, message: receipt.message, needsRefresh: true, startedAt: Date.now(),
          refreshError: `Decision accepted, but the updated incident could not be fetched. ${error instanceof Error ? error.message : 'Refresh failed.'}` })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Decision request failed.'
      const knownRejection = error instanceof PanoptesApiError && (error.kind === 'backend' || (error.kind === 'http' && !!error.status && error.status >= 400 && error.status < 500))
      const phase = sent && !knownRejection ? 'uncertain' : 'error'
      update({ ...base, phase, message, needsRefresh: sent, startedAt: Date.now() })
      if (sent) {
        // A transport failure is not proof that the backend rejected the decision.
        if (mounted.current) latestCallbacks.current.onDashboardRefresh()
        try {
          const fresh = await getIncident(id)
          if (mounted.current) latestCallbacks.current.onDetail(fresh)
          update({ ...base, phase, message })
        } catch (readError) {
          update({ ...base, phase, message, needsRefresh: true, startedAt: Date.now(),
            refreshError: readError instanceof Error ? readError.message : 'Could not reconcile incident state.' })
        }
      }
    } finally { locked.current = false }
    return true
  }, [])
  const observeDetail = useCallback((data: IncidentDetailResponse, fetchedAt: string | null) => {
    setState(previous => previous.needsRefresh && previous.incidentId === data.incident.incident_id
      && fetchedAt && Date.parse(fetchedAt) >= previous.startedAt
      && !['checking', 'submitting', 'reconciling'].includes(previous.phase)
      ? { ...previous, needsRefresh: false, refreshError: null } : previous)
  }, [])
  const busy = ['checking', 'submitting', 'reconciling'].includes(state.phase)
  return { ...state, busy, confirm, observeDetail }
}
