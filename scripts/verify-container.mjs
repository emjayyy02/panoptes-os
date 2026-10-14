import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const output = path.resolve('.qa/m18.3')
fs.mkdirSync(output, { recursive: true })
const image = 'panoptes-os:m18.3-local'
const suffix = randomUUID().slice(0, 8)
const container = 'panoptes-m18-3-'+suffix
const contextImage = 'panoptes-context-'+suffix
const contextFile = path.join(output, 'context-'+suffix+'.Dockerfile')
const envCanary = path.resolve('.env.m18.3-context-'+suffix)
const canary = 'm18-3-runtime-private-canary'
const report = { environment: 'Local Docker only; synthetic configuration; no hosted resources', checks: [], liveApprovalPosts: 0 }
let running = false
function docker(args, success = true) {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 8*1024*1024 })
  if (success) assert.equal(result.status, 0, 'Local Docker command failed: '+args[0])
  return result
}
function check(name, condition) { assert.ok(condition, name); report.checks.push(name) }
try {
  fs.writeFileSync(envCanary, 'PRIVATE_CONTEXT_CANARY=synthetic-only', { flag: 'wx' })
  const built = docker(['build', '--build-arg', 'VITE_SUPABASE_URL=https://auth.example.invalid', '--build-arg', 'VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_container_fixture', '-t', image, '.'])
  fs.writeFileSync(path.join(output, 'container-build.txt'), built.stdout+built.stderr)
  fs.writeFileSync(contextFile, `FROM ${image}\nCOPY . /context\n`)
  docker(['build', '-f', contextFile, '-t', contextImage, '.'])
  const context = JSON.parse(docker(['run', '--rm', '--entrypoint', 'node', contextImage, '-e', "console.log(JSON.stringify(require('node:fs').readdirSync('/context',{recursive:true})))"]).stdout)
  check('Build context excludes all environment files, QA, Git, local outputs and workflow backups', context.every(name => !/(^|[\\/])(?:\.env[^\\/]*|\.qa|\.server|\.git|node_modules|dist|backups|workflow-backups)(?:[\\/]|$)/.test(name)))
  const info = JSON.parse(docker(['image', 'inspect', image]).stdout)[0]
  check('Image declares production mode and an unprivileged user', info.Config.User === 'node' && info.Config.Env.includes('NODE_ENV=production'))
  check('Private runtime credential is not baked into image metadata', !JSON.stringify(info).includes(canary))
  const missing = docker(['run', '--rm', image], false)
  check('Container fails closed without required runtime configuration', missing.status === 1 && String(missing.stdout+missing.stderr).includes('could not start'))
  docker(['run', '--detach', '--name', container, '--read-only', '--cap-drop=ALL', '--security-opt', 'no-new-privileges', '--health-interval=1s', '--health-start-period=0s',
    '--publish', '127.0.0.1:5196:3001',
    '--env', 'SUPABASE_URL=https://auth.example.invalid', '--env', 'SUPABASE_PUBLISHABLE_KEY=sb_publishable_container_fixture',
    '--env', 'PANOPTES_OPERATOR_IDS=11111111-1111-4111-8111-111111111111', '--env', 'PANOPTES_CONSOLE_ORIGIN=https://console.example.invalid',
    '--env', 'PANOPTES_N8N_ORIGIN=https://n8n.example.invalid', '--env', 'PANOPTES_APPROVAL_HEADER_NAME=X-Fixture-Internal', '--env', 'PANOPTES_APPROVAL_HEADER_VALUE='+canary, image])
  running = true
  let healthy = false
  for (let i = 0; i < 50; i++) {
    const state = JSON.parse(docker(['inspect', container]).stdout)[0].State
    if (state.Health?.Status === 'healthy') { healthy = true; break }
    if (!state.Running) break
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  check('Read-only local container becomes healthy', healthy)
  const home = await fetch('http://127.0.0.1:5196/')
  check('Container serves compiled frontend publicly', home.status === 200 && (await home.text()).includes('Panoptes OS'))
  check('Container API rejects unauthenticated access', (await fetch('http://127.0.0.1:5196/api/panoptes/summary')).status === 401)
  for (const target of ['/.env.local','/.qa/report.md','/.server/server/index.js','/src/main.tsx','/server/app.ts','/api/unknown','/assets/index.js.map']) {
    const response = await fetch('http://127.0.0.1:5196'+target, { headers: { accept: 'text/html' } })
    check('Container denies '+target, response.status === 404 && response.headers.get('content-type').includes('application/json'))
  }
  const files = JSON.parse(docker(['exec', container, 'node', '-e', `const f=require('node:fs'),c=require('node:crypto'); console.log(JSON.stringify({uid:process.getuid(),node:process.version,forbidden:['.env.local','.qa','src','server','scripts','node_modules/vite','node_modules/playwright','node_modules/typescript'].filter(p=>f.existsSync(p)),files:f.readdirSync('dist',{recursive:true}).filter(p=>f.statSync('dist/'+p).isFile()).map(p=>({file:p,sha256:c.createHash('sha256').update(f.readFileSync('dist/'+p)).digest('hex')}))}))`]).stdout)
  check('Runtime excludes source, QA, local config and development tools', files.forbidden.length === 0 && files.uid !== 0)
  check('Container browser build contains no source maps', files.files.every(item => !item.file.endsWith('.map')))
  report.runtime = files; report.imageId = info.Id; report.localImage = image; report.baseImage = 'node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20'
  report.contextFilesChecked = context.length; report.status = 'PASS'
} catch (error) { report.status = 'FAIL'; report.failure = error.message }
finally {
  if (running) docker(['rm', '--force', container], false)
  docker(['image', 'rm', contextImage], false)
  fs.rmSync(contextFile, { force: true }); fs.rmSync(envCanary, { force: true })
  fs.writeFileSync(path.join(output, 'container.json'), JSON.stringify(report, null, 2))
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, contextFilesChecked: report.contextFilesChecked, failure: report.failure }))
if (report.status !== 'PASS') process.exitCode = 1
