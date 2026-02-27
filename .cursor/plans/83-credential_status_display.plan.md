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


