---
name: HubSpot test naming separation
overview: Rename all wizard e2e test app names from the `hubspot-test-*` prefix to `wizard-e2e-*` so they do not overlap with the real "hubspot" integration (integration/hubspot), and align README/docs so the real hubspot example uses "hubspot" consistently. Then validate files and run manual, integration, and unit tests.
todos: []
isProject: false
---

# HubSpot test naming separation

## Problem

- **Real HubSpot integration**: Lives in `integration/hubspot/` with app/system key `hubspot` ([application.json](integration/hubspot/application.json), [hubspot-system.json](integration/hubspot/hubspot-system.json)).
- **Wizard e2e tests**: Use app names like `hubspot-test-e2e`, `hubspot-test-platform`, `hubspot-test-negative-`*, creating folders `integration/hubspot-test-`* and appearing in docs/examples as "hubspot-test".
- **Overlap**: The "hubspot-test" name can be confused with the real "hubspot" app (same prefix, same product name). User wants test naming to not overlap with real "hubspot".

## Approach

1. **New prefix for wizard e2e test apps**: Use `wizard-e2e-` instead of `hubspot-test-`.
  - Test apps become: `wizard-e2e-e2e`, `wizard-e2e-platform`, `wizard-e2e-env-vars`, `wizard-e2e-credential-real`, `wizard-e2e-negative-`*.
  - Generated integration folders: `integration/wizard-e2e-e2e`, `integration/wizard-e2e-platform`, etc. No overlap with `integration/hubspot`.
2. **Unit test fixtures**: Replace example systemKey `hubspot-test` with `wizard-e2e-demo` in external-readme tests so fixture data does not reuse the "hubspot" name.
3. **Docs and CLI**: Use non-overlapping examples (e.g. `wizard-e2e-v2` for wizard debug; keep or use `hubspot-demo` for "your app" examples where appropriate). Fix README so the HubSpot example uses "hubspot" consistently (configure under `integration/hubspot/`, validate/deploy `hubspot`).

## Files to change

### 1. Integration hubspot test runner and artifacts


| File                                                                                                                                             | Change                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [integration/hubspot/test.js](integration/hubspot/test.js)                                                                                       | `isTestAppName`: check `appName.startsWith('wizard-e2e-')`. Replace every `hubspot-test-e2e` → `wizard-e2e-e2e`, `hubspot-test-platform` → `wizard-e2e-platform`, `hubspot-test-env-vars` → `wizard-e2e-env-vars`, `hubspot-test-credential-real` → `wizard-e2e-credential-real`, `hubspot-test-cred-real` → `wizard-e2e-cred-real`, and all `hubspot-test-negative-`* → `wizard-e2e-negative-`*. |
| [integration/hubspot/wizard-hubspot-e2e.yaml](integration/hubspot/wizard-hubspot-e2e.yaml)                                                       | `appName: hubspot-test-e2e` → `appName: wizard-e2e-e2e`                                                                                                                                                                                                                                                                                                                                           |
| [integration/hubspot/wizard-hubspot-platform.yaml](integration/hubspot/wizard-hubspot-platform.yaml)                                             | `appName: hubspot-test-platform` → `appName: wizard-e2e-platform`                                                                                                                                                                                                                                                                                                                                 |
| [integration/hubspot/test-artifacts/wizard-hubspot-env-vars.yaml](integration/hubspot/test-artifacts/wizard-hubspot-env-vars.yaml)               | `appName: hubspot-test-env-vars` → `appName: wizard-e2e-env-vars`                                                                                                                                                                                                                                                                                                                                 |
| [integration/hubspot/test-artifacts/wizard-hubspot-credential-real.yaml](integration/hubspot/test-artifacts/wizard-hubspot-credential-real.yaml) | `appName: hubspot-test-credential-real` → `appName: wizard-e2e-credential-real`; `key: hubspot-test-cred-real` → `key: wizard-e2e-cred-real`                                                                                                                                                                                                                                                      |
| All [integration/hubspot/test-artifacts/wizard-invalid-*.yaml](integration/hubspot/test-artifacts/)                                              | `appName: hubspot-test-negative-`* → `appName: wizard-e2e-negative-`* (same suffix)                                                                                                                                                                                                                                                                                                               |
| All [integration/hubspot/test-artifacts/wizard-valid-for-*.yaml](integration/hubspot/test-artifacts/)                                            | `appName: hubspot-test-negative-`* → `appName: wizard-e2e-negative-`* (same suffix)                                                                                                                                                                                                                                                                                                               |
| [.gitignore](.gitignore)                                                                                                                         | `integration/hubspot-test-*/` → `integration/wizard-e2e-*/`                                                                                                                                                                                                                                                                                                                                       |


### 2. Unit tests (fixtures and assertions)


| File                                                                                                                       | Change                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [tests/manual/external-readme-template.test.js](tests/manual/external-readme-template.test.js)                             | Use `systemKey: 'wizard-e2e-demo'`, `displayName: 'Wizard E2E Demo'`; assert `wizard-e2e-demo/apiKey` instead of `hubspot-test/apiKey`. |
| [tests/lib/utils/external-readme.test.js](tests/lib/utils/external-readme.test.js)                                         | Use `systemKey: 'wizard-e2e-demo'` and `path: 'wizard-e2e-demo/apiKey'` in the apikey test.                                             |
| [tests/lib/external-system/external-system-test-auth.test.js](tests/lib/external-system/external-system-test-auth.test.js) | Replace `hubspot-test-v1` with `wizard-e2e-v1` (or equivalent) in the test.                                                             |


### 3. Docs and CLI help


| File                                                                                 | Change                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [README.md](README.md)                                                               | Align HubSpot example with real app: "Configure auth and datasources under `integration/hubspot/`", "Validate: `aifabrix validate hubspot`", "Deploy: `aifabrix deploy hubspot`" (so the example is the real hubspot, not hubspot-test). |
| [lib/cli/setup-app.js](lib/cli/setup-app.js)                                         | Example in help: `hubspot-test-v2` → `wizard-e2e-v2` (or similar).                                                                                                                                                                       |
| [lib/api/external-test.api.js](lib/api/external-test.api.js)                         | JSDoc example: `hubspot-test-v4-contacts` → `wizard-e2e-v4-contacts`.                                                                                                                                                                    |
| [docs/wizard.md](docs/wizard.md)                                                     | Replace `hubspot-test-v2` with `wizard-e2e-v2`; optional: replace "HubSpot CRM (hubspot-test-v4)" example with "HubSpot CRM (wizard-e2e-v4)" or keep generic.                                                                            |
| [docs/your-own-applications.md](docs/your-own-applications.md)                       | Replace `hubspot-test` example app name with `hubspot-demo` (or `my-hubspot`) so it does not overlap with real "hubspot".                                                                                                                |
| [docs/commands/application-development.md](docs/commands/application-development.md) | Example path: `kv://hubspot-test/apikey` → e.g. `kv://hubspot-demo/apikey` or `kv://wizard-e2e-demo/apikey`.                                                                                                                             |
| [docs/commands/external-integration.md](docs/commands/external-integration.md)       | `hubspot-test-v2` → `wizard-e2e-v2`.                                                                                                                                                                                                     |


### 4. No changes

- **integration/hubspot/** real config (application.json, hubspot-system.json, datasources): Keep as-is; key remains `hubspot`.
- **tests/integration/hubspot/hubspot-integration.test.js**: Uses `appName = 'hubspot'` and real paths; no change.
- **.cursor/plans/** (Done/Archive): Leave as historical; optional follow-up to update examples if desired.

## Validation and test runs

After edits:

1. **Lint**: `npm run lint` (no new errors).
2. **Unit tests**: `npm test` (all pass).
3. **Manual tests**: `npm run test:manual` (external-readme-template and any other manual tests pass).
4. **Integration tests**: `npm run test:integration` (hubspot-integration and other integration tests pass).
5. **HubSpot wizard e2e script** (optional, requires env/dataplane): `node integration/hubspot/test.js --type positive` to confirm wizard-e2e-* apps are created and cleaned up under `integration/wizard-e2e-*/`.

## Naming summary


| Before                              | After                                 |
| ----------------------------------- | ------------------------------------- |
| hubspot-test-e2e                    | wizard-e2e-e2e                        |
| hubspot-test-platform               | wizard-e2e-platform                   |
| hubspot-test-env-vars               | wizard-e2e-env-vars                   |
| hubspot-test-credential-real        | wizard-e2e-credential-real            |
| hubspot-test-cred-real              | wizard-e2e-cred-real                  |
| hubspot-test-negative-*             | wizard-e2e-negative-*                 |
| integration/hubspot-test-*/         | integration/wizard-e2e-*/ (gitignore) |
| Example systemKey hubspot-test      | wizard-e2e-demo (in unit tests)       |
| README validate/deploy hubspot-test | hubspot (real app example)            |


This keeps the real "hubspot" integration clearly separate from all wizard e2e and doc examples.