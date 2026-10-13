import type { Incident, IncidentsResponse, SummaryResponse } from '../types/panoptes'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
const text = (value: unknown): value is string => typeof value === 'string'
const nullableText = (value: unknown) => value === null || text(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const texts = (value: Record<string, unknown>, keys: string[]) => keys.every(key => text(value[key]))
const nullableTexts = (value: Record<string, unknown>, keys: string[]) => keys.every(key => nullableText(value[key]))

function isIncident(value: unknown): value is Incident {
  if (!object(value) || !text(value.incident_id)) return false
  const { workflow: w, execution: e, diagnosis: d, recovery: r, timestamps: t } = value
  return object(w) && text(w.id) && nullableText(w.name)
    && object(e) && text(e.id) && nullableTexts(e, ['url', 'failed_node', 'mode'])
    && object(d) && texts(d, ['failure_type', 'transience', 'retry_safety', 'side_effect_risk'])
    && nullableText(d.summary) && typeof d.confidence === 'number' && Number.isFinite(d.confidence)
    && object(r) && texts(r, ['status', 'approval_status']) && count(r.retry_count) && count(r.max_retries)
    && nullableText(r.proposed_action) && typeof r.human_required === 'boolean'
    && object(t) && texts(t, ['occurred_at', 'created_at', 'updated_at']) && nullableText(t.resolved_at)
}
export function isIncidentsResponse(value: unknown): value is IncidentsResponse {
  return object(value) && value.success === true && count(value.count)
    && Array.isArray(value.incidents) && value.incidents.every(isIncident)
}
export function isSummaryResponse(value: unknown): value is SummaryResponse {
  if (!object(value) || value.success !== true) return false
  const { totals, recovery, failure_types: failures } = value
  return object(totals)
    && ['incidents', 'escalated', 'recovered', 'recovery_pending', 'recovering', 'verifying', 'awaiting_approval', 'requiring_human'].every(key => count(totals[key]))
    && object(recovery) && count(recovery.total_retry_attempts)
    && object(failures) && Object.values(failures).every(count) && text(value.generated_at)
}
