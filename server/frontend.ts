import { lstat, readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { FastifyInstance } from 'fastify'

const types: Record<string, string> = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  avif: 'image/avif', gif: 'image/gif', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2',
}
const asset = /^assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|svg|png|jpe?g|webp|avif|gif|ico|woff2?)$/

export async function registerFrontend(app: FastifyInstance, directory: string): Promise<void> {
  const root = resolve(directory)
  const info = await lstat(root)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Invalid frontend build.')
  const files = new Map<string, Buffer>()
  const visit = async (folder: string, prefix = '') => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const name = prefix + entry.name
      if (entry.isDirectory() && /^(?:assets|assets\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)$/.test(name)) {
        await visit(join(folder, entry.name), name + '/')
      } else if (entry.isFile() && (name === 'index.html' || name === 'panoptes.svg' || asset.test(name))) {
        // Load the verified build once. Requests never become filesystem paths.
        files.set('/' + name, await readFile(join(folder, entry.name)))
      } else throw new Error('Unexpected file in frontend build.')
    }
  }
  await visit(root)
  if (!files.has('/index.html') || ![...files.keys()].some(name => name.endsWith('.js'))) throw new Error('Incomplete frontend build.')
  files.set('/', files.get('/index.html')!)
  for (const [path, body] of files) {
    app.route({ method: ['GET', 'HEAD'], url: path, handler: (request, reply) => reply
      .header('Cache-Control', path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Length', body.length)
      .type(types[path === '/' ? 'html' : path.split('.').at(-1)!])
      .send(request.method === 'HEAD' ? undefined : body) })
  }
}
