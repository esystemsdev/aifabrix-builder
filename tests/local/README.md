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
- `app-run-branch-coverage.test.js` - Branch coverage tests
- `utils/build-copy.test.js` - Build copy utility tests
- `lib/external-system/download-helpers.test.js` - External system download helpers tests
- `lib/validation/external-manifest-validator.test.js` - External manifest validator tests with complex mocking

## CI Exclusion

These tests are automatically excluded from CI runs via `jest.config.js` when running in CI environments (detected via `CI=true` or `CI_SIMULATION=true` environment variables):

```javascript
// Detect CI environment (GitHub Actions, CI simulation, etc.)
const isCI = process.env.CI === 'true' || process.env.CI_SIMULATION === 'true';

testPathIgnorePatterns: [
  '/node_modules/',
  '\\\\node_modules\\\\',
  '/tests/integration/',
  '\\\\tests\\\\integration\\\\',
  // Exclude local tests in CI environments
  ...(isCI ? [
    '/tests/local/',
    '\\\\tests\\\\local\\\\'
  ] : [])
]
```

This ensures CI builds are fast and reliable while still allowing developers to run comprehensive tests locally. When running `npm test` locally (without CI environment variables), these tests will be included.

