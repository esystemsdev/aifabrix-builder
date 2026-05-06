# Builder contributor route map (trust + controller APIs)

This file is **maintainer / contributor** context: (1) **Dataplane certification / trust** (plan **130-builder_cli_certification**), and (2) **MISO Controller HTTP routes** the CLI’s `lib/api/*` modules must align with when talking to the controller. End-user documentation stays under **`docs/commands/`** (command-centric; no HTTP tutorials there).

## MISO Controller — Integration Clients (source of truth)

The controller exposes **Integration Clients** under **`/api/v1/integration-clients` only**. The legacy **`/api/v1/service-users`** surface was removed (no alias). Permissions use the **`integration-client:*`** namespace.

Reference implementation and OpenAPI live in **aifabrix-miso**: `packages/miso-controller/openapi/integration-client.openapi.yaml` (included from `openapi/openapi.yaml`).

| Operation | HTTP | Path | Controller permission |
| --------- | ---- | ---- | --------------------- |
| Create (returns one-time `clientSecret`) | `POST` | `/api/v1/integration-clients` | `integration-client:create` |
| List (pagination / sort / filter / search) | `GET` | `/api/v1/integration-clients` | `integration-client:read` |
| Get by id | `GET` | `/api/v1/integration-clients/{id}` | `integration-client:read` |
| Regenerate secret | `POST` | `/api/v1/integration-clients/{id}/regenerate-secret` | `integration-client:update` |
| Replace group memberships | `PUT` | `/api/v1/integration-clients/{id}/groups` | `integration-client:update` |
| Replace redirect URIs | `PUT` | `/api/v1/integration-clients/{id}/redirect-uris` | `integration-client:update` |
| Deactivate (204, empty body) | `DELETE` | `/api/v1/integration-clients/{id}` | `integration-client:delete` |

**Create body (high level):** `key`, `displayName`, optional `description`, optional `keycloakClientId`, `redirectUris[]`, `groupNames[]` — see OpenAPI schemas for exact validation.

### Builder alignment

The Builder CLI uses **`lib/api/integration-clients.api.js`**, **`lib/commands/integration-client.js`**, and **`lib/cli/setup-integration-client.js`** (`aifabrix integration-client`) aligned with the table above and **`integration-client:*`** permissions.

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
