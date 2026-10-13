// Backend values remain open strings so new statuses never acquire invented meaning.
export interface Incident {
  incident_id: string
  workflow: { id: string; name: string | null }
  execution: { id: string; url: string | null; failed_node: string | null; mode: string | null }
  diagnosis: {
    failure_type: string; transience: string; retry_safety: string; side_effect_risk: string
    summary: string | null; confidence: number
  }
  recovery: {
    status: string; retry_count: number; max_retries: number; proposed_action: string | null
    approval_status: string; human_required: boolean
  }
  timestamps: { occurred_at: string; created_at: string; updated_at: string; resolved_at: string | null }
}
export interface IncidentsResponse { success: true; count: number; incidents: Incident[] }
export interface SummaryResponse {
  success: true
  totals: {
    incidents: number; escalated: number; recovered: number; recovery_pending: number
    recovering: number; verifying: number; awaiting_approval: number; requiring_human: number
  }
  recovery: { total_retry_attempts: number }
  failure_types: Record<string, number>
  generated_at: string
}
// Contract definitions only; M17.1 makes no detail or approval requests.
export interface IncidentDetail extends Incident {
  execution: Incident['execution'] & { error: { name: string | null; message: string | null } }
  recovery: Incident['recovery'] & { last_action: string | null; last_action_result: Record<string, unknown> | null }
  config: { auto_recovery_enabled: boolean; idempotency_guaranteed: boolean }
}
export interface IncidentEvent {
  event_id: string; type: string; message: string | null; old_status: string | null
  new_status: string | null; tool_name: string | null; tool_result: Record<string, unknown> | null; timestamp: string
}
export interface IncidentDetailResponse { success: true; incident: IncidentDetail; timeline: IncidentEvent[] }
export type ApprovalDecision = 'APPROVE' | 'REJECT'
export interface ApprovalRequest { incident_id: string; decision: ApprovalDecision; operator: 'operator_console' }
export interface ApprovalResponse {
  success: true; action: ApprovalDecision; incident_id: string; operator: string; message: string; previous_status: string
}
