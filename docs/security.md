# Security and reliability

## Authentication and authorization

The browser uses Supabase Auth email/password login for manually provisioned operators. Public signup and anonymous Auth must be disabled. Only a publishable or legacy anon key is accepted by the application; no service-role key is needed by the frontend or gateway.

Every gateway API request verifies its bearer token with the configured project's `getUser(token)`, then checks the server-only `PANOPTES_OPERATOR_IDS` allowlist. All allowlisted operators have the same v1 permissions. A valid Auth account alone does not grant access. The trusted operator is `user.id`, not a browser-provided field.

The browser uses Auth only and makes no direct application-table queries. Backend n8n credentials are configured separately. The reviewed database boundary covers `panoptes_workflow_config`, `panoptes_incidents`, `panoptes_incident_events` and `panoptes_incident_observability`: revoked browser table/column privileges, retained table RLS, an invoker view and retained backend privileges. This is bounded historical evidence, not a blanket audit of arbitrary SQL, future objects or RPCs. See [testing provenance](testing.md).

## Gateway trust boundary

- Fixed upstream origin and route allowlist; browser environment values cannot redirect the API.
- Strict query/body limits and response contract checks; no arbitrary forwarding or upstream redirects.
- Browser bearer tokens, cookies and arbitrary headers never pass through to n8n.
- Internal Header Auth is injected only on the exact approval POST.
- Exact console Origin checks; API responses use `Cache-Control: no-store`.
- Controlled failures do not relay upstream response bodies, credentials or stack traces.
- Bounded deadlines and responses; approval preflight and POST share a deadline and are not retried.
- Missing/invalid configuration fails startup without printing supplied values.

| Status | Meaning |
| --- | --- |
| 400 | Invalid body, query, decision or incident ID |
| 401 / 403 | Invalid session / denied operator or Origin |
| 404 | Unknown route or explicitly missing incident |
| 409 | Preflight conflict or explicit backend approval conflict |
| 413 / 415 | Request too large / unsupported media type |
| 502 | Invalid upstream response, receipt mismatch or unclassified failure |
| 503 | Recognized upstream unavailability or temporary Auth failure, including rate limiting |
| 504 | Deadline or upstream timeout |

An unexpected empty upstream body is not proof of a missing incident. Temporary Auth failures preserve the browser session. An opaque failure after a POST does not prove acceptance or rejection.

## Human decisions and recovery safety

AI diagnosis cannot authorize recovery. Deterministic policy, trusted workflow configuration, integer retry budgets and independent safety checks remain in the workflows. Approval revalidates backend state; gateway preflight cannot eliminate concurrent changes. Confirmation dialogs require a deliberate decision, and the browser does not automatically retry failed actions.

Event writes preserve operator and recovery evidence. Duplicate detection is not a claim of end-to-end exactly-once delivery or race-free execution. [Architecture](architecture.md) describes the actual policy and execution gates.

## Sessions and limitations

Sessions persist in `sessionStorage` for the current tab, using separate SDK storage/BroadcastChannel keys per tab. The SDK handles refresh. Password fields clear on submission. Logout, terminal 401, denied access and account changes remove protected content and invalidate in-flight reads.

SessionStorage remains accessible to same-origin JavaScript. Browser restore/duplicated tabs can retain storage, and closing a tab is not server logout. Supabase logout revokes refresh tokens; an issued access token may remain usable until expiry. Removing an operator UUID from the allowlist and restarting the gateway provides an application access cutoff. Immediate token revocation is not claimed.

## Production ingress and public assets

HTTPS termination and restricted n8n ingress are required for hosted operation. Gateway authentication does not protect separately exposed n8n read webhooks. CORS, private-looking URLs and approval Header Auth are not substitutes for restricting all operator webhook paths, alternate ports/domains and editor/API access to the trusted backend boundary.

The compiled Fastify process serves only verified `dist` assets. Source, `.server`, environment files, maps and traversal paths never become the frontend. Production startup rejects unexpected build content or symlinks; TLS verification must remain enabled. See [production requirements](production.md).

## Publication hygiene

Real environment files, certificates/keys, raw exports, dumps, logs and QA evidence remain ignored. Public workflow exports remove credential references and private origins while preserving code and contracts. Imports remain inactive until configured. Synthetic screenshots contain no operator email or operational account identifiers.

M19.1 sanitizes current public files only. Earlier local commits retain historical workflow/version identifiers; no Git history was rewritten. No confirmed real credential exposure was found in the audit. Do not publish the ignored evidence or local runtime volumes.
