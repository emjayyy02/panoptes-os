# Production readiness at US$0/month

Panoptes OS v1 is deployment-ready and locally verified in production mode. Always-on public hosting is intentionally not maintained for this US$0/month portfolio project.

M18.3 verifies **production-mode local execution**. Hosted verification is not performed. No paid resource, trial-backed resource, payment-method-backed service, tunnel, domain, or always-on hosted process is required or provisioned. Local verification containers stop when checks finish. The Windows PC is a development/verification machine, not a claimed production host.

## Architecture and ingress requirements

The deployable shape is browser → HTTPS public origin → one compiled Fastify process serving the React build and `/api/panoptes` → restricted HTTPS n8n ingress → existing workflows → Supabase. A future hosting layer terminates public HTTPS and forwards to Node's private HTTP listener. Forward the entire origin to Node; do not strip `/api/panoptes` or add a Vite proxy. Only the static build is public, never the application directory.

Restrict all four n8n paths (`/webhook/panoptes/incidents`, `/incident`, `/summary`, `/approval`) to the trusted gateway network/path. The n8n editor, public API, test webhooks, alternate domains, and raw ports must not create a bypass. Keep approval Header Auth. CORS and hidden URLs are not ingress security. Production configuration continues to require HTTPS origins, including n8n. Private HTTPS must use a valid certificate and trusted CA; never disable certificate verification. If using a private CA, provision its public certificate to the Node runtime through `NODE_EXTRA_CA_CERTS`.

No provider is a required dependency. Render Free can run the combined stateless application but sleeps and cannot supply the current private, persistent n8n backend. Publishing a broken partial console is not the default. Self-hosted n8n Community Edition is free software, not a free hosted service. No sustainable complete US$0 hosted stack has been established by this milestone. These findings are a dated assessment, not a claim that no free infrastructure can ever exist.

## Configuration map

| Placement | Names | Meaning |
| --- | --- | --- |
| Browser build, public | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Matching production Auth project URL and publishable/legacy anon key |
| Server runtime | `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Per-request Auth verification against the same project |
| Server runtime only | `PANOPTES_OPERATOR_IDS` | Comma-separated provisioned operator UUIDs; uniform v1 permissions |
| Server runtime | `PANOPTES_CONSOLE_ORIGIN`, `PANOPTES_N8N_ORIGIN` | Exact HTTPS console origin and restricted HTTPS backend origin |
| Server secrets | `PANOPTES_APPROVAL_HEADER_NAME`, `PANOPTES_APPROVAL_HEADER_VALUE` | Existing Header Auth, injected only on the internal approval POST |
| Server listener | `PANOPTES_GATEWAY_HOST`, `PANOPTES_GATEWAY_PORT` | Loopback by default; container binds `0.0.0.0`, port 3001 |

The browser API is always `/api/panoptes`. Obsolete M17 API/proxy overrides are ignored. Never put privileged credentials, allowlist IDs, or approval Header Auth into `VITE_*`. The frontend/gateway need no service-role key. n8n separately requires its existing trusted Supabase/backend and other integration credentials; those never belong in this application's build context or public configuration.

`.env.production.example` contains placeholders only. M18.3 left the real `.env.local` untouched; public examples contain no real values. M19.1 audited local configuration without printing values and did not modify it. If real local production-mode configuration is needed later, the user may populate a separate ignored `.env.production.local`; keep it outside public assets and container context. Standard build tooling reads public build configuration normally, without logging values. Changing public build settings requires rebuilding the frontend. Inject server secrets only at runtime.

## Build and start

Use Node 24. The lockfile pins dependency resolution. From the project directory:

```text
npm ci
npm run build
npm run build:server
```

Supply the runtime variables securely, then run `npm start` (equivalently `node .server/server/index.js`). For a user-populated ignored file, `node --env-file=.env.production.local .server/server/index.js` is supported. Do not use Vite or Vite preview as the production server. `NODE_ENV=production` is mandatory for the combined static/API runtime. Unknown environment modes, missing required server settings, invalid/HTTP production origins, and privileged Auth keys fail startup without echoing values.

The compiled startup resolves `dist` relative to the compiled server, not a configurable public-root variable. It fails closed if the build is missing/incomplete, contains unexpected files, source maps, or symlinks. Public routes are exactly `/`, `/index.html`, `/panoptes.svg`, and recognized hashed build assets. Current frontend navigation uses `/?incident_id=...`; no generic SPA fallback is necessary. Unknown routes, all private paths, traversal/non-canonical paths, and API misses return errors instead of HTML. GET/HEAD assets are public; API identity/origin/allowlist hooks are encapsulated under `/api/panoptes`. API and entry HTML responses are not cached; hashed assets are immutable. Production source maps are explicitly disabled and refused by static serving.

## Reproducible local container

The Dockerfile pins the Node base digest, builds both outputs in a builder stage, installs runtime dependencies only, runs as `node`, and starts compiled JavaScript. `.dockerignore` allowlists source inputs; environment files, QA, Git, build outputs, backups, and private keys are excluded. Runtime contains `dist`, `.server`, dependency manifests and production dependencies. `.server` remains private filesystem content, never a served root. Only the two public Auth settings are build arguments.

For a zero-cost synthetic local check:

```text
docker build --build-arg VITE_SUPABASE_URL=https://auth.example.invalid --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_container_fixture -t panoptes-os:m18.3-local .
npm run test:container
```

Those public fixture values intentionally cannot sign into a real project. For an actual later deployment, rebuild with user-supplied public Auth settings and securely inject the runtime variables. Do not pass a real environment file into the build. Bind published ports to `127.0.0.1` for local checks. A private HTTP listener does not establish public HTTPS; that remains a hosting-layer requirement.

## Verification and evidence boundaries

```text
npm run lint
npm run build
npm run build:server
npm run test:gateway
npm run test:production
npm run test:container
npm run test:bundle
```

Browser regression uses pinned Playwright. Windows uses installed Microsoft Edge; other systems use Playwright Chromium (`npx playwright install chromium`). Certificate generation requires OpenSSL (Windows Git's OpenSSL is detected; override its location with `PANOPTES_OPENSSL`). It generates a short-lived fixture certificate/key and removes the temporary fixture tree afterward; it never changes the OS trust store.

`npm run verify:local` runs the full sequence above and stops at the first failure. After checks, `node scripts/record-artifacts.mjs` records source/build hashes and available local version evidence under `.qa/m18.3`; it does not itself declare a freeze or run live actions.

`test:production` builds a synthetic production frontend, starts the actual compiled Fastify entry with `NODE_ENV=production`, and exercises the real Supabase SDK against isolated HTTPS fixtures. Gateway TLS rejects the untrusted fixture and succeeds only with its explicit CA. The browser uses a virtual HTTPS origin routed to the loopback process and certificate-verified fixture requests; this verifies rendering and application flows, **not a real public TLS edge**. No Vite server, real account, real workflow or operational data is used. Action tests use only synthetic fixtures. Local read-only Docker tests verify startup, health, non-root execution, context exclusions, source/tool exclusion, and private-path denial.

Evidence under ignored `.qa/m18.3` is separate from M18.1/M18.2. Real Supabase login/read/logout evidence remains the M18.2 record and is not relabeled as a production-mode rerun. Historical M18.3 secret scans used canaries and structural checks; they did not extract actual `.env.local` secrets for exact matching. M19.1 publication scanning is recorded separately in [publication validation](publication.md). Browser output legitimately contains public Supabase settings. Docker may heuristically flag the publishable-key build argument because its name contains `KEY`; it is deliberately public, not a privileged secret.

## Future free Supabase boundary and deferred hosted verification

A separate Supabase Free project remains preferred if the account is eligible without payment or an upgrade. Do not provision it as a requirement for this local freeze. If the free allowance is unavailable, leave the existing project unchanged and defer. Any eventual project must reproduce the reviewed schema/view, table RLS, revoked browser table/column privileges, invoker view, retained backend privileges, disabled signup/anonymous Auth, and manually provisioned operators. Preserve trusted workflow configuration and avoid importing local incidents/execution IDs as hosted recovery targets.

If a genuinely viable free backend becomes available later, the deployment sequence is: confirm no billing/payment/trial dependency → validate persistent/restricted n8n hosting and backups → prepare the separate eligible Supabase project → migrate only approved workflow dependencies and credentials → build the combined application → inject runtime configuration → establish HTTPS/private routing → verify read-only access and public n8n denial. Do not expose n8n temporarily to make setup easier.

Hosted smoke sequence, deferred: anonymous login/API denial → operator login → summary/list/detail/direct URL → refresh → session restoration → non-operator/spoof rejection → HTTPS/secret/private-path/ingress checks → logout and signed-out reload. Only after separate authorization may one designated disposable incident receive one action POST, with trusted identity/event persistence/reconciliation verified. No such live action is part of M18.3 local verification.

## Known limitations

- No publicly deployed application, hosted verification, public HTTPS edge, or hosted action proof.
- No guaranteed always-on free n8n host has been established. The current local n8n exposure is not claimed to satisfy future production ingress.
- Separate production Supabase provisioning and hosted workflow migration are deferred, not silently replaced with the local project's data.
- SessionStorage/XSS exposure and access-token expiry behavior remain as documented in M18.1; approval preflight cannot guarantee acceptance or concurrency outcomes.
- Opaque backend failures after an approval remain uncertain; no automatic action retry is introduced.
- Historical row/event quirks and existing retry/recovery policy remain unchanged.
- GitHub publishing, hosted deployment, new product features and portfolio editing remain deferred. M19.1 changes public packaging/documentation only.

## Historical hosting assessment references (M18.3, 2026-10-14)

- [Render Free limits](https://render.com/docs/free) and [billing behavior without a payment method](https://render.com/docs/faq).
- [Supabase Free project allowance](https://supabase.com/docs/guides/platform/billing-on-supabase) and [inactivity pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
- [n8n hosted plans and self-hosted Community Edition](https://n8n.io/pricing/).
