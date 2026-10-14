import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import viteConfig from '../vite.config.ts'

const output = '.qa/m18.3'
fs.mkdirSync(output, { recursive: true })
const canary = 'm18-3-build-private-canary', header = 'X-M18-3-Private-Canary', upstream = 'https://private-upstream-canary.invalid'
const env = { ...process.env, VITE_SUPABASE_URL: 'https://auth.example.invalid', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_bundle_fixture', PANOPTES_APPROVAL_HEADER_VALUE: canary,
  PANOPTES_APPROVAL_HEADER_NAME: header, PANOPTES_N8N_ORIGIN: upstream, VITE_PANOPTES_API_BASE: upstream, PANOPTES_DEV_PROXY_TARGET: upstream }
const invalid = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', output+'/invalid-dist'], { env: { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_invalid_fixture' }, encoding: 'utf8' })
assert.notEqual(invalid.status, 0)
assert(!String(invalid.stdout+invalid.stderr).includes('sb_secret_invalid_fixture'))
const built = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', output+'/canary-dist'], { env, encoding: 'utf8' })
assert.equal(built.status, 0, 'Synthetic bundle build failed')
let filesScanned = 0
for (const root of ['dist', output+'/canary-dist']) {
  for (const name of fs.readdirSync(root, { recursive: true })) {
    const file = path.join(root, name)
    if (!fs.statSync(file).isFile()) continue
    assert(!file.endsWith('.map'))
    const text = fs.readFileSync(file, 'utf8')
    assert(!/(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL=/.test(text))
    for (const forbidden of [canary, header, upstream, 'PANOPTES_APPROVAL_HEADER_VALUE', 'PANOPTES_OPERATOR_IDS', 'PANOPTES_N8N_ORIGIN', 'Panoptes gateway listening', '-----BEGIN PRIVATE KEY-----']) assert(!text.includes(forbidden), 'Unexpected private material in public output')
    filesScanned++
  }
}
for (const options of [{ command: 'build', mode: 'production', isPreview: false }, { command: 'serve', mode: 'production', isPreview: true }]) {
  const config = viteConfig(options)
  assert.equal(config.build.sourcemap, false)
  assert.deepEqual(config.server.proxy, {})
  assert.deepEqual(config.preview.proxy, {})
}
const report = { status: 'PASS', filesScanned, mapsDisabledAndAbsent: true, sourceMapReferencesAbsent: true, privateCanariesAbsent: true, obsoleteBrowserOverridesIneffective: true, privilegedPublicKeyRejectedWithoutEcho: true, buildPreviewProxyDisabled: true,
  realEnvFileExplicitlyReadOrModified: false, actualSecretExactValueScan: false, limitation: 'Synthetic canaries and structural scans; real .env.local secrets were not extracted for matching.' }
fs.writeFileSync(output+'/bundle.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
