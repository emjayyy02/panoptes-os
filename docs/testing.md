# Verification evidence

Panoptes OS v1 is deployment-ready and locally verified in production mode. Always-on public hosting is intentionally not maintained for this US$0/month portfolio project.

Milestone results below are historical records, reviewed during M19.1. They overlap and must not be summed into one total. Raw reports, credentials, machine paths and operational incident data remain in ignored local QA evidence.

## Historical milestones

| Milestone | Recorded result | Scope and provenance |
| --- | --- | --- |
| M17.2 | Historical live APPROVE accepted; fresh REJECT user-confirmed | Earlier agent-run APPROVE recorded recovery-pending state, retry/event evidence and console reconciliation. Fresh REJECT after a backend mapping fix was confirmed by the user: escalated/rejected, rejection event, no retry, controls removed. No incident ID was supplied for that fresh REJECT. Neither action was repeated in the final verification update. |
| M17.3 | 233 frontend checks; 115 proxy/security checks PASS | Light/Dark and responsive Explorer/UI matrix, with read-only backend evidence. Browser action POSTs intercepted/simulated; no upstream approval HTTP request. This predates M18 authentication. |
| M18.1 | 14 gateway tests; 128 isolated browser assertions PASS | Synthetic Auth/upstream action fixtures, plus separately recorded real authenticated read-only login/read/logout. No live approval mutation. |
| M18.2 | 19 gateway tests; 142 isolated browser assertions PASS | Synthetic Auth/upstream fixtures; real authenticated read-only smoke; bounded workflow timestamp/empty-result checks. No live approval POST. |
| M18.3 freeze | 24 gateway/static-security tests; 170 production browser assertions; 16 container checks PASS | Actual compiled production process with synthetic HTTPS Auth/n8n fixtures; local Docker. Zero live approval POSTs; two action POSTs went only to the local fixture. |

M18.3 also recorded lint, frontend/server builds, whitespace and bundle checks passing. Eight browser files were scanned across normal/canary builds, with maps and private canaries absent. [Freeze record](v1-freeze.md) and [sanitized manifest](v1-freeze.json) retain the historical results and frozen application source hashes.

## Database permission provenance

M18.2 completion records distinguish **user-executed post-REVOKE catalog evidence** from the agent-observed real read-only application smoke. The reported final state revoked `anon`/`authenticated` table and column privileges on the four reviewed Panoptes objects, retained table RLS and the invoker observability view, and retained backend `service_role` privileges.

An earlier retained catalog artifact describes the pre-remediation state; it is not the final acceptance result. This summary does not reinterpret it as a fresh database audit. No M19.1 grants, policies, schema edits or data mutations are performed. The evidence is bounded to the named objects, not arbitrary future objects, RPCs or dynamic SQL.

## What production-mode verification proves

The production browser harness builds an isolated frontend, starts the compiled Fastify entry with `NODE_ENV=production`, and exercises the real Supabase SDK against local HTTPS fixtures. Untrusted fixture TLS is rejected; an explicitly trusted fixture CA permits the test. Browser traffic uses a virtual HTTPS origin routed to the actual loopback process. There is no Vite server and no public HTTPS edge.

Coverage includes authentication/allowlist denial, trusted operator injection, fixed routing, stale preflight, error handling, uncertain action acknowledgement, logout/in-flight invalidation, direct incident navigation, private-path/static protections and responsive login. Container checks cover non-root execution, health, read-only filesystem and public/private asset boundaries; the verification container stops afterward.

**Not performed:** hosted deployment verification, public HTTPS/ingress verification, hosted workflow migration, live production use, or a hosted approval action. Local results do not prove always-on operation or real-client outcomes.

## Reproduce isolated checks

Use Node 24 and install the locked dependencies with `npm ci`.

```text
npm run lint
npm run build
npm run build:server
npm run test:gateway
npm run test:production
npm run test:container
npm run test:bundle
```

`npm run verify:local` runs this sequence and stops on failure. Container verification requires a running Docker engine. Browser regression uses Playwright and installed Edge on Windows; other systems need Playwright Chromium. Local certificate generation requires OpenSSL. See [production.md](production.md) for prerequisites and fixture transport details.

Tests use synthetic action targets. Do not substitute operational incidents into the action harness. Ordinary builds may load public Auth settings from a local environment file; server-only values must never be placed in `VITE_*`.

## Public screenshot provenance

The five images in [screenshots](../screenshots/README.md) use synthetic local fixtures and the unchanged compiled application. Visible synthetic operator email is replaced with a demo-operator label in the capture DOM only. No real incident/account data or live action is used. A confirmation screenshot illustrates the decision UI, not completed recovery.

M19.1 check results are recorded separately in [publication validation](publication.md); they do not replace the original freeze evidence.
