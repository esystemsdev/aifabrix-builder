---
name: Datasource systemKey Validation Repair
overview: Fix validation to detect datasource systemKey mismatch (datasource.systemKey !== system.key) and extend repair to correct mismatched systemKey in datasource files. Then add tests to ensure both flows work correctly for integrators.
todos:
  - id: validation-rule
    content: Add validateDatasourceSystemKeyAlignment to external-manifest-validator.js
    status: completed
  - id: repair-logic
    content: Add alignDatasourceSystemKeys to repair.js and integrate into flow
    status: completed
  - id: tests-validator
    content: Add external-manifest-validator tests for systemKey mismatch
    status: completed
  - id: tests-validate
    content: Add validate.test.js integration test for systemKey failure
    status: completed
  - id: tests-repair
    content: Add repair.test.js tests for datasource systemKey fix and edge cases
    status: completed
  - id: optional-plan77
    content: Update Plan 77 to move datasource systemKey from Non-Repairable to Repairable
    status: completed
isProject: false
---

# Datasource systemKey Validation and Repair Plan

## Problem Summary


| Command             | Current Behavior                                                                                            | Desired Behavior                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `aifabrix validate` | Passes even when a datasource has wrong `systemKey` (e.g. `hubspot-deals-datasource` vs `test-e2e-hubspot`) | Fail validation and report the mismatch                 |
| `aifabrix repair`   | Reports "No changes needed" even when datasource files have wrong `systemKey`                               | Fix `systemKey` in datasource files to match system key |
| `aifabrix upload`   | Correctly rejects with "systemKey does not match application system key" (dataplane API)                    | No change; this behavior is correct                     |


The dataplane upload API enforces `datasource.systemKey === ExternalSystem.key`, but local validation and repair do not. Integrators get a confusing flow: validate passes, repair does nothing, then upload fails.

---

## Architecture

```mermaid
flowchart LR
    subgraph validate [validate]
        V1[validateComponentsStep]
        V2[validateManifestStep]
        V3[validateControllerManifest]
        V1 --> V2
        V2 --> V3
    end
    
    subgraph repair [repair]
        R1[discoverIntegrationFiles]
        R2[ensureExternalIntegrationBlock]
        R3[alignAppKeyWithSystem]
        R4[alignDatasourceSystemKeys]
        R5[createRbacFromSystemIfNeeded]
        R1 --> R2 --> R3 --> R4 --> R5
    end
```



---

## 1. Add Validation: Datasource systemKey vs System Key

**File:** [lib/validation/external-manifest-validator.js](lib/validation/external-manifest-validator.js)

**Change:** Add `validateDatasourceSystemKeyAlignment(manifest, errors)` and call it from `validateControllerManifest`.

**Logic:**

- `systemKey = manifest.system?.key`
- If `manifest.dataSources` exists and `systemKey` is defined, iterate each datasource:
  - If `datasource.systemKey !== systemKey`, add error: `Data source '${datasource.key}' systemKey does not match application system key (expected '${systemKey}', got '${datasource.systemKey}')`
- Match the wording used by the upload/dataplane error so integrators recognize it.

**Integration:** The manifest is built by `generateControllerManifest` from files; it already contains both `system.key` and each `dataSources[].systemKey`. No need to touch [lib/validation/validate.js](lib/validation/validate.js) or components step—the manifest validator runs after the manifest is built and will catch mismatches.

---

## 2. Add Repair: Fix Datasource systemKey Mismatch

**File:** [lib/commands/repair.js](lib/commands/repair.js)

**Change:** Add `alignDatasourceSystemKeys(appPath, datasourceFiles, systemKey, dryRun, changes)` and call it after `alignAppKeyWithSystem`, before rbac/manifest logic.

**Logic:**

- For each `datasourceFile` in `datasourceFiles`:
  - Build path: `path.join(appPath, datasourceFile)`
  - Load with `loadConfigFile(path)`
  - If `parsed.systemKey !== systemKey`, set `parsed.systemKey = systemKey`
  - Unless `dryRun`: call `writeConfigFile(path, parsed)` (format inferred from extension)
  - Append to `changes`: `"${datasourceFile}: systemKey ${old} → ${systemKey}"`
- Return `true` if any file was updated.

**Order in repair flow:**

1. Ensure externalIntegration block
2. Align app.key with system
3. **Align datasource systemKeys** (new)
4. Create rbac.yaml if needed
5. Regenerate manifest (if any changes and not dryRun)

**Note:** Use existing [lib/utils/config-format.js](lib/utils/config-format.js) `loadConfigFile` and `writeConfigFile` so YAML/JSON format is preserved per file extension.

---

## 3. Tests

High test coverage is critical for CLI quality. Add the following tests.

### 3a. External Manifest Validator

**File:** [tests/local/lib/validation/external-manifest-validator.test.js](tests/local/lib/validation/external-manifest-validator.test.js)


| Test                                | Purpose                                                                                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datasource systemKey mismatch fails | Manifest with `system.key: 'test-e2e-hubspot'` and datasource `systemKey: 'hubspot-deals-datasource'` must fail with error mentioning datasource key and expected/got values |
| Multiple datasources, one wrong     | Error identifies the mismatched datasource by key                                                                                                                            |
| All datasources aligned             | Passes when all datasource `systemKey` values equal `system.key`                                                                                                             |


### 3b. Validation (validate.test.js)

**File:** [tests/lib/validation/validate.test.js](tests/lib/validation/validate.test.js)


| Test                                                       | Purpose                                                                                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| validateExternalSystemComplete fails on systemKey mismatch | Mock manifest with wrong datasource systemKey; `validateControllerManifest` returns that error; `result.valid === false` and error text mentions systemKey |


### 3c. Repair (repair.test.js)

**File:** [tests/lib/commands/repair.test.js](tests/lib/commands/repair.test.js)


| Test                                                        | Purpose                                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Repair fixes datasource systemKey when mismatched           | Datasource has `systemKey: 'wrong-key'`, system has `key: 'correct-key'`; repair writes updated file and `changes` includes the correction |
| Dry-run reports datasource systemKey fix but does not write | Same setup with `dryRun: true`; no `writeConfigFile` for datasource file; `changes` still includes the fix                                 |
| No change when systemKeys already aligned                   | All datasources correct; repair reports "No changes needed"                                                                                |
| Multiple datasources with mismatches                        | Several datasources wrong; all fixed in one repair run                                                                                     |


### 3d. Edge Cases


| Test                                  | Purpose                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| system.key from filename when missing | System file has no `key`; repair derives key from filename (e.g. `test-e2e-hubspot-system.json` → `test-e2e-hubspot`) |
| Empty dataSources                     | No datasource files; alignment step skipped without error                                                             |
| Format preservation                   | Repair updates `.yaml` datasource; output remains YAML; same for `.json`                                              |


### 3e. Test Count Summary

- **Minimum:** ~6 new tests (validator systemKey, validate integration, repair fix, repair dry-run, repair no change, multi-datasource).
- **Recommended for high quality:** ~10–12 tests, including edge cases above.

---

## 4. Validation Checklist

After implementation:

1. Create a fixture: integration app with one datasource file whose `systemKey` differs from `system.key`.
2. Run `aifabrix validate <app>` → must fail with a clear error.
3. Run `aifabrix repair <app>` → must fix the datasource file and report the change.
4. Run `aifabrix validate <app>` again → must pass.
5. Run `npm run build` (lint + test) and ensure all tests pass.

---

## Files to Modify


| File                                                                                                                             | Change                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [lib/validation/external-manifest-validator.js](lib/validation/external-manifest-validator.js)                                   | Add `validateDatasourceSystemKeyAlignment`, call from `validateControllerManifest`  |
| [lib/commands/repair.js](lib/commands/repair.js)                                                                                 | Add `alignDatasourceSystemKeys`, integrate into repair flow                         |
| [tests/local/lib/validation/external-manifest-validator.test.js](tests/local/lib/validation/external-manifest-validator.test.js) | Add tests for systemKey mismatch (single, multiple, aligned)                        |
| [tests/lib/validation/validate.test.js](tests/lib/validation/validate.test.js)                                                   | Add integration test for validateExternalSystemComplete fails on systemKey mismatch |
| [tests/lib/commands/repair.test.js](tests/lib/commands/repair.test.js)                                                           | Add repair tests: systemKey fix, dry-run, no change, multi-datasource, edge cases   |


---

## Optional: Update Plan 77

In [.cursor/plans/77-external_integration_repair_command.plan.md](.cursor/plans/77-external_integration_repair_command.plan.md), move "Datasource systemKey mismatch" from "Non-Repairable" to "Repairable" and document the new validation rule.