// Synthetic contract fixtures only; no operational data or credentials.
export const pending = {
  success: true,
  incident: {
    incident_id: 'INC-fixture-1', workflow: { id: 'fixture', name: 'Isolated verification workflow' },
    execution: { id: '1', url: null, failed_node: 'Fixture node', mode: 'trigger', error: { name: 'FixtureError', message: 'Synthetic failure for local verification.' } },
    diagnosis: { failure_type: 'NETWORK', transience: 'TRANSIENT', retry_safety: 'SAFE', side_effect_risk: 'LOW', summary: 'Synthetic incident.', confidence: 1 },
    recovery: { status: 'WAITING_FOR_APPROVAL', approval_status: 'PENDING', retry_count: 0, max_retries: 1, proposed_action: 'RETRY', human_required: true, last_action: null, last_action_result: null },
    timestamps: { occurred_at: '2026-10-14T00:00:00Z', created_at: '2026-10-14T00:00:01Z', updated_at: '2026-10-14T00:00:02Z', resolved_at: null },
    config: { auto_recovery_enabled: false, idempotency_guaranteed: true },
  },
  timeline: [{ event_id: 'fixture-event', type: 'APPROVAL_REQUESTED', timestamp: '2026-10-14T00:00:02Z', message: 'Synthetic approval request.', old_status: 'NEW', new_status: 'WAITING_FOR_APPROVAL', tool_name: null, tool_result: null }],
}
export const incidents = { success: true, count: 1, incidents: [pending.incident] }
export const summary = { success: true, totals: { incidents: 1, escalated: 0, recovered: 0, recovery_pending: 0, recovering: 0, verifying: 0, awaiting_approval: 1, requiring_human: 1 }, recovery: { total_retry_attempts: 0 }, failure_types: { NETWORK: 1 }, generated_at: '2026-10-14T00:00:02Z' }
