# Sanitized Panoptes workflows

These exports come from read-only inspection of the published local n8n definitions at the v1 freeze. They demonstrate the actual workflow code, expressions, connections, input mappings and deterministic policy. They contain no credential records, pinned data or execution samples. All exports are inactive for import.

## Files and import mapping

| File | Placeholder used by callers |
| --- | --- |
| [write-incident-event.json](write-incident-event.json) | `IMPORT_WRITE_INCIDENT_EVENT` |
| [collect-evidence.json](collect-evidence.json) | `IMPORT_COLLECT_EVIDENCE` |
| [retry-execution.json](retry-execution.json) | `IMPORT_RETRY_EXECUTION` |
| [verify-recovery.json](verify-recovery.json) | `IMPORT_VERIFY_RECOVERY` |
| [error-intake.json](error-intake.json) | `IMPORT_ERROR_INTAKE` |
| [human-approval.json](human-approval.json) | No inbound subworkflow placeholder in this export set |
| [operator-console-api.json](operator-console-api.json) | No inbound subworkflow placeholder in this export set |
| [sandbox-failure-generator.json](sandbox-failure-generator.json) | Optional synthetic failure fixture |

Import the four subworkflows first, then Error Intake, Human Approval and Operator Console API. Record the newly assigned workflow IDs. In **every Execute Sub-workflow node** in Error Intake and Human Approval, replace its `IMPORT_*` value with the imported target ID. The [sanitization inventory](sanitization.json) lists each calling node and target file; dependencies have not been deleted.

The optional Sandbox Failure Generator has two nodes: a dedicated POST webhook followed by a synthetic timeout error describing possible duplicate side effects. Its `settings.errorWorkflow` is `IMPORT_ERROR_INTAKE`; replace it with the imported Error Intake ID. Configure trusted Panoptes settings for the sandbox's new workflow ID before testing. An error-workflow mapping is required on other workflows you want to monitor as well. Do not execute the sandbox against operational recovery targets.

## Required configuration

1. Recreate/review the Panoptes database schema and observability view. Required objects are `panoptes_workflow_config`, `panoptes_incidents`, `panoptes_incident_events` and `panoptes_incident_observability`. A complete schema migration is not included; imports alone do not provision a working backend.
2. Assign a trusted Supabase credential to each Supabase node. Backend database access must preserve the reviewed grants/RLS boundary. Credential values and local account references are intentionally absent.
3. Assign n8n API Header Auth to the six HTTP Request nodes. Configure the API key in the credential, not in a public node parameter. Replace only `https://n8n.example.invalid` with your restricted n8n API origin, preserving `/api/v1/...` paths and expressions.
4. Assign a Groq credential to Error Intake's Groq Chat Model. Preserve its exported model/parser/prompt configuration; provider access is an external prerequisite, not guaranteed by this repository.
5. Assign approval Header Auth to Human Approval's Webhook. Its header name/value must match the gateway's server-only approval settings. The approval credential is separate from the n8n API credential.
6. Add trusted per-workflow configuration using newly assigned monitored workflow IDs. Do not treat AI output or imported operational data as trusted idempotency, budget or auto-recovery configuration.
7. Review import mappings, credential assignments, webhook paths and ingress before activation. Verify with disposable fixtures first. No imports, activation or live action tests were performed by M19.1.

The local source was n8n 2.36.9. Import compatibility on other versions is not established. Fresh-instance import/runtime verification remains unperformed; the JSON and structural comparisons pass without claiming a working one-click deployment.

## Sanitization decisions

- Top-level local workflow/version/instance metadata omitted; imports are inactive.
- Credential-reference objects removed; credential type and node assignments documented in `sanitization.json`.
- Six private/tunnel API origins replaced with a reserved `.invalid` placeholder; request paths, methods, query options and expressions preserved.
- Subworkflow resource references changed to explicit `IMPORT_*` IDs; local cached URLs/names removed.
- Five webhook instance IDs removed for regeneration on import. Fixed `panoptes/...` webhook paths retained because they define contracts.
- Node and condition IDs retained: these identify graph elements, not accounts or deployment resources. Node names, positions, types, code, retry settings and connections retained.
- Sandbox same-owner caller policy and binary/execution settings retained; its Error Intake dependency is explicitly mapped.

Validation reversed only these documented transformations and compared the complete definitions with private originals. All 73 code nodes and all connections match their source exactly. No production workflow was edited. Earlier local Git history retains historical identifiers; sanitizing these files does not erase that history.

See [architecture](../docs/architecture.md), [security](../docs/security.md) and [production requirements](../docs/production.md).
