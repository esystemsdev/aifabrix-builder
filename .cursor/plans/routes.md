# Builder ↔ Dataplane trust (contributor map)

This file is **maintainer / contributor** context for plan **130-builder_cli_certification** and related work. End-user documentation lives under **`docs/commands/`** (command-centric; no HTTP tutorials there).

## Certification block on disk

- **Location:** `integration/<systemKey>/<systemKey>-system.json` or `.yaml`, top-level **`certification`** object only.
- **Schema:** `lib/schema/external-system.schema.json` → `properties.certification` (must stay aligned with dataplane `app/schemas/json/external-system.schema.json` when both exist in a workspace).

## Builder modules (symbols)

| Area | Module(s) | Role |
| ---- | ----------- | ---- |
| Trust HTTP client | `lib/api/certificates.api.js` | `getActiveIntegrationCertificate`, `listIntegrationCertificates`, `verifyIntegrationCertificate` — returns full dataplane-shaped objects to callers. |
| Types | `lib/api/types/certificates.types.js` | JSDoc typedefs for certificate / verify payloads (camelCase). |
| Merge artifact → file | `lib/certification/merge-certification-from-artifact.js` | `buildCertificationFromArtifact` — builds the **schema-shaped** `certification` object (including optional `status`, `level`, HS256 dev placeholder when needed). |
| Patch writer | `lib/certification/sync-system-certification.js` | `maybeSyncSystemCertificationFromDataplane`, `syncSystemCertificationFromDataplane`, `resolvePrimarySystemFilePath`, `collectActiveArtifacts`. |
| After external flows | `lib/certification/sync-after-external-command.js` | `trySyncCertificationFromDataplaneForExternalApp`. |
| After unified tests | `lib/certification/post-unified-cert-sync.js` | `afterUnifiedValidationCertSync` (used from `datasource-unified-test-cli.js`). |
| Skip flag parsing | `lib/certification/cli-cert-sync-skip.js` | `cliOptsSkipCertSync` — interprets Commander `certSync` / `--no-cert-sync`. |
| Validate hook | `lib/validation/validate-external-cert-sync.js` | Optional `--cert-sync` after successful external validate. |
| Show / verify UX | `lib/app/certification-show-enrich.js`, `lib/app/show-display.js`, `lib/app/show.js` | Local `certification` preview + optional online verify rows (`--verify-cert`). |
| TTY envelope | `lib/utils/datasource-test-run-certificate-tty.js` | Certification section for unified validation TTY output. |

## Commands that touch certification sync (CLI entrypoints)

Wiring is spread across Commander setup and command modules; search for **`maybeSyncSystemCertificationFromDataplane`**, **`trySyncCertificationFromDataplaneForExternalApp`**, **`afterUnifiedValidationCertSync`**, and **`cliOptsSkipCertSync`** when adding new flows.

User-facing flag summary: **`docs/commands/certification-and-trust.md`**.
