---
name: ISO 27001 secrets encryption fixes
overview: Close ISO 27001 gaps by ensuring a secrets-encryption key and config.yaml exist whenever any secret command runs, encrypting all secret values by default when writing to file-based stores (user and shared secrets.local.yaml, admin-secrets.env), and optionally storing the bootstrap key only in config to avoid plaintext key in secrets files.
todos: []
isProject: false
---

# ISO 27001 Secrets Encryption and Defaults – Fix Plan

## Current gaps (validated in code)

1. **Encryption key and config.yaml only on up-infra**
  `[ensureSecretsEncryptionKey](lib/core/ensure-encryption-key.js)` is invoked only from `[lib/cli/setup-infra.js](lib/cli/setup-infra.js)` (up-infra). If a user runs `aifabrix secret set`, `secret list`, `secret validate`, `secret remove`, or `secure` first, no `config.yaml` is created and no encryption key exists.
2. **secret set writes plaintext**
  `[handleSecretsSet](lib/commands/secrets-set.js)` uses `[saveLocalSecret](lib/utils/local-secrets.js)` / `[saveSecret](lib/utils/local-secrets.js)`, which call `[mergeSecretsIntoFile](lib/utils/secrets-generator.js)` with the raw value. There is no encryption; values are stored in plaintext in user and shared `secrets.local.yaml`.
3. **admin-secrets.env is always plaintext**
  `[generateAdminSecretsEnv](lib/core/secrets.js)` in `lib/core/secrets.js` writes `admin-secrets.env` with plaintext `KEY=value`. `[readAndDecryptAdminSecrets](lib/core/admin-secrets.js)` already supports `secure://` and decrypts; the writer never uses encryption.
4. **Bootstrap key written in plaintext to secrets file**
  When generating a new key, `[ensure-encryption-key.js](lib/core/ensure-encryption-key.js)` calls `saveLocalSecret(ENCRYPTION_KEY, newKey)`, so the key is stored in plaintext in `~/.aifabrix/secrets.local.yaml`. For stronger compliance, the generated key can be stored only in `config.yaml`.

---

## Target behavior

- **Default: create config and encryption key when using any secret command**  
On first use of any secret-related command, ensure `config.yaml` exists and has a `secrets-encryption` key (create one if missing), so encryption is always available.
- **Default: encrypt all values**  
Whenever the CLI writes to file-based secret stores (user `secrets.local.yaml`, shared `secrets.local.yaml`, and `admin-secrets.env`), values are encrypted when a `secrets-encryption` key is configured (which will be always after the above).
- **Admin and shared secrets files**  
Same encryption behavior for local user secrets, shared file-based secrets, and admin-secrets.env (write `secure://` when key is set; existing read/decrypt path already supports it).

---

## Implementation plan

### 1. Ensure encryption key (and config.yaml) for all secret commands

- **Where:** `[lib/cli/setup-secrets.js](lib/cli/setup-secrets.js)` (and optionally the command handlers so it runs before any secret I/O).
- **What:** At the start of each secret command action (list, set, remove, validate) and before `handleSecure`, call `config.ensureSecretsEncryptionKey()`. That will:
  - Create `config.yaml` (via `saveConfig`) when it does not exist.
  - Create and persist a new `secrets-encryption` key when none exists in config or in user/project secrets files.
- **Note:** `ensureSecretsEncryptionKey` already uses `getConfig()` (which returns in-memory defaults when file is missing) and `saveConfig()` (which creates the file). No change needed in `[lib/core/config.js](lib/core/config.js)` or `[lib/core/ensure-encryption-key.js](lib/core/ensure-encryption-key.js)` for “create config when missing”; only the call sites need to be added.

**Concrete change:** In `setup-secrets.js`, at the beginning of each `.action(...)` for `secret list`, `secret set`, `secret remove`, `secret validate`, and in the `secure` command action, add `await config.ensureSecretsEncryptionKey();` (with `config = require('../core/config')` if not already present). Ensure try/catch and error handling still apply.

---

### 2. Encrypt by default when writing to secrets files (user and shared)

- **Where:** `[lib/utils/local-secrets.js](lib/utils/local-secrets.js)` – `saveLocalSecret` and `saveSecret`.
- **What:** Before merging into the file, if a `secrets-encryption` key is available (from config), encrypt the value(s) with `[encryptSecret](lib/utils/secrets-encryption.js)` and write the `secure://...` form. If no key is configured, keep current behavior (plaintext) for backward compatibility.
- **Bootstrap key:** When the caller is `ensure-encryption-key.js`, it currently calls `saveLocalSecret(ENCRYPTION_KEY, newKey)` before `setSecretsEncryptionKey(newKey)`, so at that moment there is no key in config yet; the bootstrap key will still be written once in plaintext. Optionally (see §5) stop writing the bootstrap key to the secrets file and store it only in config.

**Concrete changes:**

- In `saveLocalSecret`: require `config.getSecretsEncryptionKey()` (async). If key is present and the secret key is not the bootstrap key `secrets-encryptionKeyVault`, encrypt the value; then call `mergeSecretsIntoFile` with the (possibly encrypted) value. Use the same pattern for the single key in the object passed to `mergeSecretsIntoFile`.
- In `saveSecret`: same idea – resolve encryption key from config; if present, encrypt each value (except bootstrap key) before calling `mergeSecretsIntoFile`. Both functions must stay async where they need to call config.
- **Shared path:** `[lib/commands/secrets-set.js](lib/commands/secrets-set.js)` uses `saveSecret(key, value, resolvedPath)` for the shared file path. Once `saveSecret` encrypts when key is set, shared file writes are covered. No need to duplicate logic in the command.
- **Backward compatibility:** If `getSecretsEncryptionKey()` returns null (e.g. old install without key), write plaintext so existing flows keep working until the user runs a command that triggers ensureSecretsEncryptionKey.

---

### 3. Encrypt admin-secrets.env when writing

- **Where:** `[lib/core/secrets.js](lib/core/secrets.js)` – `generateAdminSecretsEnv`.
- **What:** After loading secrets (and resolving `postgres-passwordKeyVault` etc.), if `config.getSecretsEncryptionKey()` returns a key, encrypt each value with `encryptSecret` and write lines like `POSTGRES_PASSWORD=secure://...` instead of plaintext. `[readAndDecryptAdminSecrets](lib/core/admin-secrets.js)` already decodes `secure://`; no change there.
- **Edge case:** If encryption is not configured at call time (e.g. very old path), keep writing plaintext so Docker Compose and existing callers still work.

**Concrete change:** In `generateAdminSecretsEnv`, require config and secrets-encryption helper. When building the env content, for each variable (e.g. `POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_PASSWORD`, `REDIS_COMMANDER_PASSWORD`) if encryption key is present, set `valueToWrite = encryptSecret(value, key)` and write `KEY=valueToWrite`; otherwise write current plaintext.

---

### 4. Optional: Do not write bootstrap key to secrets file

- **Where:** `[lib/core/ensure-encryption-key.js](lib/core/ensure-encryption-key.js)`.
- **What:** When generating a new key, only call `config.setSecretsEncryptionKey(newKey)` and do **not** call `saveLocalSecret(ENCRYPTION_KEY, newKey)`. The key then exists only in `config.yaml`, reducing plaintext secrets in `secrets.local.yaml`. Existing logic that “reads key from user/project secrets file if not in config” remains for migration; only the “generate new key” branch is changed.
- **Doc:** Update `[docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md)` (and any related docs) to state that when the CLI creates a new encryption key, it stores it only in `config.yaml`; the `secrets-encryptionKeyVault` in secrets files is only for pre-existing or migrated keys.

---

### 5. Tests and docs

- **Tests:**  
  - Ensure `ensureSecretsEncryptionKey` is invoked from secret list/set/remove/validate and secure (e.g. in `[tests/lib/cli.test.js](tests/lib/cli.test.js)` or setup-secrets tests if present).  
  - Add or extend tests for `saveLocalSecret` / `saveSecret`: with mock config returning an encryption key, assert that the value written to the file is `secure://...` (or that `encryptSecret` was called).  
  - For `generateAdminSecretsEnv`, with encryption key set, assert admin-secrets.env content contains `secure://` for the relevant keys.  
  - If bootstrap key is no longer written to secrets file, adjust tests that expect the key in the user secrets file after bootstrap.
- **Docs:**  
  - [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md): state that the CLI ensures a `secrets-encryption` key and `config.yaml` when using any secret command; that all values written to file-based secrets (user, shared, and admin-secrets.env) are encrypted by default when the key is set; and that the bootstrap key is stored only in config (if §4 is implemented).  
  - [docs/commands/utilities.md](docs/commands/utilities.md): mention that `secret set` (and related) now create config and encryption key if missing and write encrypted values by default.

---

## Summary of files to touch


| Area                              | File                                                                                                                                           | Change                                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ensure key on all secret commands | [lib/cli/setup-secrets.js](lib/cli/setup-secrets.js)                                                                                           | Call `config.ensureSecretsEncryptionKey()` at start of secret list/set/remove/validate and secure actions                                         |
| Encrypt on write (user + shared)  | [lib/utils/local-secrets.js](lib/utils/local-secrets.js)                                                                                       | In `saveLocalSecret` and `saveSecret`, get encryption key from config; if set, encrypt value (except bootstrap key) before mergeSecretsIntoFile   |
| Encrypt admin-secrets.env         | [lib/core/secrets.js](lib/core/secrets.js)                                                                                                     | In `generateAdminSecretsEnv`, if encryption key set, write `secure://` values for admin vars                                                      |
| Bootstrap key only in config      | [lib/core/ensure-encryption-key.js](lib/core/ensure-encryption-key.js)                                                                         | In “generate new key” branch, remove `saveLocalSecret(ENCRYPTION_KEY, newKey)`; only call `setSecretsEncryptionKey(newKey)`                       |
| Docs                              | [docs/configuration/secrets-and-config.md](docs/configuration/secrets-and-config.md), [docs/commands/utilities.md](docs/commands/utilities.md) | Document default encryption, config/key creation, and bootstrap key storage                                                                       |
| Tests                             | CLI and secrets tests                                                                                                                          | Ensure key is ensured for secret commands; assert encrypted writes in local-secrets and generateAdminSecretsEnv; adjust bootstrap tests if needed |
| Ensure key on register/rotate     | [lib/app/register.js](lib/app/register.js), [lib/app/rotate-secret.js](lib/app/rotate-secret.js)                                               | Call `config.ensureSecretsEncryptionKey()` at start of register and rotate-secret flows                                                           |
| Admin read/write + encryption     | [lib/infrastructure/helpers.js](lib/infrastructure/helpers.js)                                                                                 | ensureAdminSecrets: read/write via decrypt and encrypt. prepareInfraDirectory: async, get password from readAndDecryptAdminSecrets                |
| Infra down/restart decrypted env  | [lib/infrastructure/index.js](lib/infrastructure/index.js)                                                                                     | For down, down -v, restart: write decrypted temp file, pass to compose, delete in finally                                                         |


---

## Order of implementation

1. Add `ensureSecretsEncryptionKey()` to all secret and secure command actions, and to app register and rotate-secret flows (so config and key exist before any write).
2. Implement encrypt-by-default in `saveLocalSecret` and `saveSecret`.
3. Implement encrypt-by-default in `generateAdminSecretsEnv` and in `ensureAdminSecrets` when writing back to admin-secrets.env.
4. Fix admin-secrets consumers for encrypted file: make `prepareInfraDirectory` async and use `readAndDecryptAdminSecrets`; for stopInfra/stopInfraWithVolumes/restartInfraService use decrypted temp file for `--env-file`.
5. Optionally remove bootstrap key write to secrets file in `ensure-encryption-key.js`.
6. Update tests and documentation.

This keeps existing behavior when no key is configured (plaintext) while making the default path ISO 27001-aligned: config and key created on first secret use, all file-based secret values encrypted by default, and admin-secrets.env encrypted at rest when the key is set.

---

## Docker Compose and secret resolution (validation)

### Infra up – already correct

- **Flow:** `startInfra` → `startDockerServicesAndConfigure` → `prepareRunEnv(infraDir)` → `readAndDecryptAdminSecrets()` → writes **decrypted** content to temp `.env.run` → `startDockerServices(..., runEnvPath, ...)` with that temp path as `--env-file`.
- **Conclusion:** Compose **up** already receives a decrypted temp file. If we store admin-secrets.env encrypted on disk, this path continues to work: read and decrypt, write temp, pass temp to compose, then delete temp (ISO 27K).

### Infra down / restart – need fix when admin-secrets is encrypted

- **Current:** `stopInfra`, `stopInfraWithVolumes`, `restartInfraService` in [lib/infrastructure/index.js](lib/infrastructure/index.js) pass `adminSecretsPath` (persistent admin-secrets.env) directly to `--env-file`. If that file holds `secure://` values, compose would get literal `POSTGRES_PASSWORD=secure://...` and may misbehave or fail.
- **Fix:** For down/restart, use the same pattern as up: call `readAndDecryptAdminSecrets()`, write decrypted content to a temp file in the infra dir, pass that temp path to compose, then delete the temp file in a `finally` block. So all compose commands that use `--env-file` see only decrypted content.

### “Add a new database” (miso init, app run)

- **ensureMisoInitScript** ([lib/infrastructure/helpers.js](lib/infrastructure/helpers.js)) reads `databases-miso-controller-0-passwordKeyVault` from **loadSecrets()** (main secrets store, i.e. secrets.local.yaml). That store is already decrypted by `loadSecrets`; no change needed when we encrypt file-based secrets (we decrypt on read).
- **App run with databases:** [lib/app/run-env-compose.js](lib/app/run-env-compose.js) builds `.env.run` and `.env.run.admin` using `readAndDecryptAdminSecrets()` and resolved kv:// from loadSecrets. Compose uses those files as `env_file`. So when adding a new database, secrets are resolved (and decrypted) before compose runs. No change needed.

---

## All admin-secrets usages and required fixes


| Location                                                                                                              | Current behavior                                                                                                                       | Required when admin-secrets.env is encrypted                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [lib/infrastructure/services.js](lib/infrastructure/services.js) `startDockerServicesAndConfigure`                    | Uses `prepareRunEnv()` → readAndDecrypt + temp file                                                                                    | No change; already decrypted temp.                                                                                                                                                                                                                                                                           |
| [lib/infrastructure/services.js](lib/infrastructure/services.js) `startDockerServices`                                | Receives path (up path passes temp)                                                                                                    | N/A when called from startDockerServicesAndConfigure.                                                                                                                                                                                                                                                        |
| [lib/infrastructure/index.js](lib/infrastructure/index.js) `stopInfra`, `stopInfraWithVolumes`, `restartInfraService` | Pass persistent admin-secrets.env path to compose                                                                                      | Use decrypted temp file (same pattern as prepareRunEnv), pass temp to compose, delete after.                                                                                                                                                                                                                 |
| [lib/infrastructure/helpers.js](lib/infrastructure/helpers.js) `prepareInfraDirectory`                                | `fs.readFileSync(adminSecretsPath)` + regex `POSTGRES_PASSWORD=(.+)`                                                                   | Must not read raw file. Get password from `readAndDecryptAdminSecrets(adminSecretsPath)` and use `adminObj.POSTGRES_PASSWORD`. Make `prepareInfraDirectory` async (or have caller pass decrypted admin obj).                                                                                                 |
| [lib/infrastructure/helpers.js](lib/infrastructure/helpers.js) `ensureAdminSecrets`                                   | Reads file with `fs.readFileSync`, regex for backfill/overwrite, writes with `applyPasswordToAdminSecretsContent` + `fs.writeFileSync` | When **reading**: use `readAndDecryptAdminSecrets()` to detect empty/backfill and get current values. When **writing**: build env key-value object; if encryption key set, encrypt each value and write `KEY=secure://...`; else write plaintext. Reuse or share serialization with generateAdminSecretsEnv. |
| [lib/core/secrets.js](lib/core/secrets.js) `generateAdminSecretsEnv`                                                  | Writes plaintext only                                                                                                                  | Plan §3: write `secure://` when key set.                                                                                                                                                                                                                                                                     |
| [lib/app/run-env-compose.js](lib/app/run-env-compose.js)                                                              | `readAndDecryptAdminSecrets()` + envObjectToContent                                                                                    | No change; already decrypts.                                                                                                                                                                                                                                                                                 |


**Concrete changes to add to the plan:**

- **prepareInfraDirectory:** Make it async. At start, call `await readAndDecryptAdminSecrets(adminSecretsPath)` (or accept optional pre-decrypted admin obj from caller). Use `adminObj.POSTGRES_PASSWORD` for generatePgAdminConfig. Call site in `prepareInfrastructureEnvironment`: `const { infraDir } = await prepareInfraDirectory(devId, adminSecretsPath);`.
- **ensureAdminSecrets:** (1) If file does not exist, keep calling `generateAdminSecretsEnv` (which will write encrypted when key set). (2) If file exists: call `readAndDecryptAdminSecrets(adminSecretsPath)` to get current object. Determine backfill/overwrite from that object (e.g. empty POSTGRES_PASSWORD). Build new object with applied password; serialize to env format; if encryption key set, encrypt each value and write lines `KEY=secure://...`, else write plaintext; write file with mode 0o600.
- **stopInfra / stopInfraWithVolumes / restartInfraService:** Before running compose, call a small helper (e.g. same as prepareRunEnv or inline): readAndDecryptAdminSecrets, write to temp file in infra dir, pass temp path to compose, in finally unlink temp file.

---

## Second validation – all secret read/write touch points


| Touch point                               | Reads secrets                                          | Writes secrets                                                | Encrypt on write?                                     | Ensure key?                                                      |
| ----------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| secret set (user)                         | –                                                      | saveLocalSecret                                               | Plan §2                                               | Plan §1                                                          |
| secret set (shared file)                  | –                                                      | saveSecret                                                    | Plan §2                                               | Plan §1                                                          |
| secret list / remove / validate           | loadSecrets / file read                                | remove only                                                   | N/A                                                   | Plan §1                                                          |
| secure command                            | file read                                              | overwrite encrypted                                           | N/A (encrypts in command)                             | Plan §1                                                          |
| up-infra                                  | loadSecrets, ensureAdminSecrets, prepareInfraDirectory | generateAdminSecretsEnv, ensureAdminSecrets, setSecretInStore | Plan §3 + ensureAdminSecrets fix                      | Already ensured                                                  |
| ensureInfraSecrets / ensureSecretsForKeys | loadExistingFromTarget                                 | writeSecretToFile, writeSecretToStoreFile, setSecretInStore   | Already encrypts when key set                         | Via up-infra                                                     |
| app register                              | –                                                      | saveLocalSecret (client id/secret)                            | Plan §2                                               | Add ensureSecretsEncryptionKey at start of register command      |
| app rotate-secret                         | –                                                      | saveLocalSecret                                               | Plan §2                                               | Add ensureSecretsEncryptionKey at start of rotate-secret command |
| ensure-encryption-key (bootstrap)         | readKeyFromFile                                        | saveLocalSecret (key), setSecretsEncryptionKey                | Bootstrap key: Plan §4 optional (don’t write to file) | N/A                                                              |
| generateAdminSecretsEnv                   | loadSecrets                                            | admin-secrets.env                                             | Plan §3                                               | Via up-infra / ensureAdminSecrets                                |
| ensureAdminSecrets                        | fs read (today) → readAndDecrypt                       | admin-secrets.env                                             | New: encrypt when key set (see above)                 | Via up-infra                                                     |
| prepareInfraDirectory                     | fs read (today) → readAndDecrypt                       | –                                                             | N/A                                                   | N/A                                                              |
| startDockerServicesAndConfigure           | readAndDecryptAdminSecrets                             | temp .env.run (decrypted)                                     | N/A                                                   | N/A                                                              |
| stopInfra / down -v / restartInfraService | readAndDecryptAdminSecrets (new)                       | temp file (new)                                               | N/A                                                   | N/A                                                              |
| run-env-compose (app run)                 | readAndDecryptAdminSecrets, loadSecrets                | temp .env.run, .env.run.admin                                 | N/A                                                   | N/A                                                              |
| loadSecrets (everywhere)                  | secrets.local.yaml / remote                            | –                                                             | N/A (decrypt on read already)                         | N/A                                                              |


**Additional call sites for ensureSecretsEncryptionKey:** Besides secret list/set/remove/validate and secure, add `ensureSecretsEncryptionKey()` at the start of:

- [lib/app/register.js](lib/app/register.js) – before saving client credentials with saveLocalSecret.
- [lib/app/rotate-secret.js](lib/app/rotate-secret.js) – before saving rotated credentials with saveLocalSecret.

This way any path that writes to file-based secrets has the key (and config) available and will encrypt by default.

---

## Validation Report

**Date:** 2025-03-14  
**Plan:** .cursor/plans/108-iso_27001_secrets_encryption_fixes.plan.md  
**Document(s):** docs/configuration/secrets-and-config.md, docs/commands/utilities.md  
**Status:** ✅ COMPLETE

### Executive Summary

Both documents mentioned in the plan were validated. Structure, cross-references, and Markdown pass. No schema-applicable YAML/JSON examples in these docs (they describe runtime config and CLI usage); content is focused on using the builder for external users.

### Documents Validated

| Document | Status | Notes |
|----------|--------|--------|
| docs/configuration/secrets-and-config.md | ✅ Pass | Structure, nav, references OK; encryption/key behavior documented |
| docs/commands/utilities.md | ✅ Pass | Structure, nav, references OK; secret set encryption note present |

- **Total:** 2  
- **Passed:** 2  
- **Failed:** 0  
- **Auto-fixed:** 0  

### Structure Validation

- **secrets-and-config.md:** Single `#` title, clear `##` sections (Why secure, config.yaml, aifabrix-secrets, secrets.local.yaml, admin-secrets.env, Encryption, External integrations). Nav: `← [Documentation index](../README.md) · [Configuration](README.md)`. Hierarchy correct.
- **utilities.md:** Single `#` title, `##` for each command, `###` for sub-sections. Nav: `← [Documentation index](../README.md) · [Commands index](README.md)`. Hierarchy correct.

### Reference Validation

- **secrets-and-config.md:** Links to `../README.md`, `README.md` (config), `env-template.md`, `../commands/developer-isolation.md`, `../commands/utilities.md`, `../commands/permissions.md` — all targets exist under docs/.
- **utilities.md:** Links to `../README.md`, `README.md` (commands), `../configuration/application-yaml.md` (and anchor `#external-integration-and-external-system` in application-yaml) — verified present.

No broken internal links.

### Schema-based Validation

- **secrets-and-config.md:** No YAML/JSON code blocks for application, external-system, or datasource config. Describes runtime `config.yaml`, `secrets.local.yaml`, and `admin-secrets.env` (not defined in lib/schema). **N/A** for application-schema, external-system, external-datasource.
- **utilities.md:** Contains bash examples and references to other docs; no config file examples to validate against lib/schema in the validated sections. **N/A** for schema validation.

### Markdown Validation

- Ran: `npx markdownlint "docs/configuration/secrets-and-config.md" "docs/commands/utilities.md"`
- **Result:** 0 errors, 0 warnings (exit code 0).

### Project Rules Compliance

- **Focus:** Both docs describe how to use the aifabrix builder (CLI commands, config, secrets, encryption) for external users. No internal-only implementation details.
- **CLI:** Command names and options match (e.g. `aifabrix secret set`, `secret list`, `secure`, `up-infra --adminPwd`).
- **Plan alignment:** secrets-and-config states config/key creation on first secret use, default encryption for file-based stores and admin-secrets.env, and bootstrap key only in config; utilities.md states secret set creates config and encryption key if missing and writes encrypted values by default.

### Automatic Fixes Applied

None required.

### Manual Fixes Required

None.

### Final Checklist

- [x] All listed docs validated
- [x] MarkdownLint passes (0 errors)
- [x] Cross-references within docs/ valid
- [x] No broken internal links
- [x] Examples/structure N/A for lib/schema (runtime config only)
- [x] Content focused on using the builder (external users)
- [x] Auto-fixes applied; manual fixes documented (none)

---

## Implementation Validation Report

**Date:** 2025-03-14  
**Plan:** .cursor/plans/108-iso_27001_secrets_encryption_fixes.plan.md  
**Status:** ✅ COMPLETE

### Executive Summary

Implementation is complete. All plan requirements are implemented: ensureSecretsEncryptionKey on secret/secure and register/rotate; encrypt-by-default in saveLocalSecret/saveSecret and generateAdminSecretsEnv/ensureAdminSecrets; bootstrap key only in config; prepareInfraDirectory async with readAndDecryptAdminSecrets; stopInfra/stopInfraWithVolumes/restartService use decrypted temp file. Docs updated. Tests added per plan §5. Format and lint fixes applied (eqeqeq, max-lines-per-function). One test mock fix: secrets-set.test.js now mocks config.getSecretsEncryptionKey. All tests pass.

### Task Completion

Plan is narrative (no checkboxes). All implementation steps from “Order of implementation” are done: (1) ensureSecretsEncryptionKey on all secret/secure and register/rotate, (2) encrypt in saveLocalSecret/saveSecret, (3) encrypt in generateAdminSecretsEnv and ensureAdminSecrets, (4) prepareInfraDirectory async + decrypted temp for down/restart, (5) bootstrap key only in config, (6) tests and docs updated.

### File Existence Validation

| File | Status |
|------|--------|
| lib/cli/setup-secrets.js | ✅ ensureSecretsEncryptionKey in list/set/remove/validate/secure |
| lib/utils/local-secrets.js | ✅ resolveValueForWrite, encrypt in saveLocalSecret/saveSecret |
| lib/core/secrets.js | ✅ formatAdminSecretsContent, generateAdminSecretsEnv encrypt |
| lib/core/ensure-encryption-key.js | ✅ No saveLocalSecret for new key; setSecretsEncryptionKey only |
| lib/app/register.js | ✅ ensureSecretsEncryptionKey at start |
| lib/app/rotate-secret.js | ✅ ensureSecretsEncryptionKey at start |
| lib/infrastructure/helpers.js | ✅ ensureAdminSecrets read/write via readAndDecrypt + formatAdminSecretsContent; prepareInfraDirectory async |
| lib/infrastructure/index.js | ✅ stopInfra, stopInfraWithVolumes, restartService use decrypted .env.run temp |
| docs/configuration/secrets-and-config.md | ✅ Updated |
| docs/commands/utilities.md | ✅ Updated |

### Test Coverage

| Plan requirement | Test location | Status |
|------------------|---------------|--------|
| ensureSecretsEncryptionKey invoked from secret list/set/remove/validate and secure | tests/lib/cli/setup-secrets.test.js | ✅ 5 tests |
| saveLocalSecret/saveSecret with encryption key → secure:// written | tests/lib/utils/local-secrets.test.js | ✅ 1 test |
| generateAdminSecretsEnv with encryption key → secure:// in output | tests/lib/core/secrets.test.js | ✅ 1 test |
| Bootstrap key not in secrets file | No test expected key in file after bootstrap | N/A |

Additional: config mock in tests/lib/commands/secrets-set.test.js extended with getSecretsEncryptionKey so handleSecretsSet tests pass (local-secrets now calls it).

### Code Quality Validation

- **Format (lint:fix):** ✅ PASSED (after fixing eqeqeq in secrets.js and extracting setupSecureCommand in setup-secrets.js for max-lines-per-function).
- **Lint:** ✅ PASSED (0 errors). 4 warnings remain: max-statements in lib/infrastructure/helpers.js ensureAdminSecrets, lib/infrastructure/index.js stopInfra, stopInfraWithVolumes, restartService.
- **Tests:** ✅ PASSED (245 suites, 5353 tests; 28 skipped).

### Cursor Rules Compliance

- **Error handling:** try/catch and error handling in place.
- **Async patterns:** async/await and config getSecretsEncryptionKey used correctly.
- **Security:** No hardcoded secrets; encryption key from config; bootstrap key only in config.
- **Module patterns:** CommonJS; proper requires and exports.
- **Input validation:** Existing validation retained in touched code.

### Implementation Completeness

- All plan “files to touch” implemented.
- Documentation updated per plan.
- Tests added/extended per plan §5; no bootstrap-key-in-file tests required.

### Issues and Recommendations

- **Optional:** Reduce statement count in ensureAdminSecrets, stopInfra, stopInfraWithVolumes, restartService (extract helpers) to clear the 4 max-statements warnings.
- **Tests:** Plan §5 test requirements are satisfied. Optional extras: ensureAdminSecrets encrypt path unit test; infra unit test that stopInfra/restartService use decrypted temp file (currently covered indirectly via infra tests).

### Final Validation Checklist

- [x] All implementation steps completed
- [x] All touched files exist and contain expected changes
- [x] Tests exist for ensureSecretsEncryptionKey invocation, encrypted saveLocalSecret/saveSecret, generateAdminSecretsEnv with encryption
- [x] Code quality: format and lint pass (0 errors); tests pass
- [x] Cursor rules compliance verified
- [x] Documentation updated