---
name: Credential Status Display
overview: "Add credential status display when the Builder shows credentials, aligning with the dataplane's credential status lifecycle (plan 306). Two places show credentials: `aifabrix credential list` and the wizard's \"Use existing\" credential selection. Both will display status (pending, verified, failed, expired) when the API returns it, with backward compatibility when status is absent."
todos: []
isProject: false
---

# Credential Status Display in Builder

## Context

The dataplane implements credential status lifecycle (plan 306): `pending`, `verified`, `failed`, `expired`. Credential API responses include a `status` field. The Builder currently shows credentials without status in two places:

1. `**aifabrix credential list**` - [lib/commands/credential-list.js](lib/commands/credential-list.js) `displayCredentialList` outputs `key - name` only
2. **Wizard Step 3** - [lib/generator/wizard-prompts.js](lib/generator/wizard-prompts.js) `promptForExistingCredential` shows choices as `name` only (no status)

## Status Mapping: Icons with Colors

Use icons with chalk colors for visual status indication (aligned with dataplane lifecycle):


| Status   | Icon | Color  | Meaning             |
| -------- | ---- | ------ | ------------------- |
| verified | ✓    | green  | Valid / test passed |
| pending  | ○    | gray   | Not tested          |
| failed   | ✗    | red    | Connection failed   |
| expired  | ⊘    | yellow | Token expired       |


**Note:** Wizard uses inquirer; chalk-colored strings work in list choices.

## Implementation

### 1. Shared Utility: Credential Status Formatter

Create [lib/utils/credential-display.js](lib/utils/credential-display.js):

- `formatCredentialStatus(status, options)` - Returns `{ icon, color, label }` for a status; returns `null` when status is missing (backward compatibility). Uses chalk for colored output when `options.useChalk === true`.
- `formatCredentialWithStatus(credential, options)` - Returns `{ key, name, statusFormatted }` where `statusFormatted` is a chalk-colored icon string (e.g. `chalk.green(' ✓')`) when status exists, else empty string.
- Export `STATUS_ICONS` and `STATUS_COLORS` for reuse; use chalk to build `statusFormatted`.

### 2. Credential List Command

Update [lib/commands/credential-list.js](lib/commands/credential-list.js) `displayCredentialList`:

- For each credential: show `key - name` followed by colored icon when status is present
- Example: `hubspot-cred - HubSpot API Key` + `chalk.green(' ✓')` or `chalk.red(' ✗')`
- When status is missing: show `key - name` only (no icon)

### 3. Wizard Credential Selection

Update [lib/generator/wizard-prompts.js](lib/generator/wizard-prompts.js) `promptForExistingCredential`:

- When building choices, append colored icon to the displayed name when status is present
- Format: `"Name " + chalk.green('✓')` or `"Name " + chalk.red('✗')` etc.
- When status is missing: show `Name` only
- JSDoc: extend `credentialsList` param type to include optional `status`

### 4. Tests

- [tests/lib/utils/credential-display.test.js](tests/lib/utils/credential-display.test.js) - Unit tests for `formatCredentialStatus` (icon + color) and `formatCredentialWithStatus`
- [tests/lib/commands/credential-list.test.js](tests/lib/commands/credential-list.test.js) - Add/update tests for status in displayed output
- [tests/lib/generator/wizard-prompts.test.js](tests/lib/generator/wizard-prompts.test.js) - Add tests for status in `promptForExistingCredential` choices

### 5. Documentation

- [docs/commands/deployment.md](docs/commands/deployment.md) - Mention that credential list shows status icon (✓ ○ ✗ ⊘) with color when available
- [docs/wizard.md](docs/wizard.md) - Mention that credential selection displays status icon with color when the dataplane provides it

## Backward Compatibility

- Dataplane API returns `status` (default `pending`) per CredentialResponse schema. Older dataplanes or different response shapes may omit it.
- All display logic must handle `c.status === undefined` or invalid values: show credential without status suffix.

## Files Summary


| File                                       | Action                                                         |
| ------------------------------------------ | -------------------------------------------------------------- |
| lib/utils/credential-display.js            | Create - status formatter and credential display helper        |
| lib/commands/credential-list.js            | Modify - use formatter in displayCredentialList                |
| lib/generator/wizard-prompts.js            | Modify - include status in promptForExistingCredential choices |
| tests/lib/utils/credential-display.test.js | Create - unit tests                                            |
| tests/lib/commands/credential-list.test.js | Modify - add status display tests                              |
| tests/lib/generator/wizard-prompts.test.js | Modify - add status in choices tests                           |
| docs/commands/deployment.md                | Modify - note status in credential list                        |
| docs/wizard.md                             | Modify - note status in credential selection                   |


## Implementation Validation Report

**Date**: 2025-02-27  
**Plan**: .cursor/plans/83-credential_status_display.plan.md  
**Status**: ✅ COMPLETE

### Executive Summary

All implementation requirements have been met. The credential status display feature is fully implemented in both `aifabrix credential list` and the wizard's `promptForExistingCredential`. All files exist, tests pass, and code quality validation succeeded.

### Task Completion

- **Total tasks**: 9 (Files Summary)
- **Completed**: 9
- **Incomplete**: 0
- **Completion**: 100%

### File Existence Validation

| File | Status |
|------|--------|
| lib/utils/credential-display.js | ✅ Exists - formatCredentialStatus, formatCredentialWithStatus, STATUS_ICONS, STATUS_CHALK |
| lib/commands/credential-list.js | ✅ Modified - uses formatCredentialWithStatus in displayCredentialList |
| lib/generator/wizard-prompts.js | ✅ Modified - status in promptForExistingCredential choices, JSDoc includes status |
| tests/lib/utils/credential-display.test.js | ✅ Exists - unit tests for formatCredentialStatus and formatCredentialWithStatus |
| tests/lib/commands/credential-list.test.js | ✅ Modified - status icon display tests (verified, failed, missing status) |
| tests/lib/generator/wizard-prompts.test.js | ✅ Modified - status icon in promptForExistingCredential choices test |
| docs/commands/deployment.md | ✅ Modified - "When the dataplane provides credential status, the list shows a colored icon: ✓ (verified), ○ (pending), ✗ (failed), ⊘ (expired)" |
| docs/wizard.md | ✅ Modified - "When the dataplane provides credential status, each choice shows a colored icon: ✓ (verified), ○ (pending), ✗ (failed), ⊘ (expired)" |

### Test Coverage

- ✅ Unit tests: tests/lib/utils/credential-display.test.js (formatCredentialStatus, formatCredentialWithStatus)
- ✅ Credential list tests: status icon when present, no icon when missing, alternative field names
- ✅ Wizard prompts tests: status icon in choices when credential has status
- ✅ Integration tests: N/A for this feature
- All 228 test suites pass (4923 tests)

### Code Quality Validation

- ✅ Format: PASSED (npm run lint:fix exit code 0)
- ✅ Lint: PASSED (npm run lint exit code 0, 0 errors, 0 warnings)
- ✅ Tests: PASSED (npm test - all tests pass)

### Cursor Rules Compliance

- ✅ Code reuse: Shared utility credential-display.js used by credential-list and wizard-prompts
- ✅ Error handling: formatCredentialStatus returns null for invalid/missing status; display logic handles undefined
- ✅ Logging: credential-list uses logger utility
- ✅ Type safety: JSDoc on formatCredentialStatus, formatCredentialWithStatus, promptForExistingCredential
- ✅ Async patterns: async/await used where applicable
- ✅ File operations: N/A (no new file ops)
- ✅ Input validation: formatCredentialStatus validates status type and value
- ✅ Module patterns: CommonJS, proper exports
- ✅ Security: No hardcoded secrets; credential display shows only non-sensitive metadata

### Implementation Completeness

- ✅ Shared utility: COMPLETE (credential-display.js)
- ✅ Credential list command: COMPLETE
- ✅ Wizard credential selection: COMPLETE
- ✅ Tests: COMPLETE
- ✅ Documentation: COMPLETE
- ✅ Backward compatibility: COMPLETE (handles missing status, invalid values)

### Minor Implementation Notes

- Plan specified `formatCredentialStatus(status, options)` with `options.useChalk`; implementation uses a simpler API: `formatCredentialStatus(status)` with statusFormatted always chalk-colored when status exists. This achieves the same result with a cleaner interface.
- Plan specified `STATUS_COLORS`; implementation exports `STATUS_CHALK` (chalk functions). Functionally equivalent; STATUS_CHALK is more accurate since values are chalk color functions.

### Final Validation Checklist

- [x] All files created/modified as specified
- [x] All tests exist and pass
- [x] Code quality validation passes (format, lint, test)
- [x] Cursor rules compliance verified
- [x] Documentation updated
- [x] Backward compatibility preserved (no icon when status absent)

