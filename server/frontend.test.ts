import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { request as httpRequest } from 'node:http'
import { buildApp } from './app.js'
import { readConfig } from './config.js'
import { registerFrontend } from './frontend.js'

const env = {
  NODE_ENV: 'production', SUPABASE_URL: 'https://auth.example.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  PANOPTES_CONSOLE_ORIGIN: 'https://console.example.invalid', PANOPTES_N8N_ORIGIN: 'https://n8n.example.invalid',
  PANOPTES_OPERATOR_IDS: '11111111-1111-4111-8111-111111111111', PANOPTES_APPROVAL_HEADER_NAME: 'X-Fixture-Internal', PANOPTES_APPROVAL_HEADER_VALUE: 'fixture-private-canary',
}
const config = readConfig(env)
const html = '<!doctype html><title>Public build fixture</title>'
async function buildFixture(t: { after: (fn: () => Promise<unknown>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'panoptes-static-'))
  t.after(async () => { assert(root.startsWith(join(tmpdir(), 'panoptes-static-'))); await rm(root, { recursive: true, force: true }) })
  await mkdir(join(root, 'assets'))
  await writeFile(join(root, 'index.html'), html)
  await writeFile(join(root, 'panoptes.svg'), '<svg/>')
  await writeFile(join(root, 'assets/index-12345678.js'), 'console.log("public fixture")')
  await writeFile(join(root, 'assets/index-12345678.css'), 'body{}')
  return root
}

test('production assets load publicly, while all API methods remain authenticated JSON', async t => {
  const root = await buildFixture(t)
  let authCalls = 0
  const app = buildApp(config, { verifyToken: async () => { authCalls++; return env.PANOPTES_OPERATOR_IDS } })
  t.after(() => app.close())
  await registerFrontend(app, root)
  for (const url of ['/', '/?incident_id=INC-synthetic-1', '/index.html', '/panoptes.svg', '/assets/index-12345678.js', '/assets/index-12345678.css']) {
    for (const method of ['GET', 'HEAD'] as const) {
      const response = await app.inject({ method, url })
      assert.equal(response.statusCode, 200)
      assert.equal(response.headers['x-content-type-options'], 'nosniff')
      assert.equal(response.headers['cache-control'], url.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store')
      if (method === 'HEAD') assert.equal(response.body, '')
    }
  }
  assert.equal(authCalls, 0)
  for (const url of ['/api/panoptes/session', '/api/panoptes/summary', '/api/panoptes/unknown', '/api/panoptes']) {
    const response = await app.inject({ url })
    assert.equal(response.statusCode, 401)
    assert.match(String(response.headers['content-type']), /application\/json/)
    assert(!response.body.includes(html))
  }
  const headers = { authorization: 'Bearer fixture', origin: env.PANOPTES_CONSOLE_ORIGIN }
  assert.equal((await app.inject({ url: '/api/panoptes/session', headers })).statusCode, 200)
  assert.equal((await app.inject({ url: '/api/panoptes/unknown', headers })).statusCode, 404)
  assert.equal((await app.inject({ url: '/api/panoptes/session', headers: { ...headers, origin: 'https://other.invalid' } })).statusCode, 403)
  assert.equal((await app.inject({ method: 'POST', url: '/', payload: {} })).statusCode, 404)
})

test('private, unknown, source-map and traversal paths never become the frontend', async t => {
  const root = await buildFixture(t)
  const app = buildApp(config)
  t.after(() => app.close())
  await registerFrontend(app, root)
  await app.listen({ host: '127.0.0.1', port: 0 })
  const address = app.server.address()
  assert(address && typeof address !== 'string')
  for (const url of [
    '/api/unknown', '/api', '/.env', '/.env.local', '/.env.production.local', '/.qa/report.md', '/.server/server/index.js',
    '/server/index.ts', '/src/main.tsx', '/node_modules/fastify/package.json', '/package.json', '/package-lock.json',
    '/Dockerfile', '/vite.config.ts', '/workflow-backups/private.json', '/backups/private.json', '/config', '/unknown',
    '/assets/.hidden', '/assets/index-12345678.js.map', '/assets/missing-12345678.js', '/assets/', '/assets',
    '/../.env.local', '/assets/../../.env.local', '/%2e%2e/.env.local', '/assets/%2e%2e/%2e%2e/.env',
    '/assets/%252e%252e/.env', '/%2e/index.html', '//index.html', '/./index.html', '/assets//index-12345678.js',
    '/assets\\..\\.env', '/assets/%5c../.env', '/%69ndex.html', '/.git/config', '/INDEX.HTML', '/assets/index-12345678.js%00',
  ]) {
    // Preserve raw wire paths: URL-based test clients normalize dot segments first.
    const response = await new Promise<{ status: number; type: string; body: string }>((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port: address.port, path: url, headers: { accept: 'text/html' } }, res => {
        let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk })
        res.on('end', () => resolve({ status: res.statusCode!, type: String(res.headers['content-type']), body }))
      })
      req.on('error', reject); req.end()
    })
    assert([400, 404].includes(response.status), url)
    if (response.status === 404) assert.match(response.type, /application\/json/, url)
    assert(!response.body.includes(html), url)
  }
})

test('unexpected files, maps and missing assets reject the production build at startup', async t => {
  for (const name of ['.env.local', 'private.json', 'assets/index-12345678.js.map', 'assets/server.js', 'assets/.hidden']) {
    const root = await buildFixture(t)
    await writeFile(join(root, name), 'never serve this')
    const app = buildApp(config); t.after(() => app.close())
    await assert.rejects(() => registerFrontend(app, root), /Unexpected file/)
  }
  const root = await buildFixture(t)
  await rm(join(root, 'index.html'))
  const app = buildApp(config); t.after(() => app.close())
  await assert.rejects(() => registerFrontend(app, root), /Incomplete frontend/)
})

test('symlink directories cannot turn a private tree into public assets', async t => {
  const root = await buildFixture(t)
  await symlink(root, join(root, 'assets/linked'), 'junction')
  const app = buildApp(config); t.after(() => app.close())
  await assert.rejects(() => registerFrontend(app, root), /Unexpected file/)
})

test('production configuration rejects HTTP origins, unknown modes and privileged keys', () => {
  for (const key of ['SUPABASE_URL', 'PANOPTES_CONSOLE_ORIGIN', 'PANOPTES_N8N_ORIGIN']) {
    for (const value of ['http://127.0.0.1:3001', 'http://public.invalid', 'https://user:password@host.invalid', 'https://host.invalid/private']) assert.throws(() => readConfig({ ...env, [key]: value }))
  }
  for (const key of Object.keys(env).filter(key => key !== 'NODE_ENV')) assert.throws(() => readConfig({ ...env, [key]: '' }))
  assert.throws(() => readConfig({ ...env, NODE_ENV: 'prod' }))
  assert.throws(() => readConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_privileged_fixture' }))
  assert.equal(readConfig(env).development, false)
})
