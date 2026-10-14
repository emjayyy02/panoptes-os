# Panoptes OS

React/Vite/TypeScript operator console with a Node/TypeScript API gateway. M18.1 establishes Supabase Auth and the application trust boundary; M18.2 tightens reliability/configuration; M18.3 adds compiled production static serving and reproducible local production-mode verification while preserving the M17 interface.

The production budget is strictly US$0/month. No hosted deployment, paid/trial-backed infrastructure, tunnel, or always-on public service is required. See [production configuration, local verification, ingress requirements, and limitations](docs/production.md). Hosted verification is not performed.

The v1 freeze record is [docs/v1-freeze.md](docs/v1-freeze.md), with artifact hashes in [docs/v1-freeze.json](docs/v1-freeze.json).

## Local development

Use Node 24 and npm. Run `npm install`, then copy `.env.example` to ignored `.env.local` without overwriting an existing approval credential.

Configure the public Supabase project URL and **publishable key** in `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. Set the same project in server-only `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`. A legacy `anon` key is also supported. Never use a secret or service-role key. Supabase clients are used only for Auth, with no direct application-table queries.

Manually provision operator accounts in Supabase Auth, leave email/password login enabled, and disable public signup and anonymous sign-in. Put authorized user UUIDs in the comma-separated server-only `PANOPTES_OPERATOR_IDS`. All allowlisted operators have the same v1 permissions. An Auth user who is not in this list cannot access Panoptes data or decisions.

Set `PANOPTES_N8N_ORIGIN` to the existing upstream origin, `PANOPTES_CONSOLE_ORIGIN=http://127.0.0.1:5173`, and preserve `PANOPTES_APPROVAL_HEADER_NAME` / `PANOPTES_APPROVAL_HEADER_VALUE`. Origins must have no path, credentials, query, or fragment. Server startup fails closed for missing/invalid configuration; its diagnostic never prints supplied values.

Run these in separate terminals:

```text
npm run dev:api
npm run dev
```

Open http://127.0.0.1:5173. The gateway defaults to loopback port 3001. Both Node and Vite validate `PANOPTES_GATEWAY_PORT`; restart both processes after changing it. Vite always targets `127.0.0.1` at that port, forwards `/api/panoptes` unchanged, and never calls n8n. Keep the development gateway bound to loopback. If Vite's temporary config loader fails with EPERM on Windows, use `npm run dev -- --configLoader runner`.

For an existing M17 setup, configure the server-only `PANOPTES_N8N_ORIGIN` and add the Auth settings and console origin. `PANOPTES_DEV_PROXY_TARGET` and `VITE_PANOPTES_API_BASE` are obsolete: neither is referenced by runtime code. Remove obsolete entries manually if present; M18.2 leaves the real ignored `.env.local` untouched. There is no direct n8n proxy fallback.

## Authentication and API boundary

The browser API base is fixed in code to `/api/panoptes`; environment variables cannot redirect it. The browser sends a Supabase access token as `Authorization: Bearer ...` to the gateway. The gateway verifies the token with the configured project's `getUser(token)` **on every request**, checks `PANOPTES_OPERATOR_IDS`, and derives the trusted operator from `user.id`. There are no authorization tables, roles, admin screens, or browser-provided operator identities.

| Gateway operation | Internal operation |
| --- | --- |
| `GET /api/panoptes/session` | Authorized operator identity; no n8n call |
| `GET /api/panoptes/incidents` | `GET /webhook/panoptes/incidents` |
| `GET /api/panoptes/incident?incident_id=...` | `GET /webhook/panoptes/incident?incident_id=...` |
| `GET /api/panoptes/summary` | `GET /webhook/panoptes/summary` |
| `POST /api/panoptes/approval` | Advisory detail GET, then `POST /webhook/panoptes/approval` |

Public approval JSON contains exactly `incident_id` and `decision` (`APPROVE` or `REJECT`). Extra fields, including `operator`, are rejected. The gateway constructs the internal JSON with `operator: verifiedUser.id` and injects the existing Header Auth credential only on this exact POST. Browser tokens, cookies, arbitrary headers, arbitrary routes, and upstream redirects are never forwarded. n8n remains authoritative for eligibility, recovery policy, and concurrent decisions. Successful responses retain the existing focused contract checks; errors are controlled and do not relay upstream credentials, bodies, or stack traces. Gateway responses use `Cache-Control: no-store`.

Approval preflight rejects a missing incident or a detail that is no longer pending/has no proposed action. This GET grants no authorization and cannot guarantee that the subsequent POST succeeds. Human Approval revalidates its own conditions. Explicit backend HTTP 409 conflicts remain 409; an opaque failure after POST stays uncertain rather than being inferred from a later state read. The GET and POST share the gateway request deadline; neither is retried.

| Status | Meaning |
| --- | --- |
| 400 | Invalid request, decision, query, incident ID, or JSON |
| 401 / 403 | Invalid operator session / unauthorized operator or Origin |
| 404 | Unknown route or incident (upstream 404 or explicit `INCIDENT_NOT_FOUND`) |
| 409 | Advisory preflight state conflict or explicit backend approval conflict |
| 413 / 415 | Oversized request / unsupported request media type |
| 502 | Invalid/empty upstream response, credential failure, receipt mismatch, or unclassified upstream failure |
| 503 | Upstream 503, recognized connection unavailability, or temporary Auth failure including rate limiting |
| 504 | Upstream 504 or gateway deadline |

Unexpected empty responses remain 502: an empty body alone cannot prove an incident is missing. Incident IDs remain bounded opaque strings, not UUID-only values. Temporary Auth failures do not invalidate the browser session. Missing required server configuration prevents startup.

Sessions persist in **sessionStorage for the current tab**, with a separate SDK storage/BroadcastChannel key per tab. The SDK handles refresh; password fields clear on submit. Logout, terminal 401, denied operator access, or account changes remove protected content and invalidate in-flight reads. No approval POST is automatically retried. A failed acknowledgement remains uncertain and requires reading the backend state before another deliberate action.

SessionStorage is accessible to same-origin JavaScript. Closing a tab is not a server logout; browser restore/duplicated-tab behavior can preserve tab storage. Supabase logout revokes the session's refresh token but an issued access token can remain usable until expiry. Removing a UUID from the server allowlist and restarting the gateway provides an application-level access cutoff. This milestone does not claim immediate access-token revocation.

## Operator compatibility gate

Read-only inspection of the published **Panoptes OS — Human Approval** workflow (`8IfFkal3PzDaKTkx`, active version `b4750a8a-62d7-4c81-b282-1ffaf7571b25`) established that **Validate Approval Request** uses `const operator = body.operator ?? 'unknown'` and returns `operator: String(operator)`. No published node contains the literal `operator_console`. Approval/rejection updates, event data, and receipts preserve the supplied string. Evaluating only this validator in isolation accepted a synthetic user UUID; no webhook/workflow action was executed.

The validator SHA-256 is `bfc2a0c69435ac405eb6760cfe5c754bde08e937eab3ce1adbca9213c7255be3`. This is source-level compatibility evidence, not a live approval mutation or a database-constraint audit.

## Verification and builds

```text
npm run test:gateway
npm run lint
npm run build
npm run build:server
npm run test:production
npm run test:container
npm run test:bundle
```

`build` produces frontend assets in `dist`; `build:server` produces independent server output in `.server`. `npm start` / `npm run start:api` run compiled JavaScript with configuration supplied by the runtime. With `NODE_ENV=production`, the same process serves the frontend and `/api/panoptes`; development continues to use Vite and the local gateway. Use `.env.production.example` as the placeholder production map. The real `.env.local` remains untouched. The frontend uses only its public Auth configuration at build time.

Security tests use isolated Auth/upstream fixtures and synthetic credentials. They exercise the real Supabase server SDK, strict inputs, allowlist rejection, trusted identity/header injection, fixed routing, origin checks, bounded responses, upstream errors, and no POST retry. Local QA evidence under ignored `.qa/m18.1` separates real read-only browser verification from isolated action tests. Do not use live incidents for action tests without separately designated test incidents.

M18.2 evidence is kept separately under ignored `.qa/m18.2`. Workflow patches change only Operator API's `Get Incident Events` and summary `Get many rows` to Always Output Data, and Error Intake's `Normalize Failure Event` timestamp guard. Empty read results reach the existing builders, producing a known missing-incident marker, `timeline: []`, or zero summary totals. Valid numeric timestamps are milliseconds (including zero); valid date strings normalize to UTC. Missing, empty, invalid, non-finite, or out-of-range timestamps use ingestion time without changing historical rows/events.

Historical retry/budget combinations, timestamp ordering, and old row/event state differences remain evidence of earlier behavior. The current rejection mapping, retry budget/safety gates, immutable event writes, and lifecycle view are preserved. The catalog dependency audit is limited to the four named objects; it is not a blanket audit of unrelated RPCs or dynamic SQL.

## Production prerequisites

M18.3 verifies local production mode, not a hosted deployment. The compiled Fastify process publicly serves only verified `dist` assets; `.server` is executable private content. The current frontend uses `/` plus query parameters, so no broad SPA fallback exists. API misses/errors and private/source/map/traversal paths never become `index.html`. Startup refuses incomplete/unexpected build contents or symlinks. Production source maps are disabled. A future deployment still needs HTTPS termination, restricted HTTPS n8n ingress, runtime secrets, and `NODE_ENV=production`. Vite/preview are not the production server. The configured console Origin, per-request bearer verification and allowlist remain enforced for the API.

Direct access to n8n operator webhook paths must be restricted by the later trusted network/ingress boundary. Gateway authentication does not secure a separately exposed n8n read webhook, and CORS is not that boundary. The M18.2 user-executed catalog audit confirms revoked `anon` / `authenticated` privileges on the four Panoptes objects, RLS retained on tables, an invoker observability view, and retained `service_role` privileges. A real authenticated read-only application smoke passed after that grant change. Future objects/grants must preserve this boundary. No further schema or permission changes are part of this implementation.

M18.3 evidence under ignored `.qa/m18.3` uses isolated fixtures, the compiled production process, and local Docker. Real hosted HTTPS/ingress and hosted actions remain unverified. Optional separate Supabase Free provisioning is eligibility-gated and deferred; the current project, workflows, and operational data are unchanged. Existing sorting, backend statuses/timestamps, stale-data handling and approval reconciliation are preserved. No live approval/rejection action is used for verification. M19 and future feature work remain outside this freeze.
