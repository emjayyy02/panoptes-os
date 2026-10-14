# M19.1 publication validation

Panoptes OS v1 is deployment-ready and locally verified in production mode. Always-on public hosting is intentionally not maintained for this US$0/month portfolio project.

M19.1 prepares a reviewed local diff only. No commit, remote, GitHub repository, push, tag, release or deployment is performed. Git history is unchanged. Application source, gateway behavior, API contracts, dependencies, scripts and build paths are unchanged.

## Public package

- Concise README with architecture, capabilities, setup, disclosure and screenshot links.
- Architecture, security and testing documents, alongside aligned production/freeze records.
- Seven core sanitized workflow exports and one optional synthetic Sandbox Failure Generator.
- Per-node credential assignments and import-time dependency mapping in the workflow inventory.
- Five synthetic screenshots, with their provenance documented.

Original freeze/README/production files and read-only workflow definitions remain under ignored `.qa/m19.1/private-originals`. Raw M17/M18 QA evidence remains private and is not copied into the public package.

## Validation performed

| Check | M19.1 result |
| --- | --- |
| Lint, frontend build, server build | PASS |
| Gateway/static-security tests | 24/24 PASS |
| Production browser regression | 170 assertions PASS against isolated local HTTPS fixtures |
| Container verification | 16 checks PASS; separate local test image, verification container stopped |
| Bundle verification | PASS; 8 browser files scanned across normal/canary builds |
| Screenshot capture | 34 harness checks PASS; all five assets visually reviewed; zero action POSTs |
| Workflow preservation | Eight definitions (168 nodes) compared by reversing only documented sanitization; all 73 code nodes syntax-checked and unchanged; connections and graph targets valid |
| Public content | 97 public files scanned with no findings; 76 local links valid; JSON/JSONC valid; 71 frozen source hashes match |
| Ignore rules | Real environment, private key, raw export, dump and runtime paths excluded; both public environment examples remain tracked and unignored |
| Whitespace | `git diff --check` PASS |

These counts remain separate. Production regression made two action POSTs to synthetic fixtures only; zero live n8n approval POSTs were sent. Historical M17/M18 reports were not overwritten: existing harnesses were copied into ignored M19.1 tooling with output redirected to the new evidence directory. The test container did not replace or restart the user's n8n container.

The first restricted-sandbox test run encountered loopback/symlink permission failures, and fixture OpenSSL initially failed to initialize. Repeating the unchanged checks outside that restriction passed. No application changes were made to accommodate those environment failures.

## Publication safety and limitations

No real credential leak was detected in proposed public content. The scan checks actual local approval-credential matches without printing the value, private URLs, local workflow/account references, machine paths, connection strings, privileged-token formats and private-key material. Synthetic test credentials and secret-detection strings remain in tests. This is bounded evidence, not a guarantee that every possible secret format is detectable.

Current freeze files omit machine-specific workflow/version IDs and local container identities. Original application source hashes retain their historical meaning; documentation and generated-output hashes are omitted. Earlier local commits still contain historical identifiers. No history rewrite or credential rotation was performed.

Workflow JSON is structurally validated, but no fresh-instance import or operational execution is claimed. Imports require new credential assignments, n8n API origins, subworkflow mappings, a reviewed database schema/view and trusted per-workflow configuration. A complete database migration is not included. Published local definitions were inspected read-only and rechecked against the original freeze versions with no changes; credential records, operational rows and executions were not exported.

Public screenshots show fixtures rather than hosted or operational evidence. Hosted HTTPS/ingress, hosted migration, public deployment and always-on service remain unverified and intentionally unmaintained. See [testing](testing.md), [workflow setup](../workflows/README.md) and [production requirements](production.md).

The local public package is ready for an explicitly authorized M19.2 publication review, with these limitations disclosed. M19.1 itself performs no publication action.

## Exact public file inventory

Five tracked files modified and twenty public files created; no files moved or deleted. Private tooling/evidence is ignored and is not part of this publication inventory.

| Change | File |
| --- | --- |
| Modified | [.gitignore](../.gitignore) |
| Modified | [README.md](../README.md) |
| Modified | [docs/production.md](production.md) |
| Modified | [docs/v1-freeze.json](v1-freeze.json) |
| Modified | [docs/v1-freeze.md](v1-freeze.md) |
| Created | [docs/architecture.md](architecture.md) |
| Created | [docs/publication.md](publication.md) |
| Created | [docs/security.md](security.md) |
| Created | [docs/testing.md](testing.md) |
| Created | [screenshots/README.md](../screenshots/README.md) |
| Created | [screenshots/approval-confirmation.png](../screenshots/approval-confirmation.png) |
| Created | [screenshots/dashboard-dark.png](../screenshots/dashboard-dark.png) |
| Created | [screenshots/dashboard-light.png](../screenshots/dashboard-light.png) |
| Created | [screenshots/incident-explorer.png](../screenshots/incident-explorer.png) |
| Created | [screenshots/login.png](../screenshots/login.png) |
| Created | [workflows/README.md](../workflows/README.md) |
| Created | [workflows/collect-evidence.json](../workflows/collect-evidence.json) |
| Created | [workflows/error-intake.json](../workflows/error-intake.json) |
| Created | [workflows/human-approval.json](../workflows/human-approval.json) |
| Created | [workflows/operator-console-api.json](../workflows/operator-console-api.json) |
| Created | [workflows/retry-execution.json](../workflows/retry-execution.json) |
| Created | [workflows/sandbox-failure-generator.json](../workflows/sandbox-failure-generator.json) |
| Created | [workflows/sanitization.json](../workflows/sanitization.json) |
| Created | [workflows/verify-recovery.json](../workflows/verify-recovery.json) |
| Created | [workflows/write-incident-event.json](../workflows/write-incident-event.json) |
