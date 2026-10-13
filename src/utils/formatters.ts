import type { Incident } from '../types/panoptes'
export const operatorTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
export const number = (value: number) => new Intl.NumberFormat('en').format(value)
export const label = (value: string) => value.replace(/_/g, ' ')
export function timestamp(value: string | null, includeSeconds = false) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Invalid timestamp'
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' as const } : {}), hourCycle: 'h23',
  }).format(date)
}
export function recentIncidents(incidents: Incident[]) {
  const occurred = (incident: Incident) => {
    const value = Date.parse(incident.timestamps.occurred_at)
    return Number.isFinite(value) ? value : -Infinity
  }
  return [...incidents].sort((a, b) => occurred(b) - occurred(a) || a.incident_id.localeCompare(b.incident_id)).slice(0, 10)
}
