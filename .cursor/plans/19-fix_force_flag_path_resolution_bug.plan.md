# Fix Force Flag Path Resolution Bug

## Problem

When using `aifabrix resolve <app> --force`, the command generates random values for secrets that already exist in the secrets file. This happens because:

1. **Path Resolution Mismatch**: 

- `generateMissingSecrets()` writes to `secretsPaths.userPath` which uses `paths.getAifabrixHome()` (respects config.yaml `aifabrix-home` override)
- `loadSecrets()` reads from `loadUserSecrets()` which uses `os.homedir()` directly (ignores config.yaml override)
- These can resolve to different paths, causing writes to one file and reads from another

2. **Order of Operations**:

- `generateMissingSecrets()` is called BEFORE `loadSecrets()` 
- If the file doesn't exist at the write path, `loadExistingSecrets()` returns `{}`
- All keys are treated as "missing" and random values are generated
- Existing secrets in the actual read path are ignored

## Solution

### 1. Fix Path Resolution Consistency

**File**: [`lib/utils/secrets-utils.js`](lib/utils/secrets-utils.js)Update `loadUserSecrets()` to use `paths.getAifabrixHome()` instead of `os.homedir()` directly:

```javascript
function loadUserSecrets() {
  const pathsUtil = require('./paths');
  const userSecretsPath = path.join(pathsUtil.getAifabrixHome(), 'secrets.local.yaml');
  // ... rest of function
}
```

**File**: [`lib/utils/secrets-utils.js`](lib/utils/secrets-utils.js)Update `loadDefaultSecrets()` to use `paths.getAifabrixHome()` for consistency:

```javascript
function loadDefaultSecrets() {
  const pathsUtil = require('./paths');
  const defaultPath = path.join(pathsUtil.getAifabrixHome(), 'secrets.yaml');
  // ... rest of function
}
```

### 2. Fix generateMissingSecrets Path Resolution

**File**: [`lib/utils/secrets-generator.js`](lib/utils/secrets-generator.js)Remove the fallback that uses `os.homedir()` directly. The function should always use the provided `secretsPath` parameter:

```javascript
async function generateMissingSecrets(envTemplate, secretsPath) {
  if (!secretsPath) {
    const pathsUtil = require('./paths');
    const resolvedPath = path.join(pathsUtil.getAifabrixHome(), 'secrets.yaml');
  } else {
    const resolvedPath = secretsPath;
  }
  // ... rest of function
}
```

### 3. Ensure generateEnvContent Uses Correct Path

**File**: [`lib/secrets.js`](lib/secrets.js)Verify that `generateEnvContent()` passes the correct path to `generateMissingSecrets()`. The current implementation should work once `loadUserSecrets()` is fixed, but we should ensure consistency:

```javascript
async function generateEnvContent(appName, secretsPath, environment = 'local', force = false) {
  // ... existing code ...
  
  if (force) {
    // Use the same path resolution logic as loadSecrets
    let secretsFileForGeneration;
    if (secretsPath) {
      secretsFileForGeneration = resolveSecretsPath(secretsPath);
    } else {
      // Use the same path that loadUserSecrets() would use
      const pathsUtil = require('./utils/paths');
      secretsFileForGeneration = path.join(pathsUtil.getAifabrixHome(), 'secrets.local.yaml');
    }
    await generateMissingSecrets(template, secretsFileForGeneration);
  }
  
  // ... rest of function
}
```

## Testing

### Unit Tests

**File**: [`tests/lib/utils/secrets-utils.test.js`](tests/lib/utils/secrets-utils.test.js)Add tests for path resolution consistency:

1. **Test `loadUserSecrets()` respects config.yaml override**:

- Mock config.yaml with `aifabrix-home` override
- Verify `loadUserSecrets()` reads from the override path
- Verify it falls back to default when override not set

2. **Test `loadDefaultSecrets()` respects config.yaml override**:

- Mock config.yaml with `aifabrix-home` override  
- Verify `loadDefaultSecrets()` reads from the override path

**File**: [`tests/lib/utils/secrets-generator.test.js`](tests/lib/utils/secrets-generator.test.js)Add tests for path resolution in `generateMissingSecrets()`:

1. **Test `generateMissingSecrets()` uses provided path**:

- Call with explicit path
- Verify it writes to the provided path
- Verify it doesn't use fallback

2. **Test `generateMissingSecrets()` respects config.yaml when path not provided**:

- Mock config.yaml with `aifabrix-home` override
- Call without path parameter
- Verify it uses override path

**File**: [`tests/lib/secrets.test.js`](tests/lib/secrets.test.js)Add integration tests for the fix:

1. **Test `--force` doesn't overwrite existing secrets**:

- Create secrets file with existing secret `secrets-encryptionKeyVault: 'existing-value'`
- Call `generateEnvContent()` with `force=true`
- Verify existing secret is preserved
- Verify only missing secrets are generated

2. **Test path resolution consistency**:

- Mock config.yaml with `aifabrix-home` override
- Create secrets file at override path
- Call `generateEnvContent()` with `force=true` and `secretsPath=undefined`
- Verify secrets are read from and written to the same path

3. **Test explicit path provided**:

- Create secrets file at explicit path `../../secrets.local.yaml`
- Call `generateEnvContent()` with `force=true` and `secretsPath='../../secrets.local.yaml'`
- Verify secrets are read from and written to the explicit path

### Integration Tests

**File**: [`tests/integration/steps/step-03-resolve.test.js`](tests/integration/steps/step-03-resolve.test.js)Enhance existing integration test:

1. **Test `--force` preserves existing secrets**:

- Create app with secrets file containing existing values
- Run `aifabrix resolve <app> --force`
- Verify existing secrets are not overwritten
- Verify only missing secrets are generated

## Implementation Order

1. Fix `loadUserSecrets()` to use `paths.getAifabrixHome()`
2. Fix `loadDefaultSecrets()` to use `paths.getAifabrixHome()`
3. Fix `generateMissingSecrets()` to use `paths.getAifabrixHome()` in fallback
4. Update `generateEnvContent()` to ensure path consistency
5. Add unit tests for path resolution
6. Add integration tests for the fix
7. Run all tests to verify fix

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - Secret management, data protection, and security standards. Critical for this plan as it fixes secret handling bugs.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits (≤500 lines, ≤50 lines per function), documentation, and JSDoc requirements
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory checks before commit (build, lint, test, coverage)
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, coverage requirements (≥80% for new code)
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns and logging standards
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** - JavaScript conventions, async/await patterns, error handling
- **[Development Workflow](.cursor/rules/project-rules.mdc#development-workflow)** - Pre/during/post development steps

**Key Requirements**:

- Never log secrets or sensitive data (Security & Compliance)
- Use `path.join()` for cross-platform paths (Code Style)
- Use try-catch for all async operations (Code Style)
- Add JSDoc comments for all public functions (Code Quality Standards)
- Keep files ≤500 lines and functions ≤50 lines (Code Quality Standards)
- Write tests for all functions with ≥80% coverage (Testing Conventions)
- Use Jest for testing with proper mocking (Testing Conventions)
- Run build → lint → test validation sequence (Quality Gates)

## Before Development

- [ ] Read Security & Compliance section from project-rules.mdc (especially Secret Management)
- [ ] Review existing path resolution logic in `lib/utils/paths.js`
- [ ] Review existing secret loading logic in `lib/utils/secrets-utils.js` and `lib/secrets.js`
- [ ] Review existing tests for secrets utilities to understand test patterns
- [ ] Understand config.yaml `aifabrix-home` override mechanism
- [ ] Review error handling patterns in existing secret management code

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs lint + test:ci)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments with proper parameter and return types
7. **Code Quality**: All rule requirements met
8. **Security**: No hardcoded secrets, ISO 27001 compliance, secrets never logged
9. **Path Resolution**: All path operations use `paths.getAifabrixHome()` consistently
10. **Test Coverage**: All new code has ≥80% test coverage
11. **Existing Secrets Preserved**: `--force` flag does not overwrite existing secrets
12. **Path Consistency**: Write and read operations use the same path resolution logic
13. All tasks completed

## Expected Behavior After Fix

- `--force` flag only generates secrets that are actually missing
- Existing secrets are preserved and not overwritten
- Path resolution is consistent between write and read operations
- Config.yaml `aifabrix-home` override is respected throughout
- Explicit secrets file paths work correctly

## Plan Validation Report

**Date**: 2025-01-27

**Plan**: `.cursor/plans/19-fix_force_flag_path_resolution_bug.plan.md`

**Status**: ✅ VALIDATED

### Plan Purpose

**Summary**: Fix critical bug where `--force` flag generates random values for existing secrets due to path resolution mismatch between `generateMissingSecrets()` and `loadSecrets()`.

**Scope**:

- Secret management utilities (`lib/utils/secrets-utils.js`, `lib/utils/secrets-generator.js`)
- Secret resolution (`lib/secrets.js`)
- Path resolution (`lib/utils/paths.js`)
- CLI command (`resolve` command)
- Unit and integration tests

**Type**: Bug Fix / Refactoring

### Applicable Rules

- ✅ **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - Critical: This plan fixes secret management bugs. Secret Management section requires never exposing secrets, proper path resolution, and secure handling.
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits, JSDoc documentation requirements
- ✅ **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory: Build, lint, test, coverage requirements
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, ≥80% coverage requirement
- ✅ **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, never log secrets
- ✅ **[Code Style](.cursor/rules/project-rules.mdc#code-style)** - JavaScript conventions, async/await, path.join() usage
- ✅ **[Development Workflow](.cursor/rules/project-rules.mdc#development-workflow)** - Pre/during/post development steps

### Rule Compliance

- ✅ **DoD Requirements**: Documented with BUILD → LINT → TEST sequence
- ✅ **Security & Compliance**: Plan addresses secret management security issue
- ✅ **Code Quality Standards**: Plan mentions file size limits and JSDoc requirements
- ✅ **Testing Conventions**: Comprehensive test plan included (unit + integration)
- ✅ **Error Handling**: Plan uses proper error handling patterns
- ✅ **Code Style**: Plan uses path.join() and async/await patterns

### Plan Updates Made

- ✅ Added **Rules and Standards** section with applicable rule references
- ✅ Added **Before Development** checklist
- ✅ Added **Definition of Done** section with mandatory validation steps
- ✅ Added rule links using anchor format
- ✅ Documented validation order: BUILD → LINT → TEST
- ✅ Added security compliance requirements
- ✅ Added test coverage requirements (≥80%)

### Recommendations

- ✅ Plan is production-ready
- ✅ All critical DoD requirements documented
- ✅ Security implications properly addressed
- ✅ Test coverage plan is comprehensive
- ✅ Path resolution consistency is well-defined

### Validation Notes

- Plan correctly identifies the root cause (path resolution mismatch)
- Solution addresses both write and read path resolution
- Test plan covers all scenarios (existing secrets, path overrides, explicit paths)
- Security considerations are properly addressed (no secret logging, ISO 27001 compliance)
- Implementation order is logical and follows dependencies