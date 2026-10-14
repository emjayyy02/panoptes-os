# Panoptes OS

React/Vite/TypeScript operator console with a separate Node/TypeScript API gateway. M18.1 adds Supabase Auth and an application trust boundary while preserving the M17 dashboard, explorer, decision workflow, and System / Light / Dark themes.

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

Open http://127.0.0.1:5173. The gateway defaults to loopback port 3001. Vite forwards `/api/panoptes` unchanged to that gateway and never calls n8n. If Vite's temporary config loader fails with EPERM on Windows, use `npm run dev -- --configLoader runner`.

For an existing M17 `.env.local`, copy the previous `PANOPTES_DEV_PROXY_TARGET` value to `PANOPTES_N8N_ORIGIN` and add the Auth settings and console origin. `PANOPTES_DEV_PROXY_TARGET` and `VITE_PANOPTES_API_BASE` are no longer read. There is no direct n8n proxy fallback.

## Authentication and API boundary

The browser API base is fixed in code to `/api/panoptes`; environment variables cannot redirect it. The browser sends a Supabase access token as `Authorization: Bearer ...` to the gateway. The gateway verifies the token with the configured project's `getUser(token)` **on every request**, checks `PANOPTES_OPERATOR_IDS`, and derives the trusted operator from `user.id`. There are no authorization tables, roles, admin screens, or browser-provided operator identities.

| Gateway operation | Internal operation |
| --- | --- |
| `GET /api/panoptes/session` | Authorized operator identity; no n8n call |
| `GET /api/panoptes/incidents` | `GET /webhook/panoptes/incidents` |
| `GET /api/panoptes/incident?incident_id=...` | `GET /webhook/panoptes/incident?incident_id=...` |
| `GET /api/panoptes/summary` | `GET /webhook/panoptes/summary` |
| `POST /api/panoptes/approval` | `POST /webhook/panoptes/approval` |

Public approval JSON contains exactly `incident_id` and `decision` (`APPROVE` or `REJECT`). Extra fields, including `operator`, are rejected. The gateway constructs the internal JSON with `operator: verifiedUser.id` and injects the existing Header Auth credential only on this exact POST. Browser tokens, cookies, arbitrary headers, arbitrary routes, and upstream redirects are never forwarded. n8n remains authoritative for eligibility, recovery policy, and concurrent decisions. Successful responses retain the existing focused contract checks; errors are controlled and do not relay upstream credentials, bodies, or stack traces. Gateway responses use `Cache-Control: no-store`.

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
```

`build` produces frontend assets in `dist`; `build:server` produces independent server output in `.server`. `npm run start:api` runs the compiled server with environment variables supplied by the runtime. For a local compiled-server check, use `node --env-file=.env.local .server/server/index.js`. The server requires runtime configuration; the frontend uses only its public Auth configuration at build time.

Security tests use isolated Auth/upstream fixtures and synthetic credentials. They exercise the real Supabase server SDK, strict inputs, allowlist rejection, trusted identity/header injection, fixed routing, origin checks, bounded responses, upstream errors, and no POST retry. Local QA evidence under ignored `.qa/m18.1` separates real read-only browser verification from isolated action tests. Do not use live incidents for action tests without separately designated test incidents.

## Production prerequisites

M18.1 establishes the application boundary locally. A static frontend build and Vite preview do not include a proxy. A later deployment step must arrange HTTPS and same-origin routing of `/api/panoptes` to the Node gateway, supply server secrets at runtime, set `NODE_ENV=production`, and deploy only `dist` as public static assets. Production mode requires HTTPS origins and omits the ngrok development header. The gateway accepts only the configured console Origin when an Origin header is supplied; no cross-origin API access or wildcard CORS is enabled. Non-browser callers still require a valid bearer token and allowlisted ID.

Direct access to n8n operator webhook paths must be restricted by the later trusted network/ingress boundary. Gateway authentication does not secure a separately exposed n8n read webhook, and CORS is not that boundary. Existing Supabase `anon` / `authenticated` table grants and RLS also require a read-only audit before production, because browser Auth must not create a direct operational-data bypass. No Supabase schema, RLS policy, n8n workflow, hosting, tunnel, or ingress configuration is changed by this implementation.

Hosting, ingress changes, deployed verification, M18.2 reliability work, and M18.3 remain outside this milestone. Existing `occurred_at` sorting, raw backend statuses/timestamps, stale-data handling for ordinary API failures, and approval reconciliation are preserved.
