import { getApiBase } from '../config/env'
import { isApprovalResponse, isIncidentDetailResponse, isIncidentsResponse, isSummaryResponse } from './panoptesContracts'
import type { ApprovalDecision, ApprovalResponse, IncidentDetailResponse, IncidentsResponse, SummaryResponse } from '../types/panoptes'
import { getApiSession, reportAccessFailure } from './supabaseAuth'

type ErrorKind = 'http' | 'network' | 'timeout' | 'invalid-json' | 'contract' | 'backend'
export class PanoptesApiError extends Error {
  kind: ErrorKind
  status?: number
  constructor(message: string, kind: ErrorKind, status?: number) { super(message); this.name = 'PanoptesApiError'; this.kind = kind; this.status = status }
}

async function request<T>(resource: string, validate: (value: unknown) => value is T, signal?: AbortSignal, body?: object): Promise<T> {
  const endpoint = resource.split('?')[0]
  const timeout = AbortSignal.timeout(20_000)
  const session = await getApiSession()
  const requestSignal = AbortSignal.any([session.signal, timeout, ...(signal ? [signal] : [])])
  const assertCurrentSession = () => {
    if (session.signal.aborted || signal?.aborted) throw new DOMException('Request cancelled', 'AbortError')
  }
  let response: Response
  try {
    response = await fetch(`${getApiBase()}/${resource}`, {
      signal: requestSignal, credentials: 'omit', cache: 'no-store',
      headers: { Authorization: `Bearer ${session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    assertCurrentSession()
    if (timeout.aborted) throw new PanoptesApiError(`/${endpoint} did not respond within 20 seconds. Try refreshing.`, 'timeout')
    if (error instanceof TypeError) throw new PanoptesApiError(`Could not reach /${endpoint}. Check API availability and browser network errors, then refresh.`, 'network')
    throw error
  }
  assertCurrentSession()
  if (response.status === 401 || response.status === 403) {
    reportAccessFailure(response.status)
    throw new PanoptesApiError(response.status === 401 ? 'Your session has ended. Sign in again.' : 'Operator access is no longer available.', 'http', response.status)
  }
  let payload: unknown
  try { payload = await response.json() }
  catch {
    assertCurrentSession()
    if (timeout.aborted) throw new PanoptesApiError(`/${endpoint} response timed out. Try refreshing.`, 'timeout')
    if (!response.ok) throw new PanoptesApiError(`/${endpoint} returned HTTP ${response.status}.`, 'http', response.status)
    throw new PanoptesApiError(`/${endpoint} did not return valid JSON (${response.headers.get('content-type') ?? 'unknown content type'}). Check upstream routing.`, 'invalid-json')
  }
  assertCurrentSession()
  const backendMessage = typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string' ? payload.message : null
  if (!response.ok) throw new PanoptesApiError(backendMessage ?? `/${endpoint} returned HTTP ${response.status}. Try refreshing or check the API.`, 'http', response.status)
  if (typeof payload === 'object' && payload !== null && 'success' in payload && payload.success === false) {
    throw new PanoptesApiError(backendMessage ?? `/${endpoint} reported success: false.`, 'backend', response.status)
  }
  if (!validate(payload)) throw new PanoptesApiError(`/${endpoint} response does not match the Panoptes contract. No replacement data has been displayed.`, 'contract')
  return payload
}
export const getSummary = (signal: AbortSignal): Promise<SummaryResponse> => request('summary', isSummaryResponse, signal)
export const getIncidents = (signal: AbortSignal): Promise<IncidentsResponse> => request('incidents', isIncidentsResponse, signal)
export async function getIncident(id: string, signal?: AbortSignal): Promise<IncidentDetailResponse> {
  const params = new URLSearchParams({ incident_id: id })
  const data = await request(`incident?${params}`, isIncidentDetailResponse, signal)
  if (data.incident.incident_id !== id) throw new PanoptesApiError('Incident response ID does not match the requested incident.', 'contract')
  return data
}
export async function submitApproval(id: string, decision: ApprovalDecision): Promise<ApprovalResponse> {
  const session = await getApiSession()
  const data = await request('approval', isApprovalResponse, session.signal, { incident_id: id, decision })
  if (data.incident_id !== id || data.action !== decision || data.operator !== session.operator) {
    throw new PanoptesApiError('Approval response does not match the submitted incident, decision, or operator. Refresh to check the backend state.', 'contract')
  }
  return data
}
