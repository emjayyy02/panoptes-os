import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import test from 'node:test'
import { buildApp } from './app.js'
import { AuthBoundaryError, createTokenVerifier } from './auth.js'
import { readConfig, validatePublicKey } from './config.js'
import { forwardPanoptes } from './panoptes.js'
import type { GatewayConfig } from './config.js'
import type { Resource } from './panoptes.js'

const operator = '11111111-1111-4111-8111-111111111111'
const outsider = '22222222-2222-4222-8222-222222222222'
const secret = 'canary-internal-approval-value-18-1'
const token = 'test-operator-token-18-1'
const environment = {
  SUPABASE_URL: 'https://auth.example.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_isolated_test',
  PANOPTES_OPERATOR_IDS: operator, PANOPTES_CONSOLE_ORIGIN: 'http://127.0.0.1:5173',
  PANOPTES_N8N_ORIGIN: 'https://n8n.example.invalid', PANOPTES_APPROVAL_HEADER_NAME: 'X-Panoptes-Internal',
  PANOPTES_APPROVAL_HEADER_VALUE: secret,
}
const config = readConfig(environment)
const headers = { authorization: `Bearer ${token}`, origin: config.consoleOrigin }
const summary = { success: true, totals: { incidents: 0, escalated: 0, recovered: 0, recovery_pending: 0, recovering: 0, verifying: 0, awaiting_approval: 0, requiring_human: 0 }, recovery: { total_retry_attempts: 0 }, failure_types: {}, generated_at: '2026-10-14T00:00:00Z' }
const incident = {
  incident_id: 'INC-1-231', workflow: { id: '1', name: null }, execution: { id: '231', url: null, failed_node: null, mode: null, error: { name: null, message: null } },
  diagnosis: { failure_type: 'UNKNOWN', transience: 'UNKNOWN', retry_safety: 'UNKNOWN', side_effect_risk: 'UNKNOWN', summary: null, confidence: 0 },
  recovery: { status: 'WAITING_FOR_APPROVAL', approval_status: 'PENDING', retry_count: 0, max_retries: 0, proposed_action: null, human_required: true, last_action: null, last_action_result: null },
  timestamps: { occurred_at: '', created_at: '', updated_at: '', resolved_at: null }, config: { auto_recovery_enabled: false, idempotency_guaranteed: false },
}
const receipt = (decision = 'APPROVE') => ({ success: true, action: decision, incident_id: incident.incident_id, operator, message: 'Isolated decision accepted.', previous_status: 'WAITING_FOR_APPROVAL' })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function harness(options: { status?: number; body?: unknown; fail?: boolean; production?: boolean } = {}) {
  const calls: { url: URL; init: RequestInit }[] = []
  let authCalls = 0
  const app = buildApp({ ...config, development: !options.production }, {
    verifyToken: async value => {
      authCalls++
      if (['expired', 'foreign-project', 'forged', 'malformed'].includes(value)) throw new AuthBoundaryError(401)
      if (value === 'auth-outage') throw new AuthBoundaryError(503)
      if (value === 'outsider') return outsider
      return operator
    },
    upstreamFetch: async (input, init) => {
      const url = new URL(String(input))
      calls.push({ url, init: init! })
      if (options.fail) throw new Error(`Never disclose ${secret}`)
      const body = options.body ?? (url.pathname.endsWith('/summary') ? summary : url.pathname.endsWith('/incidents') ? { success: true, count: 0, incidents: [] } : url.pathname.endsWith('/incident') ? { success: true, incident, timeline: [] } : receipt(JSON.parse(String(init?.body)).decision))
      return json(body, options.status)
    },
  })
  return { app, calls, get authCalls() { return authCalls } }
}

test('configuration fails closed without exposing configuration values', () => {
  for (const key of Object.keys(environment)) {
    const incomplete = { ...environment, [key]: '' }
    assert.throws(() => readConfig(incomplete), error => error instanceof Error && !error.message.includes(secret))
  }
  for (const patch of [
    { PANOPTES_OPERATOR_IDS: 'not-a-uuid' }, { PANOPTES_OPERATOR_IDS: operator + ',' },
    { PANOPTES_APPROVAL_HEADER_NAME: 'bad\nname' }, { PANOPTES_APPROVAL_HEADER_VALUE: secret + '\r\n' },
    { PANOPTES_APPROVAL_HEADER_NAME: 'Host' }, { PANOPTES_N8N_ORIGIN: 'https://n8n.example.invalid/path' },
    { SUPABASE_URL: 'https://user:password@auth.example.invalid' }, { PANOPTES_CONSOLE_ORIGIN: 'https://console.invalid?x=1' },
    { PANOPTES_GATEWAY_PORT: '0' }, { NODE_ENV: 'production' },
  ]) assert.throws(() => readConfig({ ...environment, ...patch }))
  assert.throws(() => validatePublicKey('sb_secret_never_public'))
  const legacy = (role: string) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`
  assert.throws(() => validatePublicKey(legacy('service_role')))
  assert.doesNotThrow(() => validatePublicKey(legacy('anon')))
})

test('every operation rejects unauthenticated access before touching n8n', async t => {
  const h = harness(); t.after(() => h.app.close())
  for (const [method, url] of [['GET', '/session'], ['GET', '/summary'], ['GET', '/incidents'], ['GET', '/incident?incident_id=INC-1-231'], ['POST', '/approval']] as const) {
    const response = await h.app.inject({ method, url: '/api/panoptes' + url })
    assert.equal(response.statusCode, 401)
    assert.equal(response.headers['cache-control'], 'no-store')
  }
  assert.equal(h.calls.length, 0)
  assert.equal(h.authCalls, 0)
})

test('invalid, expired, forged and foreign-project tokens cannot reach n8n', async t => {
  const h = harness(); t.after(() => h.app.close())
  for (const authorization of ['Basic abc', 'Bearer', 'Bearer bad token', ...['expired', 'forged', 'foreign-project', 'malformed'].map(x => `Bearer ${x}`)]) {
    const response = await h.app.inject({ url: '/api/panoptes/summary', headers: { authorization } })
    assert.equal(response.statusCode, 401)
  }
  assert.equal(h.calls.length, 0)
})

test('authorization and Auth outages fail closed for every protected operation', async t => {
  const h = harness(); t.after(() => h.app.close())
  for (const suffix of ['/session', '/summary', '/incidents', '/incident?incident_id=INC-1-231', '/approval']) {
    for (const [value, status] of [['outsider', 403], ['auth-outage', 503]] as const) {
      const response = await h.app.inject({ method: suffix === '/approval' ? 'POST' : 'GET', url: '/api/panoptes' + suffix, headers: { authorization: `Bearer ${value}` }, ...(suffix === '/approval' ? { payload: { incident_id: incident.incident_id, decision: 'APPROVE' } } : {}) })
      assert.equal(response.statusCode, status)
    }
  }
  assert.equal(h.calls.length, 0)
})

test('origin restrictions, fixed operations and no CORS bypass', async t => {
  const h = harness(); t.after(() => h.app.close())
  for (const origin of ['https://evil.invalid', 'null', config.consoleOrigin + '.evil.invalid']) {
    const response = await h.app.inject({ url: '/api/panoptes/summary', headers: { ...headers, origin } })
    assert.equal(response.statusCode, 403)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
  }
  for (const [method, path] of [['PUT', '/approval'], ['GET', '/approval'], ['POST', '/summary'], ['OPTIONS', '/approval'], ['GET', '/approval/extra'], ['GET', '/webhook/panoptes/summary'], ['HEAD', '/summary']] as const) {
    const response = await h.app.inject({ method, url: path.startsWith('/webhook') ? path : '/api/panoptes' + path, headers })
    assert.equal(response.statusCode, 404)
    assert.equal(response.headers['access-control-allow-origin'], undefined)
  }
  assert.equal(h.calls.length, 0)
  assert.equal((await h.app.inject({ url: '/api/panoptes/session', headers: { authorization: headers.authorization } })).statusCode, 200)
  assert.equal(h.calls.length, 0)
})

test('strict body/query validation rejects spoofed identities and ambiguous requests', async t => {
  const h = harness(); t.after(() => h.app.close())
  for (const body of [
    { incident_id: incident.incident_id, decision: 'APPROVE', operator: 'operator_console' },
    { incident_id: incident.incident_id, decision: 'REJECT', operator },
    { incident_id: incident.incident_id, decision: 'approve' }, { incident_id: incident.incident_id, decision: 'RETRY' },
    { incident_id: 123, decision: 'APPROVE' }, { incident_id: '', decision: 'APPROVE' },
    { incident_id: 'x\ny', decision: 'APPROVE' }, { incident_id: incident.incident_id },
    ['APPROVE'], null, { incident_id: incident.incident_id, decision: 'REJECT', target: 'https://evil.invalid' },
  ]) assert.equal((await h.app.inject({ method: 'POST', url: '/api/panoptes/approval', headers, payload: JSON.stringify(body), })).statusCode, 415)
  // Use the browser's actual JSON content type to exercise schemas rather than the parser.
  for (const body of [
    { incident_id: incident.incident_id, decision: 'APPROVE', operator: 'operator_console' },
    { incident_id: incident.incident_id, decision: 'REJECT', extra: true },
    { incident_id: 123, decision: 'APPROVE' }, { incident_id: '', decision: 'APPROVE' },
    { incident_id: 'x\ny', decision: 'APPROVE' }, { incident_id: incident.incident_id, decision: 'approve' }, {}, [], null,
  ]) assert.equal((await h.app.inject({ method: 'POST', url: '/api/panoptes/approval', headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(body) })).statusCode, 400)
  for (const suffix of ['/summary?target=https://evil.invalid', '/incidents?limit=1', '/session?operator=x', '/incident', '/incident?incident_id=', '/incident?incident_id=a&incident_id=b', '/incident?incident_id=a&other=b']) {
    assert.equal((await h.app.inject({ url: '/api/panoptes' + suffix, headers })).statusCode, 400)
  }
  assert.equal((await h.app.inject({ method: 'POST', url: '/api/panoptes/approval?incident_id=a', headers, payload: { incident_id: incident.incident_id, decision: 'APPROVE' } })).statusCode, 400)
  assert.equal((await h.app.inject({ method: 'POST', url: '/api/panoptes/approval', headers: { ...headers, 'content-type': 'application/json' }, payload: '{broken' })).statusCode, 400)
  assert.equal((await h.app.inject({ method: 'POST', url: '/api/panoptes/approval', headers, payload: { incident_id: 'x'.repeat(5000), decision: 'APPROVE' } })).statusCode, 413)
  assert.equal(h.calls.length, 0)
})

test('reads use fixed paths and do not forward browser credentials or private approval headers', async t => {
  const h = harness(); t.after(() => h.app.close())
  const session = await h.app.inject({ url: '/api/panoptes/session', headers })
  assert.deepEqual(session.json(), { success: true, operator })
  assert.equal(h.calls.length, 0)
  for (const suffix of ['/summary', '/incidents', '/incident?incident_id=INC-1-231']) {
    const response = await h.app.inject({ url: '/api/panoptes' + suffix, headers: { ...headers, cookie: 'private-cookie', 'x-forwarded-host': 'evil.invalid', 'x-panoptes-internal': 'spoofed' } })
    assert.equal(response.statusCode, 200)
  }
  for (const call of h.calls) {
    assert.equal(call.url.origin, config.n8nOrigin)
    const outbound = new Headers(call.init.headers)
    for (const name of ['authorization', 'cookie', 'x-forwarded-host', config.approvalHeaderName]) assert.equal(outbound.get(name), null)
    assert.equal(outbound.get('ngrok-skip-browser-warning'), 'true')
    assert.equal(call.init.redirect, 'error')
    assert.equal(call.init.method, 'GET')
  }
  assert.equal(h.calls[2].url.search, '?incident_id=INC-1-231')
  assert.equal(h.authCalls, 4)
})

test('APPROVE and REJECT receive only trusted identity and internal Header Auth', async t => {
  const h = harness(); t.after(() => h.app.close())
  for (const decision of ['APPROVE', 'REJECT']) {
    const response = await h.app.inject({ method: 'POST', url: '/api/panoptes/approval', headers: { ...headers, cookie: 'private-cookie', 'x-panoptes-internal': 'spoofed' }, payload: { incident_id: incident.incident_id, decision } })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().operator, operator)
    const call = h.calls.at(-1)!
    assert.equal(call.url.href, config.n8nOrigin + '/webhook/panoptes/approval')
    assert.deepEqual(JSON.parse(String(call.init.body)), { incident_id: incident.incident_id, decision, operator })
    const outbound = new Headers(call.init.headers)
    assert.equal(outbound.get(config.approvalHeaderName), secret)
    assert.equal(outbound.get('authorization'), null)
    assert.equal(outbound.get('cookie'), null)
    assert.equal(call.init.redirect, 'error')
    assert.equal(response.body.includes(secret), false)
  }
  assert.equal(h.calls.length, 2)
})

test('production upstream requests never include the ngrok development header', async t => {
  const h = harness({ production: true }); t.after(() => h.app.close())
  assert.equal((await h.app.inject({ url: '/api/panoptes/summary', headers })).statusCode, 200)
  assert.equal(new Headers(h.calls[0].init.headers).get('ngrok-skip-browser-warning'), null)
})

test('upstream failures are controlled and never retried or confused with expired operator sessions', async t => {
  for (const status of [301, 302, 401, 403, 500, 503]) {
    const h = harness({ status, body: { message: secret, stack: 'private stack' } }); t.after(() => h.app.close())
    const response = await h.app.inject({ method: 'POST', url: '/api/panoptes/approval', headers, payload: { incident_id: incident.incident_id, decision: 'APPROVE' } })
    assert.equal(response.statusCode, 502)
    assert.equal(response.body.includes(secret), false)
    assert.equal(response.body.includes('private stack'), false)
    assert.equal(response.headers['set-cookie'], undefined)
    assert.equal(h.calls.length, 1)
  }
  for (const status of [400, 409, 422]) {
    const h = harness({ status }); t.after(() => h.app.close())
    assert.equal((await h.app.inject({ method: 'POST', url: '/api/panoptes/approval', headers, payload: { incident_id: incident.incident_id, decision: 'REJECT' } })).statusCode, 409)
  }
  const h = harness({ status: 404 }); t.after(() => h.app.close())
  assert.equal((await h.app.inject({ url: '/api/panoptes/incident?incident_id=INC-1-231', headers })).statusCode, 404)
})

test('invalid contracts, mismatched receipts, and credential echoes fail closed', async t => {
  for (const body of [{ ...receipt(), operator: 'operator_console' }, { ...receipt(), incident_id: 'wrong' }, { ...receipt(), action: 'REJECT' }, { ...receipt(), message: secret }, { ...receipt(), message: token }, { success: false, message: secret }, { html: secret }]) {
    const h = harness({ body }); t.after(() => h.app.close())
    const response = await h.app.inject({ method: 'POST', url: '/api/panoptes/approval', headers, payload: { incident_id: incident.incident_id, decision: 'APPROVE' } })
    assert.equal(response.statusCode, 502)
    assert.equal(response.body.includes(secret), false)
    assert.equal(response.body.includes(token), false)
    assert.equal(h.calls.length, 1)
  }
  const h = harness({ fail: true }); t.after(() => h.app.close())
  assert.equal((await h.app.inject({ url: '/api/panoptes/summary', headers })).statusCode, 502)
})

test('timeouts, malformed JSON and bounded response bodies return safe gateway errors', async () => {
  for (const resource of ['summary', 'approval'] as Resource[]) {
    let calls = 0
    await assert.rejects(() => forwardPanoptes(config, resource, operator, token, AbortSignal.abort(), undefined,
      resource === 'approval' ? { incident_id: incident.incident_id, decision: 'APPROVE' } : undefined,
      async () => { calls++; throw new DOMException('aborted', 'AbortError') }), error => error instanceof Error && 'status' in error && error.status === 504)
    assert.equal(calls, 1)
  }
  for (const body of ['{broken', 'x'.repeat(5 * 1024 * 1024 + 1)]) {
    await assert.rejects(() => forwardPanoptes(config, 'summary', operator, token, new AbortController().signal, undefined, undefined,
      async () => new Response(body)), error => error instanceof Error && 'status' in error && error.status === 502)
  }
})

test('response projection and decoded credential checks prevent accidental upstream disclosures', async t => {
  const h = harness({ body: { ...summary, internal_debug: 'must not reach the browser' } }); t.after(() => h.app.close())
  assert.deepEqual((await h.app.inject({ url: '/api/panoptes/summary', headers })).json(), summary)
  // A JSON Unicode escape must not bypass the check by hiding the raw secret bytes.
  const escaped = JSON.stringify({ ...receipt(), message: secret }).replace('canary', '\\u0063anary')
  await assert.rejects(() => forwardPanoptes(config, 'approval', operator, token, new AbortController().signal, undefined,
    { incident_id: incident.incident_id, decision: 'APPROVE' }, async () => new Response(escaped)), error => error instanceof Error && 'status' in error && error.status === 502)
})

test('real Supabase SDK verifies against the configured Auth server on every request', async t => {
  let count = 0
  const server = createServer((req, res) => {
    count++
    assert.equal(req.url, '/auth/v1/user')
    assert.equal(req.headers.apikey, environment.SUPABASE_PUBLISHABLE_KEY)
    const value = req.headers.authorization
    res.setHeader('Content-Type', 'application/json')
    if (value === 'Bearer auth-outage') { res.statusCode = 503; res.end(JSON.stringify({ message: secret })); return }
    if (value !== `Bearer ${token}` && value !== 'Bearer anonymous') { res.statusCode = 401; res.end(JSON.stringify({ message: secret })); return }
    res.end(JSON.stringify({ id: operator, email: 'operator@example.invalid', is_anonymous: value === 'Bearer anonymous', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, identities: [] }))
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }))
  const address = server.address()
  assert(address && typeof address !== 'string')
  const localConfig: GatewayConfig = { ...config, supabaseUrl: `http://127.0.0.1:${address.port}` }
  const verify = createTokenVerifier(localConfig)
  for (let i = 0; i < 2; i++) assert.equal(await verify(token, new AbortController().signal), operator)
  for (const bad of ['expired', 'foreign-project', 'forged', 'anonymous']) {
    await assert.rejects(() => verify(bad, new AbortController().signal), error => error instanceof AuthBoundaryError && error.status === 401 && !error.message.includes(secret))
  }
  await assert.rejects(() => verify('auth-outage', new AbortController().signal), error => error instanceof AuthBoundaryError && error.status === 503)
  assert.equal(count, 7)
})
