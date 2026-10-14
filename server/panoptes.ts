import { isApprovalResponse, isIncidentDetailResponse, isIncidentsResponse, isSummaryResponse } from '../src/services/panoptesContracts.js'
import type { ApprovalRequest } from '../src/types/panoptes.js'
import type { GatewayConfig } from './config.js'

export class GatewayError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export type Resource = 'incidents' | 'incident' | 'summary' | 'approval'
export type UpstreamFetch = typeof fetch

async function readJson(response: Response): Promise<unknown> {
  if (!response.body) throw new GatewayError(502, 'Panoptes returned an invalid response.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 5 * 1024 * 1024) {
        await reader.cancel()
        throw new GatewayError(502, 'Panoptes returned an oversized response.')
      }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally { reader.releaseLock() }
}

function containsCredential(payload: unknown, credentials: string[]): boolean {
  const pending = [payload]
  while (pending.length) {
    const value = pending.pop()
    if (typeof value === 'string' && credentials.some(credential => value.includes(credential))) return true
    if (typeof value === 'object' && value !== null) {
      for (const [key, item] of Object.entries(value)) pending.push(key, item)
    }
  }
  return false
}

const responseKeys = {
  summary: ['success', 'totals', 'recovery', 'failure_types', 'generated_at'],
  incidents: ['success', 'count', 'incidents'],
  incident: ['success', 'incident', 'timeline'],
  approval: ['success', 'action', 'incident_id', 'operator', 'message', 'previous_status'],
} as const

export async function forwardPanoptes(config: GatewayConfig, resource: Resource, operator: string, token: string,
  signal: AbortSignal, incidentId?: string, approval?: ApprovalRequest, upstreamFetch: UpstreamFetch = fetch): Promise<unknown> {
  const url = new URL(`/webhook/panoptes/${resource}`, config.n8nOrigin)
  if (resource === 'incident') url.searchParams.set('incident_id', incidentId!)
  const headers = new Headers({ Accept: 'application/json' })
  if (config.development) headers.set('ngrok-skip-browser-warning', 'true')
  if (approval) {
    headers.set('Content-Type', 'application/json')
    headers.set(config.approvalHeaderName, config.approvalHeaderValue)
  }
  try {
    const response = await upstreamFetch(url, {
      method: approval ? 'POST' : 'GET', headers, signal, redirect: 'error',
      ...(approval ? { body: JSON.stringify({ incident_id: approval.incident_id, decision: approval.decision, operator }) } : {}),
    })
    // Never pass upstream infrastructure/auth errors through as operator-session errors.
    if (!response.ok) {
      await response.body?.cancel()
      if (response.status === 404 && resource === 'incident') throw new GatewayError(404, 'Incident not found.')
      if (resource === 'approval' && [400, 409, 422].includes(response.status)) throw new GatewayError(409, 'Panoptes declined this decision. Refresh the incident before continuing.')
      throw new GatewayError(502, 'Panoptes is temporarily unavailable. Refresh to check the current state.')
    }
    const payload = await readJson(response)
    if (containsCredential(payload, [config.approvalHeaderValue, token])) throw new GatewayError(502, 'Panoptes returned an invalid response.')
    if (typeof payload === 'object' && payload !== null && 'success' in payload && payload.success === false) {
      throw new GatewayError(resource === 'approval' ? 409 : 502, 'Panoptes could not complete this request. Refresh to check the current state.')
    }
    const valid = resource === 'incidents' ? isIncidentsResponse(payload)
      : resource === 'summary' ? isSummaryResponse(payload)
      : resource === 'incident' ? isIncidentDetailResponse(payload) && payload.incident.incident_id === incidentId
      : isApprovalResponse(payload) && payload.incident_id === approval?.incident_id && payload.action === approval.decision && payload.operator === operator
    if (!valid) throw new GatewayError(502, 'Panoptes returned a response that does not match the API contract. Refresh to check the current state.')
    // Do not publish unrelated top-level fields added by an upstream node.
    return Object.fromEntries(responseKeys[resource].map(key => [key, (payload as Record<string, unknown>)[key]]))
  } catch (error) {
    if (error instanceof GatewayError) throw error
    if (signal.aborted) throw new GatewayError(504, 'Panoptes timed out. Refresh to check the current state; do not resubmit a decision automatically.')
    throw new GatewayError(502, 'Panoptes is temporarily unavailable. Refresh to check the current state.')
  }
}
