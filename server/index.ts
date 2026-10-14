import { readConfig } from './config.js'
import { buildApp } from './app.js'

try {
  const config = readConfig()
  const app = buildApp(config)
  const close = async () => { await app.close(); process.exit(0) }
  process.once('SIGINT', () => { void close() })
  process.once('SIGTERM', () => { void close() })
  await app.listen({ host: config.host, port: config.port })
  console.log(`Panoptes gateway listening on port ${config.port}.`)
} catch {
  // Third-party exceptions may include supplied credentials or URLs.
  console.error('Panoptes gateway could not start. Check server configuration and port availability; see .env.example.')
  process.exitCode = 1
}
