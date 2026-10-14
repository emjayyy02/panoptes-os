import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const output = '.qa/m18.3'
fs.mkdirSync(output, { recursive: true })
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const entries = []
for (const root of ['src', 'server', 'public', 'scripts', 'dist', '.server']) {
  for (const relative of fs.readdirSync(root, { recursive: true })) {
    const file = path.join(root, relative)
    if (!fs.statSync(file).isFile()) continue
    entries.push({ file: file.replaceAll('\\', '/'), sha256: sha256(file) })
  }
}
for (const file of ['package.json', 'package-lock.json', 'Dockerfile', '.dockerignore', '.env.example', '.env.production.example', '.gitignore', 'vite.config.ts', 'index.html', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'tsconfig.server.json', 'README.md', 'docs/production.md']) entries.push({ file, sha256: sha256(file) })
entries.sort((a, b) => a.file.localeCompare(b.file))
const gitBase = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
const versions = Object.fromEntries(['fastify', '@supabase/supabase-js', 'react', 'vite', 'typescript', 'playwright', 'tsx'].map(name => [name, require(name+'/package.json').version]))
const optional = name => fs.existsSync(output+'/'+name) ? JSON.parse(fs.readFileSync(output+'/'+name, 'utf8')) : null
const container = optional('container.json'), workflow = optional('workflow-versions.json')
const report = { release: 'Panoptes OS v1', evidence: 'production-mode local verification; hosted verification not performed', gitBase, sourceState: 'Approved working tree; identified by hashes, not claimed to be a committed/deployed revision',
  node: process.version, dependencies: versions, container: container ? { imageId: container.imageId, baseImage: container.baseImage, node: container.runtime?.node } : null,
  n8n: optional('n8n-runtime.json'), workflows: workflow?.workflows.filter(item => /panoptes/i.test(item.name) && item.activeVersionId) ?? null,
  files: entries, secretValuesRecorded: false }
fs.writeFileSync(output+'/artifacts.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({ filesHashed: entries.length, gitBase, hostedVerification: 'not performed' }))
