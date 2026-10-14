import { createServer, request as httpsRequest } from 'node:https'
import { once } from 'node:events'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pending, incidents, summary } from './fixtures.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const output = path.resolve('.qa/m18.3')
fs.mkdirSync(output, { recursive: true })
const temporary = fs.mkdtempSync(path.join(output, 'fixture-'))
const runtime = path.join(temporary, 'runtime')
const base = 'https://console.example.invalid'
const local = 'http://127.0.0.1:5197'
const operator = '11111111-1111-4111-8111-111111111111'
const outsider = '22222222-2222-4222-8222-222222222222'
const canary = 'm18-3-isolated-private-canary'
const report = { environment: 'NODE_ENV=production; compiled Fastify and Vite build; isolated HTTPS Auth/n8n fixtures', browserTransport: 'Virtual HTTPS browser origin routed to loopback Fastify; no public HTTPS edge tested', checks: [], errors: [], fixtureApprovalPosts: 0, liveApprovalPosts: 0, hostedVerification: 'not performed' }
const check = (name, condition) => { assert.ok(condition, name); report.checks.push(name) }
const tokens = new Map()
let detail = structuredClone(pending), deny = false, outage = false, rateLimited = false, failNextApproval = false, refreshCount = 0
let fixture, gateway, browser, heldResponse, holdSummary = false
const json = (res, body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
const body = async req => { let text = ''; for await (const chunk of req) text += chunk; return text ? JSON.parse(text) : {} }
function user(id) { return { id, email: id === operator ? 'operator@example.invalid' : 'outsider@example.invalid', aud: 'authenticated', role: 'authenticated', is_anonymous: false, email_confirmed_at: '2026-10-14T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: '2026-10-14T00:00:00Z' } }
function session(id) {
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600, iat: Math.floor(Date.now()/1000), jti: String(Math.random()) })).toString('base64url'), 'fixture-signature'].join('.')
  tokens.set(token, id)
  return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: 'fixture-refresh-'+id, user: user(id) }
}
async function login(page, email = 'operator@example.invalid') {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('isolated-fixture-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}
async function loaded(page) { await page.getByText('API data loaded', { exact: true }).waitFor() }
async function start(env) {
  const child = spawn(process.execPath, ['.server/server/index.js'], { cwd: runtime, env, stdio: ['ignore', 'pipe', 'pipe'] })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Production fixture startup timed out')) }, 15000)
    child.stdout.on('data', chunk => { if (chunk.toString().includes('listening')) { clearTimeout(timer); resolve() } })
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Production fixture did not start')) })
    child.once('error', error => { clearTimeout(timer); reject(error) })
  })
  return child
}

try {
  assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED, '0')
  const openssl = process.env.PANOPTES_OPENSSL || (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl')
  const keyPath = path.join(temporary, 'key.pem'), certPath = path.join(temporary, 'cert.pem')
  const made = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } })
  assert.equal(made.status, 0, 'Local fixture certificate generation failed')
  const cert = fs.readFileSync(certPath)
  fixture = createServer({ key: fs.readFileSync(keyPath), cert }, async (req, res) => {
    const url = new URL(req.url, 'https://localhost')
    if (url.pathname.startsWith('/auth/')) {
      res.setHeader('Access-Control-Allow-Origin', base)
      res.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info,x-supabase-api-version')
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
      if (url.pathname === '/auth/v1/token') {
        const input = await body(req)
        if (url.searchParams.get('grant_type') === 'refresh_token') { refreshCount++; return json(res, session(input.refresh_token.includes(outsider) ? outsider : operator)) }
        if (input.password !== 'isolated-fixture-password') return json(res, { msg: 'Invalid login credentials', error_code: 'invalid_credentials' }, 400)
        return json(res, session(input.email === 'outsider@example.invalid' ? outsider : operator))
      }
      if (url.pathname === '/auth/v1/user') {
        if (rateLimited) return json(res, { message: 'Fixture Auth rate limited' }, 429)
        if (outage) return json(res, { message: 'Fixture Auth unavailable' }, 503)
        const id = tokens.get(req.headers.authorization?.replace('Bearer ', ''))
        return deny || !id ? json(res, { message: 'Fixture token invalid' }, 401) : json(res, user(id))
      }
      if (url.pathname === '/auth/v1/logout') { res.writeHead(204); return res.end() }
    }
    if (url.pathname.startsWith('/webhook/')) {
      check('No browser token/cookie forwarded to fixture n8n', !req.headers.authorization && !req.headers.cookie)
      check('Production omits ngrok development header', !req.headers['ngrok-skip-browser-warning'])
      if (url.pathname.endsWith('/summary')) { if (holdSummary) { heldResponse = res; return } return json(res, summary) }
      if (url.pathname.endsWith('/incidents')) return json(res, incidents)
      if (url.pathname.endsWith('/incident')) return json(res, url.searchParams.get('incident_id') === detail.incident.incident_id ? detail : { success: false, error: 'INCIDENT_NOT_FOUND' })
      if (url.pathname.endsWith('/approval') && req.method === 'POST') {
        report.fixtureApprovalPosts++
        const input = await body(req)
        check('Fixture action has trusted operator and internal Header Auth', input.operator === operator && req.headers['x-fixture-internal'] === canary)
        detail.incident.recovery.approval_status = input.decision === 'APPROVE' ? 'NOT_REQUIRED' : 'REJECTED'
        detail.incident.recovery.status = input.decision === 'APPROVE' ? 'RECOVERY_PENDING' : 'ESCALATED'
        if (failNextApproval) { failNextApproval = false; return res.destroy() }
        return json(res, { success: true, action: input.decision, incident_id: input.incident_id, operator: input.operator, previous_status: 'WAITING_FOR_APPROVAL', message: 'Isolated fixture decision accepted.' })
      }
    }
    json(res, {}, 404)
  })
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening')
  const upstream = 'https://127.0.0.1:'+fixture.address().port
  fs.mkdirSync(runtime)
  fs.cpSync('.server', path.join(runtime, '.server'), { recursive: true })
  fs.writeFileSync(path.join(runtime, 'package.json'), '{"type":"module"}')
  const built = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', path.join(runtime, 'dist')], { env: { ...process.env, VITE_SUPABASE_URL: upstream, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_production_fixture' }, encoding: 'utf8' })
  assert.equal(built.status, 0, 'Isolated production browser build failed')
  // Dependencies resolve upward to the checkout; no source/secret files are staged.
  const env = { ...process.env, NODE_ENV: 'production', NODE_EXTRA_CA_CERTS: certPath, SUPABASE_URL: upstream, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_production_fixture', PANOPTES_OPERATOR_IDS: operator,
    PANOPTES_CONSOLE_ORIGIN: base, PANOPTES_N8N_ORIGIN: upstream, PANOPTES_APPROVAL_HEADER_NAME: 'X-Fixture-Internal', PANOPTES_APPROVAL_HEADER_VALUE: canary, PANOPTES_GATEWAY_HOST: '127.0.0.1', PANOPTES_GATEWAY_PORT: '5197' }
  const bad = spawnSync(process.execPath, ['.server/server/index.js'], { cwd: runtime, env: { ...env, SUPABASE_URL: '' }, encoding: 'utf8' })
  check('Missing runtime configuration fails closed without echo', bad.status === 1 && !String(bad.stdout+bad.stderr).includes(canary))
  const withoutTrust = { ...env }; delete withoutTrust.NODE_EXTRA_CA_CERTS
  gateway = await start(withoutTrust)
  const untrusted = await fetch(local+'/api/panoptes/session', { headers: { authorization: 'Bearer '+session(operator).access_token } })
  check('Gateway rejects untrusted fixture TLS rather than disabling verification', untrusted.status === 503)
  gateway.kill(); await once(gateway, 'exit'); gateway = undefined
  gateway = await start(env)
  check('Compiled production process serves frontend without Vite', (await fetch(local)).status === 200)
  const context404 = await fetch(local+'/api/unknown', { headers: { accept: 'text/html' } })
  check('API misses remain JSON rather than SPA HTML', context404.status === 404 && context404.headers.get('content-type').includes('application/json'))
  check('Unauthenticated compiled API denies data', (await fetch(local+'/api/panoptes/summary')).status === 401)

  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  // Virtual browser transport only: actual compiled server handles every app/API response.
  // HTTPS fixture traffic is certificate-verified with an explicit test CA.
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== base && url.origin !== upstream) return route.abort()
    const target = url.origin === base ? local+url.pathname+url.search : request.url()
    const headers = { ...request.headers() }; delete headers.host; delete headers['content-length']
    const result = url.origin === base
      ? await fetch(target, { method: request.method(), headers, ...(request.postDataBuffer() ? { body: request.postDataBuffer() } : {}) }).then(async res => ({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) }))
      : await new Promise((resolve, reject) => {
        const req = httpsRequest(target, { method: request.method(), headers, ca: cert }, res => {
          const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
        }); req.on('error', reject); req.end(request.postDataBuffer())
      })
    delete result.headers['transfer-encoding']; delete result.headers['connection']; delete result.headers['content-length']
    await route.fulfill(result)
  })
  const page = await context.newPage(), apiRequests = []
  page.on('pageerror', () => report.errors.push('Uncaught browser error'))
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/panoptes/')) {
      check('Browser API remains same-origin without internal secrets', url.origin === base && !request.headers()['x-fixture-internal'] && !JSON.stringify(request.headers()).includes(canary))
      apiRequests.push({ path: url.pathname, method: request.method() })
      if (request.method() === 'POST') check('Browser action contains only incident_id/decision', Object.keys(request.postDataJSON()).sort().join(',') === 'decision,incident_id')
    }
  })
  await page.goto(base)
  await page.getByRole('heading', { name: 'Operator sign-in', exact: true }).waitFor()
  check('Anonymous login view issues no operational reads', apiRequests.length === 0)
  await page.getByLabel('Email', { exact: true }).fill('operator@example.invalid'); await page.getByLabel('Password', { exact: true }).fill('wrong-fixture-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.getByRole('alert').waitFor()
  check('Invalid login remains gated and clears password', await page.getByLabel('Password', { exact: true }).inputValue() === '')
  await login(page); await loaded(page)
  check('Operator loads summary and incident list', await page.locator('tbody a').count() === 1)
  check('No Auth token in localStorage', await page.evaluate(() => !Object.keys(localStorage).some(key => /auth|supabase/i.test(key))))
  const other = await context.newPage(); await other.goto(base); await other.getByRole('heading', { name: 'Operator sign-in', exact: true }).waitFor(); await other.close()
  check('Fresh tab stays signed out', true)
  const selectedId = detail.incident.incident_id
  await page.goto(base+'/?incident_id='+selectedId); await loaded(page)
  const panel = page.getByRole('dialog', { name: 'Incident detail', exact: true })
  await panel.getByRole('heading', { name: /^What happened/ }).waitFor()
  await page.reload(); await loaded(page); await panel.getByRole('heading', { name: /^What happened/ }).waitFor()
  check('Direct URL and reload restore authenticated detail/timeline', await panel.getByText('Synthetic approval request.', { exact: true }).isVisible())
  await panel.getByRole('button', { name: 'Close incident detail', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click(); await loaded(page)
  check('Manual refresh succeeds', true)
  await page.goto(base+'/?incident_id=INC-fixture-missing'); await page.getByText('Incident not found.', { exact: false }).waitFor()
  check('Missing incident is controlled without session loss', await page.getByRole('button', { name: 'Sign out', exact: true }).isVisible())
  await page.goto(base+'/?incident_id='+selectedId); await loaded(page); await panel.getByRole('heading', { name: /^What happened/ }).waitFor()
  await page.screenshot({ path: path.join(output, 'production-fixture-detail.png') })
  await panel.getByRole('button', { name: 'Approve recovery', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Approve recovery?', exact: true })
  await confirmation.getByRole('button', { name: 'Confirm approval', exact: true }).click({ clickCount: 2 }); await confirmation.waitFor({ state: 'hidden' })
  await panel.getByText('Isolated fixture decision accepted.', { exact: true }).waitFor()
  check('Double click submits one isolated fixture action', report.fixtureApprovalPosts === 1)
  await panel.getByRole('button', { name: 'Close incident detail', exact: true }).click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.getByRole('heading', { name: 'Operator sign-in', exact: true }).waitFor()
  await login(page, 'outsider@example.invalid'); await page.getByRole('heading', { name: 'Operator access denied', exact: true }).waitFor()
  check('Non-operator cannot see operational content', !await page.getByRole('heading', { name: 'Incident overview', exact: true }).isVisible())
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.getByRole('heading', { name: 'Operator sign-in', exact: true }).waitFor()
  outage = true; await login(page); await page.getByRole('heading', { name: 'Sign-in unavailable', exact: true }).waitFor()
  outage = false; await page.getByRole('button', { name: 'Check access again', exact: true }).click(); await loaded(page)
  check('Temporary Auth outage recovers without another password', true)
  rateLimited = true; await page.getByRole('button', { name: 'Refresh data', exact: true }).click(); await page.getByText('Authentication is temporarily unavailable. Try again.', { exact: false }).first().waitFor()
  check('Auth 429 preserves session', await page.getByRole('heading', { name: 'Incident overview', exact: true }).isVisible())
  rateLimited = false; await page.getByRole('button', { name: 'Refresh data', exact: true }).click(); await loaded(page)
  deny = true; await page.getByRole('button', { name: 'Refresh data', exact: true }).click(); await page.getByRole('heading', { name: 'Operator sign-in', exact: true }).waitFor()
  check('Terminal 401 clears operational content', !await page.getByRole('heading', { name: 'Incident overview', exact: true }).isVisible())
  deny = false; await login(page); await loaded(page)
  await page.evaluate(() => { const key = Object.keys(sessionStorage).find(key => key.startsWith('panoptes.auth.session.')); const value = JSON.parse(sessionStorage.getItem(key)); value.expires_at = 1; sessionStorage.setItem(key, JSON.stringify(value)) })
  await page.reload(); await loaded(page); check('SDK refresh restores expired fixture session', refreshCount > 0)
  detail = structuredClone(pending); failNextApproval = true
  await page.goto(base+'/?incident_id='+selectedId); await loaded(page); await panel.getByRole('heading', { name: /^What happened/ }).waitFor()
  await panel.getByRole('button', { name: 'Reject recovery', exact: true }).click()
  const rejectDialog = page.getByRole('dialog', { name: 'Reject recovery?', exact: true })
  await rejectDialog.getByRole('button', { name: 'Confirm rejection', exact: true }).click(); await rejectDialog.waitFor({ state: 'hidden' })
  await panel.getByText(/temporarily unavailable/).waitFor(); check('Lost fixture acknowledgement remains uncertain without retry', report.fixtureApprovalPosts === 2)
  await panel.getByRole('button', { name: 'Close incident detail', exact: true }).click()
  holdSummary = true; await page.getByRole('button', { name: 'Refresh data', exact: true }).click()
  for (let i = 0; !heldResponse && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 20))
  assert(heldResponse)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.getByRole('heading', { name: 'Operator sign-in', exact: true }).waitFor()
  json(heldResponse, summary); heldResponse = undefined; holdSummary = false
  await page.reload(); await page.getByRole('heading', { name: 'Operator sign-in', exact: true }).waitFor()
  check('Logout, late response and reload leave protected content absent', !await page.getByRole('heading', { name: 'Incident overview', exact: true }).isVisible())
  for (const width of [320, 768, 1440]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: theme })
    check(`Production login fits ${width}px ${theme}`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await page.screenshot({ path: path.join(output, 'production-fixture-logout.png') })
  check('No uncaught browser errors', report.errors.length === 0)
  check('No browser source maps', !fs.readdirSync(path.join(runtime, 'dist'), { recursive: true }).some(name => name.endsWith('.map')))
  report.artifacts = fs.readdirSync(path.join(runtime, 'dist'), { recursive: true }).filter(name => fs.statSync(path.join(runtime, 'dist', name)).isFile()).map(name => ({ file: String(name).replaceAll('\\', '/'), sha256: createHash('sha256').update(fs.readFileSync(path.join(runtime, 'dist', name))).digest('hex') }))
  report.browserVersion = browser.version(); report.nodeVersion = process.version; report.status = 'PASS'
  await context.close()
} catch (error) { report.status = 'FAIL'; report.failure = error.message }
finally {
  if (heldResponse) heldResponse.destroy()
  if (browser) await browser.close()
  if (gateway) { gateway.kill(); await once(gateway, 'exit') }
  if (fixture) { fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve)) }
  assert(temporary.startsWith(output+path.sep+'fixture-'))
  fs.rmSync(temporary, { recursive: true, force: true })
  fs.writeFileSync(path.join(output, 'production-browser.json'), JSON.stringify(report, null, 2))
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, fixtureApprovalPosts: report.fixtureApprovalPosts, liveApprovalPosts: 0, hostedVerification: 'not performed', failure: report.failure }))
if (report.status !== 'PASS') process.exitCode = 1
