---
name: Repair auth naming consistency
overview: Fix the mismatch between env.template kv paths (e.g. kv://demo/apiKey) and external system authentication.security paths (e.g. kv://demo/apikey) so repair generates the same name everywhere, and add validation to enforce consistency. Also rename the HubSpot integration folder to hubspot-test so it deploys as hubspot-test on the dataplane without conflicting with another app "HubSpot".
todos: []
isProject: false
---

# Repair auth naming consistency and validation

---

## HubSpot integration rename (scope: folder only)

**Goal:** Rename the integration folder from `integration/hubspot` to `integration/hubspot-test` and make the external system use key `hubspot-test` on the dataplane, so it can be deployed without conflicting with another app "HubSpot". **No changes outside this folder** (no lib/, tests/, docs/, or other repo updates).

**Approach:**

1. **Rename folder**  
   `integration/hubspot` → `integration/hubspot-test`.

2. **Changes only inside that folder** (after rename, i.e. inside `integration/hubspot-test/`):
   - **application.json** (or application.yaml): set `app.key` to `hubspot-test`; update `externalIntegration.systems` and `externalIntegration.dataSources` if filenames change (see below).
   - **System file:** key and any ids from `hubspot` → `hubspot-test`. If the file is renamed (e.g. `hubspot-system.json` → `hubspot-test-system.json`), update the reference in application config.
   - **Datasource files:** `systemKey` and entity keys from `hubspot` → `hubspot-test`; optionally rename `hubspot-datasource-*.json` → `hubspot-test-datasource-*.json` and update references in application config.
   - **env.template:** any `kv://hubspot/` paths → `kv://hubspot-test/` (and ensure auth naming is consistent per the rest of this plan).
   - **README, QUICK_START, and other docs inside the folder:** replace app/system name "hubspot" with "hubspot-test" where it denotes this integration (e.g. validate/deploy commands, paths, secret paths).
   - **Wizard and test-artifact YAMLs** inside the folder: any `appName` or system key that points at this integration should be `hubspot-test` (or keep as-is if they are for separate wizard-e2e test apps; only the “real” integration identity is hubspot-test).
   - **Scripts and helpers** inside the folder (e.g. test runners, create scripts): paths or app names that refer to this integration → `hubspot-test`.

3. **Out of scope**  
   Do not change code or config under `lib/`, `tests/`, `docs/`, or anywhere outside `integration/hubspot` / `integration/hubspot-test`. References to "hubspot" elsewhere in the repo (e.g. tests, docs, CLI examples) remain as-is unless they explicitly refer to this integration’s folder or dataplane key and are under this folder.

**Result:** The external system is deployed on the dataplane as `hubspot-test`, and the integration lives under `integration/hubspot-test/`, with no conflict with another app "HubSpot". All edits are contained within that folder (plus the one-time folder rename).

---

## Problem

For `aifabrix repair demo --auth apikey`:

- **env.template** is built from `authentication.security` via [repair-env-template.js](lib/commands/repair-env-template.js): env key `KV_DEMO_APIKEY` and **path** come from `kvEnvKeyToPath("KV_DEMO_APIKEY", "demo")` in [credential-secrets-env.js](lib/utils/credential-secrets-env.js), which uses `varSegmentsToCamelCase(["APIKEY"])` → `**apiKey`** → value `**kv://demo/apiKey`**.
- **External system file** is set by [buildAuthenticationFromMethod](lib/external-system/generator.js) in [lib/external-system/generator.js](lib/external-system/generator.js) with `security: { apiKey: kv('apikey') }` → `**kv://demo/apikey`** (lowercase).

So the same logical secret gets two different paths (`kv://demo/apiKey` vs `kv://demo/apikey`). The schema and docs use camelCase (e.g. [external-system.schema.json](lib/schema/external-system.schema.json) examples use `kv://example/apiKey`, `kv://example/clientId`). Validation currently allows both via case-insensitive match in [env-template-auth.js](lib/validation/env-template-auth.js) (`setHasPathIgnoreCase`), but generated output should use one canonical name everywhere.

## Approach

1. **Single canonical path**
  Use the same path segment derivation for both the system file and env.template: path segment = `varSegmentsToCamelCase([securityKeyToVar(securityKey)])` (i.e. the same logic as `kvEnvKeyToPath` for the variable part).
2. **Generator fix**
  In `buildAuthenticationFromMethod`, set each `security` value to the canonical path (systemKey + path segment from the same derivation). So system file and env.template end up with identical `kv://` paths.
3. **Validation**
  Add a consistency check: for every `authentication.security` entry, the path in the system file must equal the canonical path derived from (systemKey, securityKey). If not, validation fails with a clear message (e.g. “Run repair to normalize auth paths” or “auth path does not match canonical name”).

---

## 1. Canonical path segment for security keys

**File:** [lib/utils/credential-secrets-env.js](lib/utils/credential-secrets-env.js)

- Add a function that returns the path segment used in `kv://<systemKey>/<segment>` for a given security key (e.g. `apiKey` → `apiKey`, `paramValue` → `paramvalue` to match `varSegmentsToCamelCase`):
  - Reuse existing logic: segment = `varSegmentsToCamelCase([securityKeyToVar(securityKey)])`.
  - Export it (e.g. `getKvPathSegmentForSecurityKey(securityKey)` or `securityKeyToKvPathSegment(securityKey)`).
- This keeps a single place that defines “name” for both env key derivation and path segment.

**File:** [lib/external-system/generator.js](lib/external-system/generator.js)

- In `buildAuthenticationFromMethod`, stop using hardcoded lowercase path segments (e.g. `kv('apikey')`, `kv('clientid')`).
- For each auth method, set each `security` entry to `kv(pathSegment)` where `pathSegment = getKvPathSegmentForSecurityKey(securityKey)` (require from `credential-secrets-env`).
- Result: e.g. `apikey` → `security: { apiKey: kv('apiKey') }` → `kv://demo/apiKey`; oauth2 → `clientId: kv('clientId')`, `clientSecret: kv('clientSecret')`, etc. All paths will match what `repairEnvTemplate` / `kvEnvKeyToPath` produce.

---

## 2. Validation: same name across files

**Option A – Strict path match in env-template-auth**

- In [lib/validation/env-template-auth.js](lib/validation/env-template-auth.js), when checking that env.template covers required paths, optionally enforce **exact** path match (no case-insensitive fallback for the “required path” check), so that if the system file has `kv://demo/apiKey` and env.template has `kv://demo/apiKey`, it passes; if the system file still had `kv://demo/apikey` (legacy), validation could fail with “path must match canonical form; run repair.”
- Decision: keep case-insensitive match for backward compatibility with existing repos, but add a **separate** consistency check (below).

**Option B – Consistency check (recommended)**

- Add a validation step (used by `aifabrix validate` and/or at end of repair) that:
  - For each system file: for each `authentication.security` key and value (kv path), compute the **canonical** path = `kv://${systemKey}/${getKvPathSegmentForSecurityKey(securityKey)}`.
  - If `value !== canonicalPath`, add an error (or warning): e.g. “authentication.security. has path ; canonical path is . Run `aifabrix repair <app>` to normalize.”
- This does not require changing existing case-insensitive coverage check; it only adds a “naming consistency” rule so that repair output is always aligned.

Implement the consistency check in [lib/validation/env-template-auth.js](lib/validation/env-template-auth.js) (or a small helper used by the validator):

- New function, e.g. `validateAuthSecurityPathConsistency(appPath, errors, warnings)`.
- For each system config: for each `authentication.security` entry, compare value to canonical path; if different, push to `errors` (or `warnings`) with message above.
- Call this from the main validator where external integration env.template/auth is validated ([lib/validation/validator.js](lib/validation/validator.js)).

---

## 3. Repair normalization (existing behavior)

- [normalizeSecuritySection](lib/commands/repair-env-template.js) already rewrites legacy security values to the path produced by `kvEnvKeyToPath(envName, systemKey)`, i.e. the same canonical path. No change needed there.
- After the generator fix, new `--auth` runs will write the canonical path; existing runs that already wrote lowercase will be normalized by `normalizeSecuritySection` when repair is run (it only rewrites “legacy” values; non-legacy could be left as-is). To align **all** existing files, we could in a follow-up extend `normalizeSecuritySection` to also replace any security value that differs from the canonical path (not only legacy), so repair always forces consistency. Optional for this plan.

---

## 4. Tests and docs

- **Tests**
  - [tests/lib/commands/repair.test.js](tests/lib/commands/repair.test.js): Assert that after `repairExternalIntegration(appName, { auth: 'apikey' })`, the system file has `authentication.security.apiKey === 'kv://<systemKey>/apiKey'` (camelCase) and env.template has the same path in the value for the corresponding KV_ var. Same for oauth2 (clientId, clientSecret).
  - [tests/lib/external-system/generator.test.js](tests/lib/external-system/generator.test.js) (or equivalent): `buildAuthenticationFromMethod('demo', 'apikey').security.apiKey` is `kv://demo/apiKey`; for oauth2, paths use camelCase clientId/clientSecret.
  - [tests/lib/validation/env-template-auth.test.js](tests/lib/validation/env-template-auth.test.js) or validator test: consistency check fails when system file has `kv://demo/apikey` and passes when it has `kv://demo/apiKey` (and env.template matches).
- **Docs**
  - If there is a place that documents “path-style kv” or repair behavior, mention that auth security paths use a single canonical form (camelCase variable segment) and that repair normalizes to it.

---

## Summary


| Item                             | Action                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **credential-secrets-env.js**    | Add and export `getKvPathSegmentForSecurityKey(securityKey)` (or similar) using existing `securityKeyToVar` + `varSegmentsToCamelCase`.                       |
| **external-system/generator.js** | In `buildAuthenticationFromMethod`, use the new helper so every `security` value uses the canonical path segment (e.g. `apiKey`, `clientId`, `clientSecret`). |
| **env-template-auth.js**         | Add `validateAuthSecurityPathConsistency(appPath, errors, warnings)` and call it from the validator.                                                          |
| **validator.js**                 | Call the new consistency validation for external integrations.                                                                                                |
| **Tests**                        | Repair test (apikey/oauth2 paths); generator test (canonical paths); validation test (consistency error when path differs from canonical).                    |


This ensures all repair-generated output uses the same name for the same secret in both env.template and the external system file, and validation enforces that consistency.