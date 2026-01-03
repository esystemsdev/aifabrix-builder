# Add Public Port Support for Docker Context

## Overview

Add dynamic public port support for all services in docker context to enable developer-specific host access ports while maintaining internal container ports for inter-container communication. Any `*_PORT` variable automatically gets a corresponding `*_PUBLIC_PORT` calculated as `basePort + (developer-id * 100)`.

## Architecture

For docker context:

- **`*_PORT`** (e.g., MISO_PORT=3000): Internal container port, unchanged - used for container-to-container communication
- **`*_PUBLIC_PORT`** (e.g., MISO_PUBLIC_PORT=3100 for dev-id 1): Public host port, automatically calculated - used for host access and Docker port mapping
- Calculation: `*_PUBLIC_PORT = *_PORT + (developer-id * 100)` (only when developer-id > 0)

For local context:

- **`*_PORT`** (e.g., MISO_PORT=3010 + devId*100): Already adjusted by developer-id, no changes needed
- No `*_PUBLIC_PORT` needed (ports are already public in local context)

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Module structure, file organization, utility module patterns (applies - modifying `lib/utils/env-map.js`)
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** - JavaScript conventions, async/await patterns, error handling, try-catch for async operations (applies - modifying utility code)
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits (≤500 lines, ≤50 lines per function), JSDoc documentation, code organization (MANDATORY for all plans)
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, coverage requirements (≥80%), mock patterns (applies - adding comprehensive tests)
- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** - YAML validation, schema validation (applies - modifying env-config.yaml)
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory checks before commit (build → lint → test), test coverage ≥80%, all tests must pass (MANDATORY for all plans)
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, logging standards, never log secrets (applies - error handling in port calculation)
- **[Development Workflow](.cursor/rules/project-rules.mdc#development-workflow)** - Pre/during/post development steps, TDD approach (applies - plan includes test-first approach)
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - No hardcoded secrets, input validation, data protection (applies - validating port values)

**Key Requirements**:

- Use async/await for all asynchronous operations
- Wrap async operations in try-catch blocks
- Add JSDoc comments for all public functions (including updated `buildEnvVarMap` function)
- Keep files ≤500 lines and functions ≤50 lines
- Validate all inputs (port values, developer-id)
- Use path.join() for cross-platform paths (if needed)
- Never log secrets or sensitive data
- Write comprehensive tests with ≥80% coverage
- Test edge cases (invalid ports, missing values, developer-id 0)
- Follow existing code patterns in env-map.js

## Before Development

- [ ] Read Architecture Patterns section from project-rules.mdc (module structure, utility patterns)
- [ ] Read Code Style section (async/await, error handling patterns)
- [ ] Read Testing Conventions section (Jest patterns, mock patterns, coverage requirements)
- [ ] Review existing `lib/utils/env-map.js` code to understand current patterns
- [ ] Review existing test file `tests/lib/utils/env-map.test.js` to understand test structure
- [ ] Review `lib/schema/env-config.yaml` to understand current structure
- [ ] Understand developer-id handling from `lib/config.js`
- [ ] Review documentation files to understand current port documentation patterns

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs lint + test:ci)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments (including updated `buildEnvVarMap` function)
7. **Code Quality**: All rule requirements met
8. **Security**: No hardcoded secrets, ISO 27001 compliance, proper input validation
9. **Test Coverage**: ≥80% coverage for new/modified code (env-map.js changes)
10. **All Tasks Completed**: All implementation tasks completed
11. **Documentation Updated**: All documentation files updated with `*_PUBLIC_PORT` pattern
12. **CHANGELOG Updated**: Feature documented in CHANGELOG.md
13. **Tests Pass**: All existing tests pass, new tests added and passing
14. **Edge Cases Tested**: Invalid ports, missing values, developer-id 0, manual overrides

## Implementation Plan

### 1. Update env-config.yaml Schema

**File**: [`lib/schema/env-config.yaml`](lib/schema/env-config.yaml)

- Add comment explaining `*_PUBLIC_PORT` pattern for docker context
- Document that any `*_PORT` variable automatically gets a `*_PUBLIC_PORT` calculated
- Keep all `*_PORT` values as internal ports (unchanged)
- Note: MISO_PORT=3000 is used as example, but pattern applies to all services (KEYCLOAK_PORT, DB_PORT, etc.)

### 2. Update env-map.js for Dynamic Public Port Calculation

**File**: [`lib/utils/env-map.js`](lib/utils/env-map.js)

- After line 155 (after local context port adjustment), add docker context public port calculation
- For docker context, dynamically calculate `*_PUBLIC_PORT` for any `*_PORT` variable
- Pattern: For each `*_PORT` in result, calculate `*_PUBLIC_PORT = *_PORT + (developer-id * 100)`
- Only calculate if `*_PORT` exists, is a valid number, and developer-id > 0
- Keep all `*_PORT` values unchanged for docker context (internal ports)
- Skip calculation if `*_PUBLIC_PORT` already exists (allow manual override)

**Logic**:

```javascript
// After local context adjustment (line 155)
if (context === 'docker') {
  // Calculate public ports for docker context (dynamic for all *_PORT variables)
  let devIdNum = 0;
  if (developerId !== null && developerId !== undefined) {
    const parsed = typeof developerId === 'number' ? developerId : parseInt(developerId, 10);
    if (!Number.isNaN(parsed)) {
      devIdNum = parsed;
    }
  } else {
    try {
      const devId = await config.getDeveloperId();
      if (devId !== null && devId !== undefined) {
        const parsed = parseInt(devId, 10);
        if (!Number.isNaN(parsed)) {
          devIdNum = parsed;
        }
      }
    } catch {
      // ignore, will use 0
    }
  }

  // Dynamically calculate *_PUBLIC_PORT for any *_PORT variable
  if (devIdNum > 0) {
    for (const [key, value] of Object.entries(result)) {
      // Match any variable ending with _PORT (e.g., MISO_PORT, KEYCLOAK_PORT, DB_PORT)
      if (/_PORT$/.test(key) && !/_PUBLIC_PORT$/.test(key)) {
        const publicPortKey = key.replace(/_PORT$/, '_PUBLIC_PORT');
        
        // Skip if public port already exists (allow manual override)
        if (result[publicPortKey] === undefined) {
          let portVal;
          if (typeof value === 'string') {
            portVal = parseInt(value, 10);
          } else if (typeof value === 'number') {
            portVal = value;
          } else {
            continue;
          }
          
          if (!Number.isNaN(portVal)) {
            result[publicPortKey] = String(portVal + (devIdNum * 100));
          }
        }
      }
    }
  }
}
```



### 3. Update Documentation

**File**: [`docs/DEVELOPER-ISOLATION.md`](docs/DEVELOPER-ISOLATION.md)

- Add section explaining docker context public ports pattern
- Document `*_PORT` vs `*_PUBLIC_PORT` distinction (generic pattern, not MISO-specific)
- Add table showing port values for different developer IDs in docker context
- Include examples for MISO_PUBLIC_PORT, KEYCLOAK_PUBLIC_PORT, etc.
- Update existing port scenarios table to include `*_PUBLIC_PORT` variables
- Explain that pattern applies to all services automatically

**File**: [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)

- Update env-config.yaml documentation section
- Explain `*_PUBLIC_PORT` variable availability (dynamic pattern)
- Document automatic calculation: `*_PUBLIC_PORT = *_PORT + (developer-id * 100)`
- Add examples showing how to use `*_PUBLIC_PORT` in env.template (MISO, KEYCLOAK, etc.)
- Note that pattern works for any service with a `*_PORT` variable

### 4. Update Tests

**File**: [`tests/lib/utils/env-map.test.js`](tests/lib/utils/env-map.test.js)

- Add test cases for dynamic `*_PUBLIC_PORT` calculation in docker context
- Test with developer-id 0 (no public ports calculated)
- Test with developer-id 1:
- MISO_PUBLIC_PORT = 3100 (from MISO_PORT=3000)
- KEYCLOAK_PUBLIC_PORT = 8182 (from KEYCLOAK_PORT=8082)
- DB_PUBLIC_PORT = 5532 (from DB_PORT=5432)
- Test with developer-id 2:
- MISO_PUBLIC_PORT = 3200
- KEYCLOAK_PUBLIC_PORT = 8282
- Test that all `*_PORT` values remain unchanged in docker context
- Test that local context behavior is unchanged (no `*_PUBLIC_PORT` calculated)
- Test that manually set `*_PUBLIC_PORT` values are not overridden
- Test edge cases: invalid port values, missing ports, etc.

**File**: [`tests/fixtures/env-generation/env-config.yaml`](tests/fixtures/env-generation/env-config.yaml)

- Ensure test fixture matches production env-config.yaml structure
- Include multiple port variables (MISO_PORT, KEYCLOAK_PORT, DB_PORT, REDIS_PORT) for comprehensive testing

**File**: [`tests/lib/utils/env-generation.test.js`](tests/lib/utils/env-generation.test.js)

- Add test cases verifying `*_PUBLIC_PORT` variables are available in generated env files for docker context
- Verify `*_PUBLIC_PORT` interpolation works correctly for multiple services
- Test MISO_PUBLIC_PORT, KEYCLOAK_PUBLIC_PORT, etc.

### 5. Update CHANGELOG.md

**File**: [`CHANGELOG.md`](CHANGELOG.md)

- Add entry documenting dynamic `*_PUBLIC_PORT` feature
- Explain use case: developer-specific public ports for docker context
- Document automatic calculation pattern: `*_PUBLIC_PORT = *_PORT + (developer-id * 100)`
- Note that pattern applies to all services (MISO, KEYCLOAK, etc.)

## Testing Strategy

1. **Unit Tests**: Test env-map.js dynamic public port calculation logic for all `*_PORT` variables
2. **Integration Tests**: Verify `*_PUBLIC_PORT` variables appear in generated .env files for docker context
3. **Documentation Tests**: Ensure examples are accurate and cover multiple services

## Example Usage

After implementation (docker context, developer-id 1):

- `MISO_PORT=3000` (internal), `MISO_PUBLIC_PORT=3100` (public)
- `KEYCLOAK_PORT=8082` (internal), `KEYCLOAK_PUBLIC_PORT=8182` (public)
- `DB_PORT=5432` (internal), `DB_PUBLIC_PORT=5532` (public)
- `REDIS_PORT=6379` (internal), `REDIS_PUBLIC_PORT=6479` (public)

Developer ID 0 (docker): No `*_PUBLIC_PORT` calculated (uses base ports)In env.template:

```bash
# Internal port (container-to-container communication)
MISO_CONTROLLER_URL=http://${MISO_HOST}:${MISO_PORT}

# Public port (host access) - available in docker context when developer-id > 0
MISO_PUBLIC_URL=http://localhost:${MISO_PUBLIC_PORT}

# Works for any service automatically
KEYCLOAK_PUBLIC_URL=http://localhost:${KEYCLOAK_PUBLIC_PORT}
```



## Extensibility

The implementation is fully dynamic and extensible:

- **No hardcoding**: Any `*_PORT` variable automatically gets `*_PUBLIC_PORT` calculated
- **Automatic**: No need to modify code when adding new services
- **Consistent**: Same calculation formula for all services: `basePort + (developer-id * 100)`
- **Override support**: Manually set `*_PUBLIC_PORT` values are preserved (not recalculated)
- **Future-proof**: Works with any new service added to env-config.yaml

The implementation pattern can be extended to other services (KEYCLOAK, etc.) by:

## Plan Validation Report

**Date**: 2025-01-27**Plan**: `.cursor/plans/22-add_public_port_support.plan.md`**Status**: ✅ VALIDATED

### Plan Purpose

**Summary**: Add dynamic public port support for all services in docker context. Any `*_PORT` variable automatically gets a corresponding `*_PUBLIC_PORT` calculated as `basePort + (developer-id * 100)` for developer-specific host access ports while maintaining internal container ports.**Plan Type**: Development (feature addition, utility module modification)**Scope**:

- Environment configuration (env-config.yaml)
- Utility modules (lib/utils/env-map.js)
- Documentation (DEVELOPER-ISOLATION.md, CONFIGURATION.md)
- Tests (env-map.test.js, env-generation.test.js)
- CHANGELOG.md

**Key Components**:

- `lib/schema/env-config.yaml` - Schema documentation
- `lib/utils/env-map.js` - Port calculation logic
- `docs/DEVELOPER-ISOLATION.md` - Developer isolation documentation
- `docs/CONFIGURATION.md` - Configuration documentation
- `tests/lib/utils/env-map.test.js` - Unit tests
- `tests/lib/utils/env-generation.test.js` - Integration tests

### Applicable Rules

- ✅ **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Module structure, utility module patterns (applies - modifying utility module)
- ✅ **[Code Style](.cursor/rules/project-rules.mdc#code-style)** - JavaScript conventions, async/await, error handling (applies - modifying code)
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits, JSDoc documentation (MANDATORY - applies to all plans)
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, coverage ≥80% (applies - adding comprehensive tests)
- ✅ **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** - YAML validation (applies - modifying env-config.yaml)
- ✅ **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory checks before commit (MANDATORY - applies to all plans)
- ✅ **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, logging standards (applies - error handling in port calculation)
- ✅ **[Development Workflow](.cursor/rules/project-rules.mdc#development-workflow)** - Pre/during/post development, TDD approach (applies - plan includes test-first approach)
- ✅ **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - Input validation, data protection (applies - validating port values)

### Rule Compliance

- ✅ **DoD Requirements**: Documented in Definition of Done section
- Build step: `npm run build` (must run FIRST, must complete successfully)
- Lint step: `npm run lint` (must pass with zero errors/warnings)
- Test step: `npm test` or `npm run test:ci` (must run AFTER lint, all tests must pass, ≥80% coverage)
- Validation order: BUILD → LINT → TEST (mandatory sequence)
- File size limits: ≤500 lines, ≤50 lines per function
- JSDoc documentation: All public functions must have JSDoc comments
- Security: No hardcoded secrets, ISO 27001 compliance
- ✅ **Architecture Patterns**: Plan follows utility module patterns, maintains existing structure
- ✅ **Code Style**: Plan includes async/await patterns, error handling with try-catch
- ✅ **Code Quality Standards**: Plan addresses file size limits, JSDoc documentation requirements
- ✅ **Testing Conventions**: Plan includes comprehensive test cases, edge cases, ≥80% coverage requirement
- ✅ **Validation Patterns**: Plan includes YAML validation considerations
- ✅ **Error Handling**: Plan includes error handling for invalid ports, missing values
- ✅ **Security & Compliance**: Plan includes input validation, no hardcoded secrets

### Plan Updates Made

- ✅ Added **Rules and Standards** section with all applicable rule references
- ✅ Added **Before Development** checklist with prerequisites
- ✅ Added **Definition of Done** section with complete DoD requirements
- ✅ Added rule references: Architecture Patterns, Code Style, Code Quality Standards, Testing Conventions, Validation Patterns, Quality Gates, Error Handling & Logging, Development Workflow, Security & Compliance
- ✅ Documented validation order: BUILD → LINT → TEST
- ✅ Documented test coverage requirement: ≥80% for new code
- ✅ Documented JSDoc requirement for updated functions

### Recommendations

- ✅ Plan is production-ready and compliant with all applicable rules
- ✅ All mandatory sections (Rules and Standards, Before Development, Definition of Done) are present
- ✅ DoD requirements are complete and properly documented
- ✅ Test strategy is comprehensive and includes edge cases
- ✅ Documentation updates are clearly specified
- ✅ Implementation logic is well-defined with code examples
- ✅ Extensibility is properly documented

### Validation Notes

- Plan follows TDD approach (tests specified before implementation)
- Plan includes comprehensive edge case testing
- Plan maintains backward compatibility (local context unchanged)
- Plan is extensible (works for any `*_PORT` variable, not just MISO)