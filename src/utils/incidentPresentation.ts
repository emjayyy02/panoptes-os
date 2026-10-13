import type { Incident } from '../types/panoptes'

// UI availability only. The backend remains the authority for recovery decisions.
export const isAwaitingDecision = (incident: Incident) => incident.recovery.status === 'WAITING_FOR_APPROVAL' && incident.recovery.approval_status === 'PENDING'

export function incidentHref(id: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('incident_id', id)
  return `${url.pathname}${url.search}${url.hash}`
}

export function executionHref(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export const provided = (value: string | null) => value === null ? 'Not recorded' : value
