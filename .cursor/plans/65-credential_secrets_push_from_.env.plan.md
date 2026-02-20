---
name: Credential secrets push from .env
overview: Add a Builder-side service that reads KV_* variables from the integration (or builder) .env file and pushes them to the dataplane via POST /api/v1/credential/secret before upload/publish, so external integrations can use credentials in cloud or local dataplane without extra steps. Update documentation accordingly.
todos: []
isProject: false
---

# Push KV_* credentials to dataplane on upload/deploy

## Goal

- **Case 1 – .env**: When an external integration has **KV_XXXX_YYYY** keys in **integration folder** `.env`, push those values (after resolving any `kv://` in the value from Builder secrets) to the dataplane secret store (POST `/api/v1/credential/secret`) so publish can resolve `kv://` from the store.
- **Case 2 – application JSON**: When the application/manifest JSON (upload payload) contains **kv://** references and there is **no** value for that ref in `.env`, still try to resolve the value from **aifabrix secret systems** (local file e.g. `secrets.local.yaml`, or remote secret) and push it to the dataplane. So config that references `kv://secrets/foo` is satisfied from local/remote secrets even if the developer did not add `KV_SECRETS_FOO` to `.env`.
- This happens automatically during **aifabrix upload** (and, if desired, any deploy path that ends in dataplane publish) so users do not need extra steps.
- Documentation updated to describe both cases and the automatic push behavior.

## Context

- **Dataplane API** (from your OpenAPI): `POST /api/v1/credential/secret` accepts an array of `SecretStoreItem` (`key`: kv:// path, `value`: plain), returns `SecretStoreResponse` (e.g. `stored` count). Requires **credential:create** and OAuth2 (Bearer). Values are encrypted at rest; no plaintext in DB or logs.
- **Builder today**: [lib/commands/upload.js](lib/commands/upload.js) runs upload → validate → publish against the dataplane; it does **not** send secrets. [.cursor/plans/dataplane.md](.cursor/plans/dataplane.md) describes the backend secret store and states the CLI will call this endpoint separately.
- **Convention**: Env vars `KV_<PART1>_<PART2>_...` map to `kv://part1/part2/...` (lowercase, underscores to slashes). Example: `KV_SECRETS_CLIENT_SECRET` → `kv://secrets/client-secret`.
- **Two sources for secrets to push**: (1) KV_* from `.env` (values resolved if they are `kv://`); (2) kv:// refs found in the upload payload (application + dataSources JSON) that are not already provided by `.env` — resolve their values from aifabrix secret systems (local file or remote) and push those too.

## Architecture

```mermaid
sequenceDiagram
  participant User as aifabrix upload
  participant Cmd as commands/upload.js
  participant Helper as credential-secrets-push helper
  participant Env as integration/<key>/.env
  participant API as POST /credential/secret
  participant Publish as pipeline upload/validate/publish

  User->>Cmd: upload <system-key>
  Cmd->>Cmd: validate, build payload
  Cmd->>Helper: pushCredentialSecrets(dataplaneUrl, auth, systemKey, payload)
  Helper->>Env: read .env (if exists)
  Helper->>Helper: parse KV_* → items; resolve kv:// in values (loadSecrets)
  Helper->>Helper: scan payload for kv:// refs not in .env; resolve from loadSecrets (local/remote)
  Helper->>Helper: merge items (dedupe by key), plain values only
  alt items.length > 0
    Helper->>API: POST body items (plain values only)
    API-->>Helper: { stored: N }
  end
  Helper-->>Cmd: (void or warning)
  Cmd->>Publish: upload → validate → publish
```



- **When**: Before `runUploadValidatePublish` in the upload command (and, if you add a deploy path that calls dataplane publish, before that publish).
- **Where .env is read**: `integration/<systemKey>/.env` for upload. Use [lib/utils/paths.js](lib/utils/paths.js) `getIntegrationPath(systemKey)` then `path.join(..., '.env')`.
- **Resolve internal secrets before send**: (1) If a value in .env for a KV_* key is itself a **kv://** reference, resolve it using Builder secret resolution so we send plain values. (2) For **kv:// refs in the application JSON** (upload payload) that are not already supplied via .env, resolve their values from aifabrix secret systems ([lib/core/secrets.js](lib/core/secrets.js) `loadSecrets` — local file or remote); add those as items to push. The dataplane API expects plain values only; never send unresolved kv:// strings as values.
- **Behavior**: Best-effort: if the credential/secret request fails (e.g. 403 Forbidden for missing `credential:create`), log a clear warning and **continue** with upload/publish so teams without the permission can still upload; secrets would then rely on dataplane env or manual setup.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc). Applicable sections:

- **[Architecture Patterns – API Client Structure](.cursor/rules/project-rules.mdc#architecture-patterns)** – New `lib/api/credential.api.js` and `lib/api/types/credential.types.js`; use `ApiClient`, JSDoc types, `@requiresPermission` for Dataplane `credential:create`.
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** – Secret management: never log or persist secret values; use existing Bearer auth; validate kv path shape before sending.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** – Async/await, try-catch, `path.join()` for paths, chalk for CLI output, input validation.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** – Never log secrets/tokens; structured messages; best-effort warning and continue for 403/401.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** – Upload command integration: clear messages, handle success/warning, no change to payload or validate/publish.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest, mock API and fs, tests in `tests/` mirroring `lib/`; 80%+ coverage for new code.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines, functions ≤50 lines; JSDoc for all public functions.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** – Build, lint, test must pass before commit; no hardcoded secrets.

**Key requirements**

- Use `lib/api/index.js` `ApiClient` for `POST /api/v1/credential/secret`; add JSDoc `@requiresPermission {Dataplane} credential:create`.
- Add `lib/api/types/credential.types.js` with `SecretStoreItem` and `SecretStoreResponse`.
- In credential-secrets-env: resolve `kv://` in values via `lib/core/secrets.js`; never send or log plain secret values; log only counts/key names.
- Unit tests for credential.api (mock ApiClient), credential-secrets-env (KV_* conversion, resolution, payload scan), and upload integration (mock credential API + pipeline).
- JSDoc on all new public functions; keep files and functions within size limits.

## Before Development

- [ ] Read API Client Structure and Secret Management sections in project-rules.mdc.
- [ ] Review [lib/api/pipeline.api.js](lib/api/pipeline.api.js) and [lib/core/secrets.js](lib/core/secrets.js) for patterns.
- [ ] Confirm dataplane `POST /api/v1/credential/secret` contract (key/value shape, auth).
- [ ] Review [lib/commands/upload.js](lib/commands/upload.js) for where to call the push helper and how auth is obtained.
- [ ] Review [permissions-guide.md](.cursor/plans/permissions-guide.md) (or repo equivalent) for `@requiresPermission` and [docs/commands/permissions.md](docs/commands/permissions.md) updates.

## Definition of Done

Before marking this plan complete:

1. **Build**: Run `npm run build` first (must succeed; runs lint + test).
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings).
3. **Test**: Run `npm test` or `npm run test:ci` after lint; all tests must pass; ≥80% coverage for new code.
4. **Validation order**: BUILD → LINT → TEST (mandatory; do not skip steps).
5. **File size**: Files ≤500 lines, functions ≤50 lines.
6. **JSDoc**: All new public functions have JSDoc (params, returns, errors, `@requiresPermission` where applicable).
7. **Code quality**: All applicable rule requirements met.
8. **Security**: No hardcoded secrets; no logging of secret values; ISO 27001–aligned secret handling.
9. **Docs**: external-integration, secrets-and-config (or env-template), and permissions updated as in Implementation plan §5.
10. All implementation tasks (API module, credential-secrets-env, upload integration, tests, docs) completed.

## Implementation plan

### 1. Dataplane credential API module (Builder)

- **New file**: [lib/api/credential.api.js](lib/api/credential.api.js)
  - `storeCredentialSecrets(dataplaneUrl, authConfig, items)` where `items` is `Array<{ key: string, value: string }>`.
  - Calls `POST /api/v1/credential/secret` with body `items`. Use existing [lib/api/index.js](lib/api/index.js) `ApiClient` (same pattern as [lib/api/pipeline.api.js](lib/api/pipeline.api.js)).
  - JSDoc: `@requiresPermission {Dataplane} credential:create`.
- **New file**: [lib/api/types/credential.types.js](lib/api/types/credential.types.js) (optional but aligned with project rules)
  - JSDoc types for `SecretStoreItem` (`key`, `value`) and `SecretStoreResponse` (e.g. `stored: number`).

### 2. KV_* → kv:// conversion, .env reading, and resolving internal secrets

- **New file**: [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js) (or under `lib/commands/` if preferred)
  - `collectKvEnvVarsAsSecretItems(envMap)`: from a key-value map (from .env), keep only keys that start with `KV`*; for each, convert key to kv path: strip prefix `KV`*, split by `_`, join with `/`, lowercase → `kv://segment1/segment2/...`. Return `Array<{ key: string, value: string }>`. Skip empty values. Do **not** resolve values here.
  - **Resolve internal secrets before sending**: For each item's `value`, if it looks like a `kv://` reference (e.g. `value.trim().startsWith('kv://')`), resolve it using Builder's existing secret resolution so the dataplane receives plain values only. Use [lib/core/secrets.js](lib/core/secrets.js): `loadSecrets(undefined, appName)` (or from integration path if available), then replace `kv://` in the value with the resolved secret (e.g. use the same logic as `replaceKvInContent` / `resolveKvReferences` for a single line, or load secrets into a map and resolve by kv key). If resolution fails (missing secret), either skip that item and log a warning (key only) or fail the push; plan recommends **skip + warn** so other secrets still get pushed.
  - **From payload (Case 2)**: `collectKvRefsFromPayload(payload)`: recursively or via regex scan the upload payload (application + dataSources) for all string values that match `kv://...`. Return unique kv:// refs. For each ref **not** already in the list from .env, resolve value via `loadSecrets(undefined, appName)` (local file or remote); if resolution succeeds, add `{ key: ref, value: resolvedPlain }` to the items to push. If resolution fails (missing secret), skip that ref and optionally log a warning (key only).
  - `pushCredentialSecrets(dataplaneUrl, authConfig, { envFilePath, appName, payload })` (or `pushCredentialSecretsForUpload(...)`): (1) Build items from .env: read `envFilePath`, parse to map, `collectKvEnvVarsAsSecretItems(map)`, resolve any `kv://` in values (loadSecrets). (2) Build items from payload: `collectKvRefsFromPayload(payload)`, for each ref not already in items, resolve from loadSecrets and add. (3) Merge and dedupe by key; filter to valid kv path form. (4) If any items, call `storeCredentialSecrets(dataplaneUrl, authConfig, items)`. Do **not** log secret values; log only counts or key names. (Backward-compat: keep a thin `pushCredentialSecretsFromEnvFile(...)` that only does .env if preferred, and have upload call the full helper with payload.)
  - Validation: only send keys that match a valid `kv://` path form; filter out’ invalid conversions. Values sent must be **resolved plain strings**, not `kv://` refs.

### 3. Integrate into upload command

- In [lib/commands/upload.js](lib/commands/upload.js):
  - After building the payload (manifest) and `resolveDataplaneAndAuth` / `requireBearerForDataplanePipeline`, before `runUploadValidatePublish`:
    - Call the new helper with **both** .env path and **payload** (e.g. `pushCredentialSecrets(dataplaneUrl, authConfig, { envFilePath: path.join(getIntegrationPath(systemKey), '.env'), appName: systemKey, payload })`). The helper will push secrets from .env (KV_*) and from kv:// refs in the payload that are resolved via aifabrix secret systems (local/remote).
    - On success (2xx): log a short message (e.g. "Pushed N credential secrets to dataplane.").
    - On 403/401: log a warning (e.g. "Could not push credential secrets (permission denied or unauthenticated). Ensure dataplane role has credential:create if you use KV_* in .env.") and continue.
    - On other errors: either log warning and continue (best-effort) or, if you prefer strict behavior, fail the command; the plan recommends **best-effort** so upload still succeeds.
  - No change to payload building or to validate/publish calls; they remain as today.

### 4. “Deploy” coverage

- User asked for “upload and deploy”. In this repo, the only dataplane publish path is **upload** (`aifabrix upload <system-key>`). `aifabrix deploy <app>` goes through the controller pipeline (validate/deploy). So the only required integration point is **upload**.
- If later you add a command or path that deploys an external system to the dataplane (e.g. a dedicated “deploy external” that calls the same publish endpoint), reuse the same helper before that publish so KV_* from the same integration .env are pushed.

### 5. Documentation

- **Upload command**: In [docs/commands/external-integration.md](docs/commands/external-integration.md), in the “aifabrix upload” section:
  - Add a step: before publish, the CLI (1) reads `integration/<system-key>/.env` and sends any `KV`_* variables (values resolved from local/remote secrets if they are `kv://`), and (2) scans the upload payload (application + datasources) for `kv://` references that are **not** in .env and resolves their values from aifabrix secret systems (local file or remote), then sends all to the dataplane secret store (`POST /api/v1/credential/secret`). So credentials in config can be satisfied from .env or from local/remote secrets without extra steps.
  - Mention that dataplane permission **credential:create** is required for this automatic push; if the push fails (e.g. 403), upload still continues but secrets must be available elsewhere (e.g. env on dataplane).
- **Secrets / kv://**: In [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md) (or [docs/configuration/env-template.md](docs/configuration/env-template.md)), add a short subsection:
  - For **external integrations**, you can (1) put values in `integration/<system-key>/.env` with keys like `KV_SECRETS_CLIENT_SECRET` (plain or `kv://...`), and/or (2) reference `kv://...` in application/datasource config — even without .env, upload will try to resolve those from aifabrix secret systems (local file or remote) and push them to the dataplane. Format for .env: `KV`_ + segments with underscores → `kv://segment1/segment2/...` (lowercase).
- **Permissions**: In [docs/commands/permissions.md](docs/commands/permissions.md), add a note under `aifabrix upload` that **credential:create** (Dataplane) is also required if you rely on automatic push of KV_* from `.env`; otherwise upload still runs but secrets are not pushed.

### 6. Tests

- **credential.api.js**: Unit test that mocks ApiClient; assert POST to `/api/v1/credential/secret` with correct body and auth.
- **credential-secrets-env.js**: Tests for `collectKvEnvVarsAsSecretItems`: (1) KV_A_B → kv://a/b, (2) multiple KV_* keys, (3) non-KV_ keys omitted, (4) empty values omitted, (5) invalid/empty input. Tests for **value resolution**: value `kv://some/key` is resolved via mocked `loadSecrets`/replace and the API is called with the resolved plain value; unresolved kv:// is skipped or warned. Tests for **Case 2**: `collectKvRefsFromPayload` returns unique kv:// refs from nested JSON; when payload contains `kv://secrets/foo` and it is not in .env, resolve from mocked loadSecrets and assert it is included in the items sent to the API; when resolution fails, that ref is skipped (and optionally warned). Optionally test full `pushCredentialSecrets` with mocked fs and API (env + payload, dedupe, both sources pushed).
- **upload command**: Integration or unit test: when a test .env with KV_* is present and/or payload contains kv:// refs, assert that the credential API is called with the expected items (from .env and from payload) before publish (mock the credential API and pipeline calls).

## Files to add or touch


| Area    | Action                                                                                                                                                                                                                                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API     | Add [lib/api/credential.api.js](lib/api/credential.api.js) (storeCredentialSecrets); optionally [lib/api/types/credential.types.js](lib/api/types/credential.types.js)                                                                                                                                                                 |
| Util    | Add [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js) (KV_* from .env, collectKvRefsFromPayload, resolve from loadSecrets, merge + push)                                                                                                                                                                      |
| Command | Modify [lib/commands/upload.js](lib/commands/upload.js) (call push before runUploadValidatePublish; handle success/warning)                                                                                                                                                                                                            |
| Docs    | Update [docs/commands/external-integration.md](docs/commands/external-integration.md) (upload flow + KV_* push); [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md) or env-template (KV_* for external); [docs/commands/permissions.md](docs/commands/permissions.md) (credential:create for upload) |
| Tests   | Add tests for credential.api, credential-secrets-env, and upload (mock credential + pipeline)                                                                                                                                                                                                                                          |


## Security and compliance

- Do **not** log or persist secret values; log only counts and key names (e.g. kv path).
- Use existing auth (Bearer) for POST /api/v1/credential/secret; no new credentials in code.
- Validate kv path shape before sending (filter invalid keys) so the API receives only valid refs.

## Optional follow-ups

- Support **builder** `.env` (e.g. for `aifabrix deploy <app>` when app is external and a future path pushes to dataplane): reuse the same helper with `getBuilderPath(appName)` + `.env`.
- If the dataplane documents a different KV_* ↔ kv:// convention, align the conversion in `collectKvEnvVarsAsSecretItems` with that spec.

---

## Plan Validation Report

**Date**: 2025-02-20  
**Plan**: .cursor/plans/65-credential_secrets_push_from_.env.plan.md  
**Status**: ✅ VALIDATED

### Plan Purpose

Add a Builder-side flow that (1) reads `KV_*` variables from integration (or builder) `.env`, resolves any `kv://` in values via Builder secrets, and pushes plain values to the dataplane via `POST /api/v1/credential/secret`; (2) scans the upload payload for `kv://` refs not supplied by `.env`, resolves them from aifabrix secret systems (local/remote), and pushes those too. Automatic on upload (and any future deploy path that hits dataplane publish). Documentation updated for both cases and for required permissions. **Type**: Development (CLI + API + utils) + Security (secret management) + Documentation. **Scope**: `lib/api/` (new credential API + types), `lib/utils/` (credential-secrets-env), `lib/commands/upload.js`, docs (external-integration, secrets-and-config, permissions), tests.

### Applicable Rules

- ✅ [Architecture Patterns – API Client Structure](.cursor/rules/project-rules.mdc#architecture-patterns) – New credential API and types; use ApiClient and @requiresPermission
- ✅ [Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001) – Secret management, no logging of secrets
- ✅ [Code Style](.cursor/rules/project-rules.mdc#code-style) – Async/await, paths, validation
- ✅ [Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging) – Never log secrets; best-effort warnings
- ✅ [CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development) – Upload command integration
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) – Jest, mocks, coverage
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – File/function size, JSDoc
- ✅ [Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) – Build, lint, test, no secrets in code

### Rule Compliance

- ✅ DoD requirements: Documented (build → lint → test, file size, JSDoc, security, coverage)
- ✅ API client: Plan uses lib/api/, types, @requiresPermission
- ✅ Secret management: Plan explicitly forbids logging secret values; uses existing auth
- ✅ Testing: Plan specifies unit tests for API, util, and upload integration with mocks
- ✅ Documentation: Plan includes doc updates for upload flow, KV_*, and permissions

### Plan Updates Made

- ✅ Added **Rules and Standards** with links to project-rules.mdc and key requirements
- ✅ Added **Before Development** checklist (rules, pipeline.api, secrets.js, upload.js, permissions)
- ✅ Added **Definition of Done** (build, lint, test, order, file size, JSDoc, security, docs, tasks)
- ✅ Appended this validation report

### Recommendations

- When implementing, add `lib/api/types/credential.types.js` (plan marks it optional but project rules require type definitions for API request/response).
- Ensure permissions-guide path is correct (e.g. under `.cursor/` or repo root) and update Before Development link if needed.
- Run `npm run build` (or lint then test) before marking the plan complete to satisfy DoD.

