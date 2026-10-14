import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

// Execute pure code nodes only. No n8n, network, credentials or persistence.
const load = name => JSON.parse(readFileSync(new URL(`../workflows/${name}.json`, import.meta.url), 'utf8'))
const verification = load('verify-recovery')
const parents = [load('error-intake'), load('human-approval')]
const node = (workflow, name) => {
  const matches = workflow.nodes.filter(item => item.name === name)
  assert.equal(matches.length, 1, `Expected one ${name}`)
  return matches[0]
}
class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-14T00:00:00Z'])) }
  static now() { return Date.parse('2026-10-14T00:00:00Z') }
}
function execute(workflow, name, input, lookups = {}) {
  const result = runInNewContext(`(() => { ${node(workflow, name).parameters.jsCode}\n })()`, {
    Date: FixtureDate,
    $input: { first: () => ({ json: structuredClone(input) }) },
    $: key => {
      assert.ok(Object.hasOwn(lookups, key), `Unexpected node lookup: ${key}`)
      return { first: () => ({ json: structuredClone(lookups[key]) }) }
    },
  }, { timeout: 1000 })
  assert.equal(result.length, 1)
  return JSON.parse(JSON.stringify(result[0].json))
}
const request = { incident_id: 'INC-demo-recovery-route', retry_execution_id: 'EXE-demo-retry', retry_count: 1, max_retries: 2 }
const state = value => [value.recovery_outcome, value.next_status, value.loop_required, value.human_required]
const matrix = [
  ['success', 1, ['RECOVERED', 'RECOVERED', false, false]],
  ['error', 1, ['RETRY_FAILED', 'RECOVERY_PENDING', true, false]],
  ['error', 2, ['RETRY_EXHAUSTED', 'ESCALATED', false, true]],
  ['canceled', 1, ['RETRY_FAILED', 'ESCALATED', false, true]],
  ['crashed', 1, ['RETRY_FAILED', 'ESCALATED', false, true]],
  ['running', 1, ['PENDING', 'VERIFYING', false, true]],
]
const branchNames = {
  RECOVERED: ['Build Recovered Update', 'Update Incident — RECOVERED', 'Build INCIDENT_RECOVERED Event', 'Create INCIDENT_RECOVERED Event'],
  RETRY_FAILED: ['Build Retry Failed Update', 'Update Incident — RECOVERY_PENDING', 'Build RETRY_FAILED Event', 'Create RETRY_FAILED Event'],
  RETRY_EXHAUSTED: ['Build Retry Exhausted Update', 'Update Incident — ESCALATED', 'Build RETRY_EXHAUSTED Event', 'Create RETRY_EXHAUSTED Event'],
  PENDING: ['Build Verification Pending Update', 'Update Incident — VERIFYING PENDING', 'Build VERIFICATION_PENDING Event', 'Create VERIFICATION_PENDING Event'],
}
function outputIndex(workflow, result) {
  const rules = node(workflow, 'Route Recovery Outcome').parameters.rules.values
  const matched = []
  rules.forEach((rule, index) => {
    assert.equal(rule.conditions.combinator, 'and')
    assert.equal(rule.conditions.conditions.length, 1)
    const condition = rule.conditions.conditions[0]
    assert.equal(condition.leftValue, '={{ $json.recovery_outcome }}')
    assert.equal(condition.operator.type, 'string')
    assert.equal(condition.operator.operation, 'equals')
    assert.equal(condition.rightValue, rule.outputKey)
    if (result.recovery_outcome === condition.rightValue) matched.push(index)
  })
  assert.equal(matched.length, 1, 'Exactly one recovery output must match')
  return matched[0]
}
function checkParent(workflow, result) {
  const path = branchNames[result.recovery_outcome]
  const index = outputIndex(workflow, result)
  assert.equal(workflow.connections['Route Recovery Outcome'].main[index][0].node, path[0])
  for (let i = 0; i < path.length - 1; i++) {
    assert.deepEqual(workflow.connections[path[i]].main, [[{ node: path[i + 1], type: 'main', index: 0 }]])
  }
  const update = execute(workflow, path[0], result)
  const databaseUpdate = node(workflow, path[1])
  assert.equal(databaseUpdate.type, 'n8n-nodes-base.supabase')
  for (const field of ['status', 'human_required', 'proposed_action']) {
    const mapping = databaseUpdate.parameters.fieldsUi.fieldValues.filter(item => item.fieldId === field)
    assert.equal(mapping.length, 1)
    assert.equal(mapping[0].fieldValue, `={{ $json.${field} }}`)
  }
  assert.equal(update.status, result.next_status)
  assert.equal(update.human_required, result.human_required)
  assert.equal(update.proposed_action, result.next_status === 'RECOVERY_PENDING' ? 'RETRY' : null)
  if (result.recovery_outcome === 'PENDING') assert.equal(update.last_action_result.loop_required, false)
  const event = execute(workflow, path[2], update, { [path[0]]: update })
  assert.equal(event.new_status, update.status)
  assert.equal(event.event_type, { RECOVERED: 'INCIDENT_RECOVERED', RETRY_FAILED: 'RETRY_FAILED', RETRY_EXHAUSTED: 'RETRY_EXHAUSTED', PENDING: 'VERIFICATION_PENDING' }[result.recovery_outcome])
  if (result.recovery_outcome === 'RETRY_FAILED') {
    assert.equal(event.tool_result.human_required, update.human_required)
    assert.match(event.event_message, update.status === 'ESCALATED' ? /terminal status.*escalated for human attention/i : /remains in recovery-pending state/i)
    assert.doesNotMatch(event.event_message, /will retry|retry automatically|another retry runs|another recovery cycle will/i)
    // Event derives state from the builder output, not an assumed branch status.
    for (const status of ['ESCALATED', 'RECOVERY_PENDING']) {
      const alternate = { ...update, status }
      assert.equal(execute(workflow, path[2], {}, { [path[0]]: alternate }).new_status, status)
    }
  }
  const persistence = node(workflow, path[3])
  assert.equal(persistence.type, 'n8n-nodes-base.executeWorkflow')
  assert.equal(persistence.parameters.workflowId.value, 'IMPORT_WRITE_INCIDENT_EVENT')
  assert.equal(persistence.parameters.workflowInputs.value.event_type, '={{ $json.event_type }}')
  assert.equal(persistence.parameters.workflowInputs.value.new_status, '={{ $json.new_status }}')
  assert.ok(!workflow.connections[path[3]], 'Event persistence must not start another recovery cycle')
}
for (const [status, count, expected] of matrix) {
  test(`execution ${status}, budget ${count}/2: ${expected[0]} / ${expected[1]}`, () => {
    const evaluated = execute(verification, 'Evaluate Recovery Result', { status }, { 'Validate Verification Request': { ...request, retry_count: count } })
    const guarded = execute(verification, 'Enforce Loop Termination', evaluated)
    assert.deepEqual(state(guarded), expected)
    for (const parent of parents) checkParent(parent, guarded)
  })
}
test('unknown recovery outcome fails closed', () => {
  const guarded = execute(verification, 'Enforce Loop Termination', { ...request, recovery_outcome: 'UNEXPECTED', next_status: 'RECOVERY_PENDING', loop_required: true, human_required: false })
  assert.deepEqual(state(guarded), ['PENDING', 'VERIFYING', false, true])
  for (const parent of parents) checkParent(parent, guarded)
})
test('unexpected retry-failure state and invalid budgets fail closed', () => {
  const guarded = execute(verification, 'Enforce Loop Termination', { ...request, recovery_outcome: 'RETRY_FAILED', next_status: 'UNEXPECTED', loop_required: true, human_required: false })
  assert.deepEqual(state(guarded), ['RETRY_FAILED', 'ESCALATED', false, true])
  for (const parent of parents) checkParent(parent, guarded)
  for (const retry_count of [-1, 1.5, 'invalid']) assert.throws(() => execute(verification, 'Enforce Loop Termination', { ...request, retry_count }), /Invalid retry_count/)
  assert.throws(() => execute(verification, 'Enforce Loop Termination', { ...request, max_retries: -1 }), /Invalid max_retries/)
})
test('builders reject mismatched outcomes and lost human attention', () => {
  for (const parent of parents) {
    assert.throws(() => execute(parent, 'Build Recovered Update', { ...request, recovery_outcome: 'R' }), /non-RECOVERED/)
    assert.throws(() => execute(parent, 'Build Retry Failed Update', { ...request, recovery_outcome: 'RETRY_FAILED', next_status: 'UNEXPECTED' }), /unexpected next_status/)
    assert.throws(() => execute(parent, 'Build Retry Failed Update', { ...request, recovery_outcome: 'RETRY_FAILED', next_status: 'ESCALATED', human_required: false }), /human attention/)
    assert.throws(() => execute(parent, 'Build Verification Pending Update', { ...request, recovery_outcome: 'PENDING', next_status: 'VERIFYING', human_required: false }), /human attention/)
  }
})
test('verification graph ends at the guard; no scheduling trigger is introduced', () => {
  assert.deepEqual(verification.connections['Evaluate Recovery Result'].main, [[{ node: 'Enforce Loop Termination', type: 'main', index: 0 }]])
  assert.ok(!verification.connections['Enforce Loop Termination'])
  for (const workflow of [verification, ...parents]) assert.ok(!workflow.nodes.some(item => /scheduleTrigger|cron|interval|wait$/i.test(item.type)))
})
