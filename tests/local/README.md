# Local-Only Tests

This directory contains tests that are valuable for local development but are excluded from CI runs due to their complexity and brittleness in CI environments.

## Why These Tests Are Local-Only

These tests require complex setup including:
- Template file creation and path resolution
- Complex directory structures
- Extensive mocking of file system operations
- Time-sensitive async operations that are difficult to mock reliably

While these tests are important for ensuring code coverage and catching edge cases, they frequently fail in CI simulation environments due to:
- Path resolution differences between local and CI environments
- Template file location detection issues
- Timing issues with async mocks
- Complex test setup requirements

## Running Local Tests

To run these tests locally:

```bash
# Run all tests including local tests
npm test -- tests/local

# Run specific local test file
npm test -- tests/local/lib/template-validator.test.js
```

## Test Files in This Directory

- `app-run-debug.test.js` - Debug logging and error handling tests
- `template-validator.test.js` - Template validation tests
- `app-uncovered-paths.test.js` - Uncovered code path tests
- `app-run-coverage.test.js` - Additional coverage tests
- `dockerfile-utils.test.js` - Dockerfile utility tests
- `app-run-advanced.test.js` - Advanced app-run tests
- `app-run-compose.test.js` - Docker compose generation tests
- `app-coverage-extra.test.js` - Extra coverage tests
- `lib/app/app-coverage-uncovered.test.js` - Uncovered app.js paths (pushApp, generateDockerfileForApp, promptForOptions); excluded from CI due to temp-dir/path resolution (getProjectRoot, detectAppType) differences in GitHub Actions
- `app-run-branch-coverage.test.js` - Branch coverage tests
- `utils/build-copy.test.js` - Build copy utility tests
- `lib/external-system/download-helpers.test.js` - External system download helpers tests
- `lib/validation/external-manifest-validator.test.js` - External manifest validator tests with complex mocking
- `lib/schema/schema-validation.test.js` - Schema validation (Plan 49): JSON schemas and deployment-rules.yaml structure; excluded from CI due to path resolution differences in GitHub Actions/Jest
- `lib/commands-app-actions.test.js` - Application command action handlers (register, list); excluded from CI due to cwd/temp-dir and path resolution differences (getProjectRoot, detectAppType) between local and CI
- `lib/generator/generator-split-external-rbac.test.js` - External system RBAC split-JSON (roles/permissions to rbac.yml); excluded from CI due to getProjectRoot/template path resolution differing in GitHub Actions

## CI Exclusion

These tests are excluded from default test runs via `jest.config.js` (when `INCLUDE_LOCAL_TESTS` is not `'true'`). CI and `npm test` both exclude `tests/local/` by default.

To run local tests:

```bash
INCLUDE_LOCAL_TESTS=true npm test
# or
npm test -- tests/local
```

This keeps CI and default `npm test` fast and reliable while allowing developers to run comprehensive local-only tests when needed.

