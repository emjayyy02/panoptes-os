# Panoptes OS v1 freeze — M18.3

Panoptes OS v1 is deployment-ready and locally verified in production mode. Always-on public hosting is intentionally not maintained for this US$0/month portfolio project.

Frozen on 2026-10-14 (Asia/Taipei), after `npm run verify:local` completed with exit code 0.

| Check | Result |
| --- | --- |
| Lint, frontend build, server build | PASS |
| Gateway and production static/security tests | 24/24 PASS |
| Compiled production-mode browser regression | 170 assertions PASS |
| Local container verification | 16 checks PASS; UID 1000, read-only filesystem, healthy; stopped afterward |
| Bundle/secret checks | PASS; 8 browser files scanned across normal/canary builds |
| Git whitespace check | PASS |

The browser used isolated HTTPS Auth/n8n fixtures and a virtual HTTPS origin routed to the actual loopback Fastify process. No Vite server ran. Untrusted upstream TLS was rejected; the fixture CA was trusted explicitly without disabling TLS verification or changing OS trust. Public HTTPS/ingress is not claimed to be verified.

Production frontend serving exposes only intended `dist` output. API misses remain JSON, private/traversal/map paths never fall back to HTML, and startup rejects unexpected build files or symlinks. Successful contracts, M17 UI source, Supabase Auth/allowlist architecture, and trusted operator injection are preserved.

No live approval/rejection POSTs were sent. Two browser action POSTs went only to the synthetic local fixture. No n8n workflows, operational data, existing Supabase project, or real `.env.local` were modified in M18.3. No hosted resources, paid/trial-backed services, payment methods, tunnels, or always-on services were provisioned. A separate free production Supabase project remains optional and eligibility-gated; provisioning and migration are deferred.

Secret evidence uses synthetic canaries/structural scans; actual `.env.local` secrets were not extracted for exact-value matching. Browser-public Auth settings are expected in browser output. Docker's public publishable-key ARG heuristic is not a privileged credential leak.

Artifact/source hashes, dependency versions, local container identity and active Panoptes workflow versions are recorded in [v1-freeze.json](v1-freeze.json). The approved working tree includes the preceding M18.2 changes; it is identified by file hashes, not represented as a new committed, pushed, or deployed revision. This manifest excludes its own generated freeze files to avoid self-referential hashes. Local QA reports/screenshots are under ignored `.qa/m18.3`; historical M17/M18.1/M18.2 evidence remains separate.

Hosted verification, real public HTTPS, restricted hosted n8n ingress, hosted workflow migration, and a separately authorized disposable-incident action are **not performed**. These are prerequisites for any later hosted claim. The Windows PC is not a production-hosting dependency. See [production requirements and known limitations](production.md).

Application feature scope is frozen at v1. Future changes belong to v1.1/backlog. M19 has not begun.
