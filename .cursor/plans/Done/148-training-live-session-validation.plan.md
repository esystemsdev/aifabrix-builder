---
name: 148-training-live-session-validation
overview: |
  Builder CLI findings from aifabrix-training live session runs (templates/session-N.js)
  against dev debug stack (controller :3610, dataplane :3611). Dataplane issues → plan 416.0.
todos:
  - id: bk-sync-upload-force
    content: Pass --force from datasource test-e2e/test-trust --sync and unified validation sync into uploadExternalSystem
    status: completed
  - id: bk-cli-force-flag-e2e
    content: Add --force option to datasource test-e2e, test-integration, test-trust (document in help)
    status: completed
  - id: bk-pipeline-auth-fallback
    content: On pipeline 401 with device Bearer, auto-retry with client-token (x-client-token) when app credentials exist
    status: completed
  - id: bk-deployment-auth-docs
    content: Document AIFABRIX_DEPLOYMENT_AUTH=client-credentials for CI/lab pipeline publish
    status: completed
  - id: bk-sharepoint-secret-key-hint
    content: Generic missing-kv hint when same path segment exists under another populated namespace in secrets (no lab-specific hardcoding)
    status: completed
isProject: false
---

# 148 — Builder CLI bugs & gaps (training live validation)

**Consumer:** Training curriculum live runs (`aifabrix-training`)  
**Cross-ref:** Dataplane → `aifabrix-dataplane/.cursor/plans/416.0-training-live-session-validation.plan.md`  
**Session rollup:** `aifabrix-training/temp/plan-validation/session-scripts-status.md`  
**Evidence:** `aifabrix-training/temp/plan-validation/evidence/live-sessions-LATEST.md`  
**Stack:** controller `http://localhost:3610`, dataplane `http://localhost:3611/data`, CLI `2.45.6`

---

## Summary

| Type | Count | Notes |
| --- | --- | --- |
| **Confirmed gaps** | 2 | Sync path ignores `--force`; no `--force` on test-e2e CLI |
| **UX / auth** | 2 | Device token priority; intermittent pipeline failures |
| **Lab / secrets** | 1 | SharePoint kv path mismatch vs working `sharepoint/*` keys |

`--force` is forwarded on all `--sync` upload paths; pipeline publish retries with client token after device Bearer 401 when app credentials exist.

---

## BK-1 — `test-e2e --sync` internal upload omits `force` (P1)

| Field | Value |
| --- | --- |
| **ID** | BK-1 |
| **Severity** | P1 |
| **Symptom** | After local dimension/FK edits, `datasource test-e2e <ds> --sync` fails with dataplane Plan 331 overlap even when `aifabrix upload <app> --force` succeeds |
| **Cause** | `syncLocalIfRequested` calls `uploadExternalSystem(systemKey, { minimal: true })` only — no `force: true` |
| **Files** | `lib/commands/test-e2e-external.js` (`syncLocalIfRequested`); `lib/datasource/unified-validation-run.js` (`maybeSyncDatasourceToDataplane`) |
| **Fix** | Add CLI `--force`; pass `force: options.force === true` into `uploadExternalSystem` on all sync-before-test paths |
| **Workaround** | `aifabrix upload <app> --force` before sync steps; `run-sessions-live.js` preflight |
| **Training sessions** | 2–5, 11 (when `--sync` used) |

---

## BK-2 — Pipeline publish prefers device token over application token (P1/P2)

| Field | Value |
| --- | --- |
| **ID** | BK-2 |
| **Severity** | P1/P2 |
| **Symptom** | `aifabrix auth status` shows Connected; pipeline `upload` / sync fails `Invalid token` (dataplane DP-2) |
| **Cause** | `getDeploymentAuth` in `auto` mode tries device Bearer first (`lib/utils/token-manager.js`, `deployment-auth-mode.js`) |
| **Fix** | Prefer `client-token` for external-system pipeline publish, or fallback to client token when Bearer upload returns 401 |
| **Workaround** | `AIFABRIX_DEPLOYMENT_AUTH=client-credentials` + app client id/secret; refresh `aifabrix login` |
| **Training sessions** | 1 (`hubspot-demo`), 5, 8, 9, 11, 14 |

---

## BK-3 — No `--force` flag on `datasource test-e2e` / `test-trust` (P1)

| Field | Value |
| --- | --- |
| **ID** | BK-3 |
| **Severity** | P1 (paired with BK-1) |
| **Symptom** | Users cannot run `aifabrix datasource test-e2e … --sync --force` |
| **Fix** | Wire `--force` in `lib/commands/datasource-unified-test-cli.options.js` and unified test runners |
| **Workaround** | Standalone `aifabrix upload <app> --force` |

---

## BK-4 — `upload --force` warning only at publish time (P3)

| Field | Value |
| --- | --- |
| **ID** | BK-4 |
| **Severity** | P3 (documentation) |
| **Symptom** | `--force` warning easy to miss before overlap errors |
| **File** | `lib/commands/upload.js` → `logForcePublishWarning`; dataplane `pipeline_user_messages.py` (400 remediation) |
| **Resolution** | No builder substring hint module — dataplane 400 already includes `--force` remediation; CLI shows `logForcePublishWarning` when `--force` is used |

---

## BK-5 — Secret namespace mismatch (P2 lab)

| Field | Value |
| --- | --- |
| **ID** | BK-5 |
| **Severity** | P2 (lab setup, not runtime bug) |
| **Symptom** | Upload/resolve reports missing `kv://<appNamespace>/…` while secrets file has the same path segment under a different namespace (e.g. lab copied keys under a shorter prefix) |
| **Fix** | Generic `Alternate-kv-hint` in `secrets-missing-error.js` (same segment, different namespace, value present in secrets map). No hardcoded lab app names in product code. |
| **Training sessions** | 12 (SharePoint lab is one example) |

---

## BK-6 — Trust / integration warnings (P3)

| Field | Value |
| --- | --- |
| **ID** | BK-6 |
| **Severity** | P3 |
| **Symptom** | `test-trust` / `test-integration` WARN on contacts/deals governance; hubspot-demo Partial trust |
| **Cause** | Manifest/governance pack placeholders, not full E2E on demo app |
| **Training sessions** | 1, 2, 9, 14 |

---

## Not builder (tracked in dataplane plan)

| Item | Plan |
| --- | --- |
| Dimension overlap 400 without force | Dataplane **DP-1** |
| ABAC export 0 rows | Dataplane **DP-3** |
| `version_already_deployed` warning | Dataplane **DP-4** |

---

## Verification (builder)

```bash
cd /workspace/aifabrix-training
aifabrix upload hubspot-e2e --probe --force          # OK
aifabrix upload hubspot-e2e --probe                  # fails → DP-1 without force
aifabrix datasource test-e2e hubspot-e2e-companies --app hubspot-e2e --sync --force
```

## Validation Report

**Date**: 2026-05-27  
**Status**: ✅ COMPLETE  
**Scope**: aifabrix-builder only (dataplane items → plan 416.0)

### Executive Summary

All five frontmatter todos are implemented with unit test coverage. Builder quality gate `npm run build` (eslint + jest, 652 tests) passed. Product-neutral rules added (`cli-product-neutral.mdc`); no lab-specific hardcoding in `lib/`. BK-4 resolved by relying on dataplane 400 remediation + `logForcePublishWarning` (no substring hint module). BK-6 remains out of scope (manifest/governance, not CLI).

### Blocking Findings

None.

### Requirement → Evidence Matrix

| Requirement | Code evidence | Test evidence | Execution evidence | Status |
| --- | --- | --- | --- | --- |
| BK-1: sync paths pass `--force` to `uploadExternalSystem` | `lib/utils/upload-sync-options.js`; wired in `test-e2e-external.js`, `test-trust-external.js`, `test-governance-external.js`, `unified-validation-run.js`, `agent-trust-run.js`, `external-system/test.js` | `upload-sync-options.test.js`; `unified-validation-run.test.js` (force forward) | `npm run build` pass | ✅ VERIFIED |
| BK-2: pipeline 401 device Bearer → client-token retry | `lib/utils/pipeline-upload-auth-retry.js`; `upload.js:runUploadValidatePublish` | `pipeline-upload-auth-retry.test.js` | `npm run build` pass | ✅ VERIFIED |
| BK-3: CLI `--force` on datasource test commands | `datasource-unified-test-cli.options.js`; `datasource-unified-test-cli.js` builders; system CLI in `setup-app.test-commands.js`, `setup-external-system.js` | Indirect via unified-validation + upload tests | `npm run build` pass | ✅ VERIFIED |
| BK-4: overlap / force UX without brittle hints | `upload.js:logForcePublishWarning`; removed `upload-pipeline-error-hints.js` | `upload.test.js` (force warning text) | Dataplane owns 400 remediation (`pipeline_user_messages.py`) | ✅ VERIFIED |
| BK-5: generic missing-kv namespace hint | `lib/utils/secrets-missing-error.js:buildKvNamespaceAlternateHints` | `secrets-missing-error.test.js` | `rg` — no `sharepoint-e2e` in `lib/**/*.js` | ✅ VERIFIED |
| BK-deployment-auth-docs | `docs/commands/deployment.md` (auto-retry + `client-credentials`) | N/A (docs) | Manual read | ✅ VERIFIED |
| Product-neutral CLI rules | `.cursor/rules/cli-product-neutral.mdc`; `cli-layout.mdc`, `project-rules.mdc` refs | N/A | `rg -i 'plan [0-9]|BK-' lib/` → no matches in `lib/` | ✅ VERIFIED |

### Task Completion

| Todo ID | Status | Evidence |
| --- | --- | --- |
| bk-sync-upload-force | completed | `buildMinimalUploadSyncOptions` + all sync call sites |
| bk-cli-force-flag-e2e | completed | `--force` on common datasource options + system test commands |
| bk-pipeline-auth-fallback | completed | `uploadApplicationViaPipelineWithAuthRetry` |
| bk-deployment-auth-docs | completed | `deployment.md` updated |
| bk-sharepoint-secret-key-hint | completed | Generic `Alternate-kv-hint` (not lab-specific) |

**Completion**: 5/5 todos (100%)

### Task State Synchronization

- ✅ Frontmatter `todos` match implementation (all `completed`)
- ✅ No markdown body checkboxes in plan (N/A)
- ✅ No contradictions

### File Existence Validation

| File | Status |
| --- | --- |
| `lib/utils/upload-sync-options.js` | ✅ NEW |
| `lib/utils/pipeline-upload-auth-retry.js` | ✅ NEW |
| `lib/utils/secrets-missing-error.js` | ✅ MODIFIED (generic hints) |
| `.cursor/rules/cli-product-neutral.mdc` | ✅ NEW |
| `lib/utils/upload-pipeline-error-hints.js` | ✅ REMOVED (intentional, BK-4) |
| `lib/commands/upload.js` | ✅ MODIFIED |
| `lib/commands/datasource-unified-test-cli.options.js` | ✅ MODIFIED |
| `lib/commands/datasource-unified-test-cli.js` | ✅ MODIFIED |
| `lib/datasource/unified-validation-run.js` | ✅ MODIFIED |
| `lib/commands/test-e2e-external.js` | ✅ MODIFIED |
| `lib/commands/test-trust-external.js` | ✅ MODIFIED |
| `docs/commands/deployment.md` | ✅ MODIFIED |

### Test Coverage

| Area | Status |
| --- | --- |
| `tests/lib/utils/upload-sync-options.test.js` | ✅ |
| `tests/lib/utils/pipeline-upload-auth-retry.test.js` | ✅ |
| `tests/lib/utils/secrets-missing-error.test.js` | ✅ |
| `tests/lib/datasource/unified-validation-run.test.js` | ✅ (force path) |
| `tests/lib/commands/upload.test.js` | ✅ |
| `tests/lib/commands/test-e2e-external.test.js` | ✅ |
| `tests/lib/commands/test-trust-external.test.js` | ✅ |

### Code Quality Validation (Builder)

| Step | Result |
| --- | --- |
| ESLint (`npm run lint` via build) | ✅ PASSED (0 errors) |
| Jest (`npm test` via build) | ✅ PASSED (652 tests, 70 suites) |
| Backend/frontend (dataplane plan command) | N/A — builder-only plan |

### Cursor Rules Compliance

| Rule | Status |
| --- | --- |
| `cli-product-neutral.mdc` | ✅ No plan IDs / lab keys in `lib/` |
| `cli-layout.mdc` | ✅ Help text uses product terms |
| `docs-rules.mdc` | ✅ User doc example for `AIFABRIX_DEPLOYMENT_AUTH` |
| File size / function limits | ✅ New modules small |

### Out of Scope (not blocking)

- **BK-6**: trust/integration warnings (manifest/governance; not in todos)
- **DP-1/3/4**: dataplane plan 416.0
- **Live training re-run**: manual verification on dev stack (commands in Verification section)

### Issues and Recommendations

1. Re-run training live session scripts (`aifabrix-training` evidence folder) on dev stack to confirm end-to-end after CLI release.
2. Plan cross-ref `416.0` path: dataplane uses `.cursor/plans/-1.done/416.0-...` (archived).

### Final Validation Checklist

- [x] All todos completed with evidence
- [x] All implementation files exist
- [x] Unit tests exist and pass
- [x] `npm run build` passes
- [x] Product-neutral rules documented
- [x] No stale hardcoded hint modules
