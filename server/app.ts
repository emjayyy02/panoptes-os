import Fastify from 'fastify'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { AuthBoundaryError, createTokenVerifier } from './auth.js'
import type { VerifyToken } from './auth.js'
import type { GatewayConfig } from './config.js'
import { forwardPanoptes, GatewayError } from './panoptes.js'
import type { Resource, UpstreamFetch } from './panoptes.js'
import type { ApprovalRequest } from '../src/types/panoptes.js'

const incidentIdSchema = { type: 'string', minLength: 1, maxLength: 256, pattern: '^\\S+$' }
const emptyQuery = { type: 'object', properties: {}, additionalProperties: false }

export function buildApp(config: GatewayConfig, dependencies: { verifyToken?: VerifyToken; upstreamFetch?: UpstreamFetch } = {}) {
  const app = Fastify({
    logger: false, bodyLimit: 4096, requestTimeout: 20_000, exposeHeadRoutes: false, trustProxy: false,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } },
  })
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    const path = request.raw.url!.split('?')[0]
    // All current routes use canonical ASCII paths; query values may still be encoded.
    if (/[\\%]/.test(path) || path.includes('//') || path.split('/').some(part => part.startsWith('.'))) {
      throw new GatewayError(404, 'Panoptes resource not found.')
    }
  })
  app.setNotFoundHandler((_request, reply) => reply.code(404).header('Cache-Control', 'no-store').send({ success: false, message: 'Panoptes resource not found.' }))
  app.setErrorHandler((error, _request, reply) => {
    reply.header('Cache-Control', 'no-store')
    if (error instanceof GatewayError || error instanceof AuthBoundaryError) {
      return reply.code(error.status).send({ success: false, message: error.message })
    }
    const candidate = typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500
    const status = [400, 413, 415].includes(candidate) ? candidate : 500
    return reply.code(status).send({ success: false, message: status === 413 ? 'Request body is too large.' : status === 415 ? 'Use application/json for approval requests.' : status === 400 ? 'Invalid Panoptes request.' : 'Panoptes gateway request failed.' })
  })
  // Encapsulation keeps public build assets outside every API authentication hook.
  app.register(async api => {
    const verifyToken = dependencies.verifyToken ?? createTokenVerifier(config)
    const identities = new WeakMap<FastifyRequest, { operator: string; token: string; signal: AbortSignal }>()

    api.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff')
      const signal = AbortSignal.timeout(18_000)
      if (request.headers.origin !== undefined && request.headers.origin !== config.consoleOrigin) {
        throw new GatewayError(403, 'This request origin is not allowed.')
      }
      const authorization = request.headers.authorization
      const headerCount = request.raw.rawHeaders.filter((_, i) => i % 2 === 0 && request.raw.rawHeaders[i].toLowerCase() === 'authorization').length
      const match = typeof authorization === 'string' && /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization)
      if (!match || headerCount !== 1) throw new AuthBoundaryError(401)
      const operator = await verifyToken(match[1], signal)
      if (!config.operatorIds.has(operator)) throw new GatewayError(403, 'This account is not an authorized Panoptes operator.')
      identities.set(request, { operator, token: match[1], signal })
    })
    api.addHook('preValidation', async request => {
      const params = new URL(request.raw.url!, config.consoleOrigin).searchParams
      if ([...params.keys()].some(key => params.getAll(key).length !== 1)) throw new GatewayError(400, 'Duplicate query parameters are not allowed.')
    })
    const notFound = (_request: FastifyRequest, reply: FastifyReply) => reply.code(404).send({ success: false, message: 'Panoptes operation not found.' })
    api.all('/', notFound)
    api.all('/*', notFound)
    api.get('/session', { schema: { querystring: emptyQuery } }, async request => ({ success: true, operator: identities.get(request)!.operator }))
    const forward = (resource: Resource, request: FastifyRequest, incidentId?: string, approval?: ApprovalRequest) => {
      const { operator, token, signal } = identities.get(request)!
      return forwardPanoptes(config, resource, operator, token, signal, incidentId, approval, dependencies.upstreamFetch)
    }
    for (const resource of ['incidents', 'summary'] as const) {
      api.get(`/${resource}`, { schema: { querystring: emptyQuery } }, request => forward(resource, request))
    }
    api.get<{ Querystring: { incident_id: string } }>('/incident', {
      schema: { querystring: { type: 'object', required: ['incident_id'], additionalProperties: false, properties: { incident_id: incidentIdSchema } } },
    }, request => forward('incident', request, request.query.incident_id))
    api.post<{ Body: ApprovalRequest }>('/approval', {
      schema: {
        querystring: emptyQuery,
        body: { type: 'object', required: ['incident_id', 'decision'], additionalProperties: false,
          properties: { incident_id: incidentIdSchema, decision: { type: 'string', enum: ['APPROVE', 'REJECT'] } } },
      },
    }, request => forward('approval', request, undefined, request.body))
  }, { prefix: '/api/panoptes' })
  return app
}
