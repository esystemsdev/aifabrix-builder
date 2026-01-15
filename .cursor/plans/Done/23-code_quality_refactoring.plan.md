# Code Quality Refactoring Plan

## ⚠️ IMPORTANT: Architecture Reorganization Dependency

**This plan depends on [Plan 25: Architecture Reorganization](.cursor/plans/25-architecture_reorganization.plan.md).****Execution Order**:

1. **FIRST**: Execute Plan 25 (Architecture Reorganization) - Move files to new folder structure
2. **THEN**: Execute this plan (Code Quality Refactoring) - Refactor functions in reorganized structure

**Rationale**: It doesn't make sense to refactor files that will be moved. All file paths in this plan have been updated to reflect the **new structure from Plan 25**. If Plan 25 hasn't been executed yet, the file paths in this plan will not exist.**New File Structure** (from Plan 25):

- `lib/app/` - Application management files
- `lib/build/` - Build operations
- `lib/deployment/` - Deployment operations
- `lib/external-system/` - External system files
- `lib/datasource/` - Datasource files
- `lib/generator/` - Generator files
- `lib/validation/` - Validation files
- `lib/infrastructure/` - Infrastructure files
- `lib/core/` - Core utilities

## Overview

Fix 191 ESLint warnings across the codebase by refactoring functions that violate:

- **max-statements** (≤20): ~100+ functions
- **complexity** (≤10): ~80+ functions  
- **max-params** (≤5): 3 functions
- **max-depth** (≤4): 6 functions

**Note**: All file paths in this plan reflect the **new folder structure** from Plan 25. Files will be in subfolders like `lib/app/`, `lib/build/`, etc., not in `lib/` root.

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits (≤500 lines, ≤50 lines per function), code organization, documentation requirements, JSDoc comments. Applies because we're refactoring to meet file and function size limits.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory checks before commit (build, lint, test, coverage). Applies because all refactoring must pass quality gates.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Test file structure, mock patterns, test coverage (≥80%). Applies because we're updating and adding tests for refactored code.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** - JavaScript conventions, error handling, async/await patterns, input validation. Applies because refactored code must follow code style standards.
- **[Development Workflow](.cursor/rules/project-rules.mdc#development-workflow)** - Pre/during/post development steps, TDD approach. Applies because we're following development workflow for refactoring.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, logging standards. Applies because extracted helper functions must follow error handling patterns.

**Key Requirements**:

- Keep files ≤500 lines and functions ≤50 lines (extract helpers when needed)
- Add JSDoc comments for all extracted helper functions
- Use try-catch for all async operations
- Provide meaningful error messages with context
- Test files mirror source structure: `tests/lib/` mirrors `lib/`
- Ensure ≥80% test coverage for new helper functions
- Use path.join() for cross-platform paths
- Never log secrets or sensitive data
- Follow single responsibility principle when extracting functions
- Maintain backward compatibility - no breaking changes to public APIs

## Before Development

- [ ] Review Code Quality Standards section from project-rules.mdc
- [ ] Review Testing Conventions section for test structure and patterns
- [ ] Review existing code patterns for helper function extraction
- [ ] Review error handling patterns in existing code
- [ ] Understand JSDoc documentation requirements
- [ ] Review test file structure to ensure mirroring
- [ ] Review file size limits and function size limits

## Refactoring Strategy

### 1. Parameter Reduction (3 functions)

Convert functions with >5 parameters to use parameter objects:

- `lib/api/pipeline.api.js:119` - `testDatasourceViaPipeline` (6 params) - ✅ **COMPLETED** (uses parameter object)
- `lib/core/audit-logger.js:268` - `logApiCall` (6 params) - ✅ **COMPLETED** (uses parameter object)
- `lib/external-system/test.js:283` - `callPipelineTestEndpoint` (6 params) - ❌ **NOT FOUND** (may have been removed/renamed)

**Approach**: Create parameter objects like `{ controllerUrl, environment, datasourceKey, testConfig, token, options }`

### 2. Complexity Reduction (~80+ functions)

Extract helper functions to reduce cyclomatic complexity:**High Priority (complexity >15)**:

- `lib/app/run.js:37` - `runApp` (complexity: 28) → ✅ **PARTIALLY COMPLETED** (helpers extracted to `lib/app/run-helpers.js`)
- `lib/build/index.js:348` - `buildApp` (complexity: 31) → ✅ **PARTIALLY COMPLETED** (helpers extracted to `lib/utils/build-helpers.js`)
- `lib/external-system/deploy.js:211` - `deployExternalSystem` (complexity: 39) → Extract: `validateDeploymentPrerequisites`, `prepareDeploymentFiles`, `sendDeploymentRequest`, `monitorDeploymentStatus`
- `lib/utils/app-register-auth.js:57` - `checkAuthentication` (complexity: 25) → Extract: `validateTokenExpiry`, `refreshTokenIfNeeded`, `handleAuthErrors`
- `lib/commands/logout.js:71` - `handleLogout` (complexity: 25) → Extract: `clearDeviceTokens`, `clearClientTokens`, `clearConfigTokens`
- `lib/external-system/download.js:259` - `downloadExternalSystem` (complexity: 27) → Extract: `fetchExternalSystemData`, `validateDownloadedData`, `generateConfigurationFiles`, `saveDownloadedFiles`
- `lib/external-system/test.js:317` - `testExternalSystemIntegration` (complexity: 24) → Extract: `prepareTestEnvironment`, `executeTestSuite`, `processTestResults`, `displayTestOutput`
- `lib/app/rotate-secret.js:90` - `rotateSecret` (complexity: 24) → Extract: `validateRotationRequest`, `generateNewSecret`, `updateSecretReferences`, `verifyRotationSuccess`
- `lib/utils/error-formatter.js` - `formatError` (complexity: 41) → Extract: `formatHttpError`, `formatNetworkError`, `formatValidationError`, `formatPermissionError`
- `lib/utils/variable-transformer.js` - `transformFlatStructure` (complexity: 21) → Extract: `transformAppSection`, `transformBuildSection`, `transformDeploySection`
- `lib/utils/variable-transformer.js` - `validateAppOrFile` (complexity: 21) → Extract: `validateAppName`, `validateFileStructure`, `validateRequiredFields`
- `lib/generator/split.js:92` - `extractVariablesYaml` (complexity: 36) → Extract: `extractAppSection`, `extractBuildSection`, `extractDeploySection`, `extractOptionalSections`
- `lib/generator/external.js:92` - `generateExternalSystemApplicationSchema` (complexity: 30) → Extract: `buildBaseSchema`, `addFieldDefinitions`, `addValidationRules`, `addOptionalFields`
- `lib/utils/app-register-validator.js:76` - `configuration` method (complexity: 13) → Extract: `validateAppConfig`, `validateBuildConfig`, `validateDeployConfig`
- `lib/generator/helpers.js:71` - `validatePortalInput` (complexity: 23) → Extract: `validatePortalUrl`, `validatePortalCredentials`, `validatePortalConnection`
- `lib/generator/helpers.js:128` - `parseEnvironmentVariables` (complexity: 16) → Extract: `parseSingleVariable`, `parseVariableGroup`, `validateParsedVariables`
- `lib/utils/yaml-preserve.js` - `isYamlPrimitive` (complexity: 37) → Extract: `isPrimitiveType`, `isPrimitiveArray`, `isPrimitiveObject`
- `lib/utils/env-config-loader.js` - `processEnvVariables` (complexity: 40) → Extract: `processSingleVariable`, `processVariableGroup`, `applyVariableTransformations`
- `lib/utils/error-formatters/error-parser.js` - `handleDeploymentErrors` (complexity: 44) → Extract: `parseHttpError`, `parseNetworkError`, `parseValidationError`, `formatErrorResponse`

**Medium Priority (complexity 11-15)**:

- Extract helper functions for conditional logic, nested if-else chains, and switch statements
- Focus on functions with multiple early returns and nested conditionals

### 3. Statement Count Reduction (~100+ functions)

Split large functions into smaller, focused functions:**Functions with >30 statements**:

- `lib/external-system/download.js:259` - `downloadExternalSystem` (86 statements)
- `lib/build/index.js:348` - `buildApp` (66 statements) - ✅ **PARTIALLY COMPLETED** (reduced from 66)
- `lib/utils/env-config-loader.js` - `processEnvVariables` (66 statements)
- `lib/app/rotate-secret.js:90` - `rotateSecret` (61 statements)
- `lib/generator/external.js:92` - `generateExternalSystemApplicationSchema` (58 statements)
- `lib/external-system/test.js:129` - `testExternalSystem` (54 statements)
- `lib/external-system/deploy.js:211` - `deployExternalSystem` (55 statements)
- `lib/app/run.js:37` - `runApp` (50 statements) - ✅ **PARTIALLY COMPLETED** (reduced from 50)
- `lib/generator/split.js:92` - `extractVariablesYaml` (47 statements)
- `lib/external-system/test.js:317` - `testExternalSystemIntegration` (47 statements)
- `lib/app/list.js:89` - `listApplications` (44 statements)
- `lib/utils/error-formatter.js` - `formatError` (44 statements)
- `lib/datasource/deploy.js:70` - `deployDatasource` (42 statements)
- `lib/commands/logout.js:71` - `handleLogout` (40 statements)
- `lib/commands/secure.js:133` - `handleSecure` (40 statements)
- `lib/deployment/deployer.js:32` - `validateDeployment` (38 statements)
- `lib/external-system/test.js:41` - `loadExternalSystemFiles` (37 statements)
- `lib/generator/split.js:267` - `splitDeployJson` (36 statements)
- `lib/utils/env-template.js` - `adjustLocalEnvPortsInContent` (36 statements)
- `lib/cli.js:32` - `setupCommands` (34 statements)
- `lib/app/run-helpers.js:245` - `prepareEnvironment` (34 statements)
- `lib/deployment/deployer.js:135` - `sendDeploymentRequest` (34 statements)
- `lib/commands/login.js:416` - `handleLogin` (34 statements)
- `lib/utils/app-register-display.js` - `displayValidationResults` (34 statements)
- `lib/external-system/deploy.js:55` - `validateExternalSystemFiles` (33 statements)
- `lib/utils/env-template.js` - `updateEnvTemplate` (32 statements)
- `lib/commands/login.js:173` - `handleCredentialsLogin` (32 statements)
- `lib/app/run-helpers.js:136` - `validateAppConfiguration` (30 statements)
- `lib/app/index.js:284` - `createApp` (30 statements)
- `lib/utils/app-register-config.js:99` - `extractExternalIntegrationUrl` (30 statements)
- `lib/utils/app-register-config.js` - `resolveExternalFiles` (30 statements)

**Approach**:

- Extract logical sections into separate functions
- Group related operations (validation, preparation, execution, cleanup)
- Maintain single responsibility principle

### 4. Nesting Depth Reduction (6 functions)

Flatten deeply nested blocks (depth >4):

- `lib/app/list.js:122` - Extract nested conditionals into helper functions
- `lib/app/rotate-secret.js:125` - Extract nested try-catch blocks
- `lib/external-system/test.js:231` - Extract nested conditionals
- `lib/utils/app-register-auth.js:91` - Extract nested conditionals (depth: 5)
- `lib/utils/app-register-auth.js:94` - Extract nested conditionals (depth: 6)

**Approach**:

- Use early returns to reduce nesting
- Extract nested blocks into separate functions
- Use guard clauses for validation

## File-by-File Refactoring Plan

### Priority 1: Core Application Files

1. **[lib/app/run.js](lib/app/run.js) **- `runApp` (50 statements, complexity: 28) - ✅ **PARTIALLY COMPLETED**
2. **[lib/build/index.js](lib/build/index.js) **- `buildApp` (66 statements, complexity: 31) - ✅ **PARTIALLY COMPLETED**
3. **[lib/app/list.js](lib/app/list.js)** - `listApplications` (44 statements, complexity: 22), `extractApplications` (complexity: 11), max-depth: 5
4. **[lib/app/rotate-secret.js](lib/app/rotate-secret.js)** - `rotateSecret` (61 statements, complexity: 24), max-depth: 5

### Priority 2: External System Files

5. **[lib/external-system/deploy.js](lib/external-system/deploy.js)** - `deployExternalSystem` (55 statements, complexity: 39), `validateExternalSystemFiles` (33 statements, complexity: 14), `buildExternalSystem` (32 statements, complexity: 12)
6. **[lib/external-system/download.js](lib/external-system/download.js)** - `downloadExternalSystem` (86 statements, complexity: 27), `generateEnvTemplate` (25 statements, complexity: 19), `validateDownloadedData` (complexity: 12)
7. **[lib/external-system/test.js](lib/external-system/test.js)** - `testExternalSystemIntegration` (47 statements, complexity: 24), `testExternalSystem` (54 statements, complexity: 20), `loadExternalSystemFiles` (37 statements, complexity: 15), `callPipelineTestEndpoint` (6 params), max-depth: 5

### Priority 3: Generator Files

8. **[lib/generator/external.js](lib/generator/external.js)** - `generateExternalSystemApplicationSchema` (58 statements, complexity: 30), `generateExternalSystemDeployJson` (24 statements, complexity: 16)
9. **[lib/generator/split.js](lib/generator/split.js)** - `extractVariablesYaml` (47 statements, complexity: 36), `extractRbacYaml` (complexity: 11), `splitDeployJson` (36 statements)
10. **[lib/generator/builders.js](lib/generator/builders.js)** - `buildBaseDeployment` (complexity: 14), `buildOptionalFields` (27 statements, complexity: 15)
11. **[lib/generator/helpers.js](lib/generator/helpers.js)** - `validatePortalInput` (22 statements, complexity: 23), `parseEnvironmentVariables` (32 statements, complexity: 16)

### Priority 4: Command Files

12. **[lib/commands/login.js](lib/commands/login.js)** - `handleLogin` (34 statements, complexity: 11), `handleCredentialsLogin` (32 statements, complexity: 15), `handleDeviceCodeLogin` (27 statements, complexity: 17)
13. **[lib/commands/logout.js](lib/commands/logout.js)** - `handleLogout` (40 statements, complexity: 25)
14. **[lib/commands/secure.js](lib/commands/secure.js)** - `handleSecure` (40 statements)
15. **[lib/commands/secrets-set.js](lib/commands/secrets-set.js)** - `handleSecretsSet` (complexity: 11)

### Priority 5: Utility Files

16. **[lib/utils/error-formatter.js](lib/utils/error-formatter.js)** - `formatError` (44 statements, complexity: 41), `formatNetworkError` (24 statements, complexity: 19), `formatAuthenticationError` (26 statements, complexity: 14)
17. **[lib/utils/variable-transformer.js](lib/utils/variable-transformer.js)** - `transformFlatStructure` (complexity: 21), `validateAppOrFile` (48 statements, complexity: 21), `transformOptionalFields` (32 statements, complexity: 18), `transformVariablesForValidation` (complexity: 18)
18. **[lib/utils/env-config-loader.js](lib/utils/env-config-loader.js)** - `processEnvVariables` (66 statements, complexity: 40)
19. **[lib/utils/yaml-preserve.js](lib/utils/yaml-preserve.js)** - `isYamlPrimitive` (complexity: 37)
20. **[lib/utils/app-register-auth.js](lib/utils/app-register-auth.js)** - `checkAuthentication` (35 statements, complexity: 25), max-depth: 5, 6
21. **[lib/utils/app-register-validator.js](lib/utils/app-register-validator.js)** - `configuration` method (complexity: 13)
22. **[lib/utils/app-register-config.js](lib/utils/app-register-config.js)** - `extractExternalIntegrationUrl` (21 statements, complexity: 12), `extractAppConfiguration` (complexity: 12), `resolveExternalFiles` (30 statements, complexity: 14)
23. **[lib/utils/app-register-display.js](lib/utils/app-register-display.js)** - `getEnvironmentPrefix` (complexity: 11)
24. **[lib/utils/app-register-api.js](lib/utils/app-register-api.js)** - `callRegisterApi` (26 statements, complexity: 11)

### Priority 6: API Files

25. **[lib/api/pipeline.api.js](lib/api/pipeline.api.js) **- `testDatasourceViaPipeline` (6 params) - ✅ **COMPLETED** (uses parameter object)

### Priority 7: Other Files

26. **[lib/core/audit-logger.js](lib/core/audit-logger.js) **- `logApiCall` (6 params, complexity: 11) - ✅ **COMPLETED** (uses parameter object)
27. **[lib/deployment/deployer.js](lib/deployment/deployer.js)** - `validateDeployment` (38 statements, complexity: 19), `sendDeploymentRequest` (34 statements, complexity: 17), `pollDeploymentStatus` (24 statements, complexity: 17)
28. **[lib/deployment/environment.js](lib/deployment/environment.js)** - `deployEnvironment` (27 statements, complexity: 12), `pollEnvironmentStatus` (23 statements, complexity: 18), `sendEnvironmentDeployment` (complexity: 12)
29. **[lib/datasource/deploy.js](lib/datasource/deploy.js)** - `deployDatasource` (42 statements, complexity: 13)
30. **[lib/datasource/list.js](lib/datasource/list.js)** - `listDatasources` (26 statements), `extractDatasources` (complexity: 13)
31. **[lib/core/diff.js](lib/core/diff.js)** - `compareFiles` (24 statements, complexity: 14), `compareObjects` (complexity: 17), `formatDiffOutput` (24 statements)
32. **[lib/app/run-helpers.js](lib/app/run-helpers.js)** - `validateAppConfiguration` (30 statements, complexity: 16), `prepareEnvironment` (34 statements, complexity: 13), `startContainer` (29 statements), `checkContainerRunning` (21 statements)
33. **[lib/app/index.js](lib/app/index.js)** - `createApp` (30 statements), `displaySuccessMessage` (26 statements)
34. **[lib/app/deploy.js](lib/app/deploy.js)** - `loadDeploymentConfig` (22 statements)
35. **[lib/app/prompts.js](lib/app/prompts.js)** - `resolveConflicts` (complexity: 13)
36. **[lib/app/readme.js](lib/app/readme.js)** - `generateReadmeMd` (complexity: 14)
37. **[lib/cli.js](lib/cli.js)** - `setupCommands` (34 statements)
38. **[lib/core/config.js](lib/core/config.js)** - `getConfig` (26 statements, complexity: 18), `setDeveloperId` (21 statements)
39. **[lib/generator/index.js](lib/generator/index.js)** - `generateDeployJson` (23 statements)
40. **[lib/generator/github.js](lib/generator/github.js)** - `getTemplateContext` (complexity: 14), `validateWorkflowConfig` (complexity: 13)
41. **[lib/infrastructure/index.js](lib/infrastructure/index.js)** - `startInfra` (45 statements, complexity: 11), arrow functions (complexity: 11)
42. **[lib/deployment/push.js](lib/deployment/push.js)** - `parseRegistryUrl` (complexity: 11)
43. **[lib/core/secrets.js](lib/core/secrets.js)** - `updatePortForDocker` (24 statements, complexity: 18)
44. **[lib/core/templates.js](lib/core/templates.js)** - `generateVariablesYaml` (24 statements, complexity: 15)
45. **[lib/utils/error-formatters/error-parser.js](lib/utils/error-formatters/error-parser.js)** - `handleDeploymentErrors` (42 statements, complexity: 44)

## Test Strategy

### 1. Update Existing Tests

- Update test files to match refactored function signatures
- Update mocks for extracted helper functions
- Ensure test coverage remains ≥80%

### 2. Add Tests for New Helper Functions

- Create unit tests for all extracted helper functions
- Test files should mirror source structure: `tests/lib/` mirrors `lib/`
- Follow existing test patterns and naming conventions

### 3. Test Files to Update/Add

- Update existing test files for refactored modules
- Add new test files for extracted helper functions (e.g., `app-run-helpers.test.js` for new helpers in `app-run.js`)
- Ensure all helper functions have corresponding tests

## Implementation Guidelines

### Code Extraction Patterns

1. **Extract Validation Logic**:
```javascript
// Before: Inline validation
async function myFunction(params) {
  if (!params.x) throw new Error('x required');
  if (!params.y) throw new Error('y required');
  // ... rest of function
}

// After: Extracted validation
function validateParams(params) {
  if (!params.x) throw new Error('x required');
  if (!params.y) throw new Error('y required');
}

async function myFunction(params) {
  validateParams(params);
  // ... rest of function
}
```




2. **Extract Complex Conditionals**:
```javascript
// Before: Complex nested conditionals
function processData(data) {
  if (data.type === 'A') {
    if (data.status === 'active') {
      if (data.value > 10) {
        // ... complex logic
      }
    }
  }
}

// After: Extracted helpers
function shouldProcessTypeA(data) {
  return data.type === 'A' && data.status === 'active' && data.value > 10;
}

function processData(data) {
  if (shouldProcessTypeA(data)) {
    // ... complex logic
  }
}
```




3. **Parameter Objects**:
```javascript
// Before: Many parameters
async function myFunction(url, env, key, config, token, options) {
  // ...
}

// After: Parameter object
async function myFunction({ url, environment, key, config, token, options }) {
  // ...
}
```




4. **Flatten Nesting**:
```javascript
// Before: Deep nesting
function process(data) {
  if (data) {
    if (data.items) {
      if (data.items.length > 0) {
        // ... process items
      }
    }
  }
}

// After: Early returns
function process(data) {
  if (!data || !data.items || data.items.length === 0) {
    return;
  }
  // ... process items
}
```




## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs lint + test:ci)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings - all 191 warnings resolved)
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass, ≥80% coverage for new helper functions)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, functions ≤50 lines (all extracted helpers must comply)
6. **JSDoc Documentation**: All extracted helper functions have JSDoc comments with parameter types and return types
7. **Code Quality**: All ESLint warnings resolved (0 warnings), code follows existing patterns
8. **Security**: No hardcoded secrets, ISO 27001 compliance maintained
9. **Test Coverage**: ≥80% coverage for all new helper functions
10. **Test Structure**: Test files mirror source structure (`tests/lib/` mirrors `lib/`)
11. **Backward Compatibility**: No breaking changes to public APIs, all existing tests pass
12. **All Tasks Completed**: All refactoring tasks completed and validated

## Execution Order

**⚠️ PREREQUISITE**: Execute [Plan 25: Architecture Reorganization](.cursor/plans/25-architecture_reorganization.plan.md) **FIRST** before starting this plan. All file paths in this plan assume the new folder structure from Plan 25.

1. **Phase 0**: Verify Plan 25 is complete - All files moved to new structure (`lib/app/`, `lib/build/`, `lib/deployment/`, etc.)
2. **Phase 1**: Fix max-params violations (3 functions) - Quick wins - ✅ **2/3 COMPLETED**
3. **Phase 2**: Fix max-depth violations (6 functions) - Reduce nesting
4. **Phase 3**: Refactor high-complexity functions (>15) - Biggest impact - ⚠️ **PARTIAL** (some helpers extracted)
5. **Phase 4**: Refactor high-statement-count functions (>40) - Large functions - ⚠️ **PARTIAL** (some functions refactored)
6. **Phase 5**: Refactor remaining functions (11-15 complexity, 21-40 statements)
7. **Phase 6**: Update and add tests for all refactored code
8. **Phase 7**: Final validation - run lint, tests, coverage

## Notes

- **CRITICAL**: This plan assumes Plan 25 (Architecture Reorganization) has been completed. All file paths reference the new folder structure.
- Maintain backward compatibility - no breaking changes to public APIs
- Preserve all existing functionality - refactoring only, no feature changes
- Follow existing code style and patterns
- Update JSDoc comments for all extracted functions
- If Plan 25 hasn't been executed, file paths in this plan will not exist. Execute Plan 25 first.

## Plan Validation Report

**Date**: 2024-12-19**Plan**: `.cursor/plans/23-code_quality_refactoring.plan.md`**Status**: ✅ VALIDATED

### Plan Purpose

This plan refactors the codebase to fix 191 ESLint warnings (max-statements, complexity, max-params, max-depth) by extracting helper functions, using parameter objects, and flattening nested blocks. The plan updates and adds tests to mirror the refactored code structure. No logic changes - only code quality improvements.**Plan Type**: Refactoring (code improvements, restructuring)**Affected Areas**:

- Core application files (app-run.js, build.js, app-list.js, app-rotate-secret.js)
- External system files (external-system-deploy.js, external-system-download.js, external-system-test.js)
- Generator files (generator-external.js, generator-split.js, generator-builders.js, generator-helpers.js)
- Command files (login.js, logout.js, secure.js, secrets-set.js)
- Utility files (error-formatter.js, variable-transformer.js, env-config-loader.js, yaml-preserve.js, app-register-*.js)
- API files (pipeline.api.js)
- Other files (audit-logger.js, deployer.js, environment-deploy.js, datasource-*.js, diff.js, app-run-helpers.js, app.js, config.js, etc.)

### Applicable Rules

- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits, code organization, documentation requirements, JSDoc comments
- ✅ **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory checks before commit (build, lint, test, coverage)
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Test file structure, mock patterns, test coverage (≥80%)
- ✅ **[Code Style](.cursor/rules/project-rules.mdc#code-style)** - JavaScript conventions, error handling, async/await patterns
- ✅ **[Development Workflow](.cursor/rules/project-rules.mdc#development-workflow)** - Pre/during/post development steps
- ✅ **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, logging standards

### Rule Compliance

- ✅ DoD Requirements: Documented with BUILD → LINT → TEST validation order
- ✅ Code Quality Standards: File size limits (≤500 lines, ≤50 lines per function) documented
- ✅ Testing Conventions: Test structure mirroring and coverage requirements documented
- ✅ Code Style: Error handling and async/await patterns documented in implementation guidelines
- ✅ Quality Gates: All mandatory checks (build, lint, test, coverage) documented
- ✅ JSDoc Documentation: Requirement for all extracted helper functions documented

### Plan Updates Made

- ✅ Added Rules and Standards section with links to applicable rule sections
- ✅ Added Before Development checklist with rule compliance items
- ✅ Updated Definition of Done section with mandatory BUILD → LINT → TEST validation order
- ✅ Added explicit requirements for file size limits, JSDoc documentation, and test coverage
- ✅ Added rule references: Code Quality Standards, Quality Gates, Testing Conventions, Code Style, Development Workflow, Error Handling & Logging

### Recommendations

- ✅ Plan is production-ready with all DoD requirements documented
- ✅ All applicable rules referenced with explanations
- ✅ Validation order explicitly documented (BUILD → LINT → TEST)

## Implementation Validation Report

**Date**: 2024-12-19**Plan**: `.cursor/plans/23-code_quality_refactoring.plan.md`**Status**: ⚠️ INCOMPLETE

### Executive Summary

The code quality refactoring plan has been partially implemented. Significant progress has been made with parameter object conversions and helper function extraction, but the plan is **not complete**. The goal was to fix 191 ESLint warnings, but **154 problems remain** (1 error, 150 warnings). All tests pass, but linting requirements are not met.**Completion Status**: ~20% complete

- ✅ Parameter objects: 2/3 functions refactored
- ⚠️ Complexity reduction: Partial (some helpers extracted)
- ⚠️ Statement count reduction: Partial (some functions refactored)
- ❌ Nesting depth reduction: Not verified
- ❌ All ESLint warnings resolved: **NOT MET** (150 warnings remain)

### Task Completion

**Total tasks in "Before Development" section**: 7**Completed**: 0**Incomplete**: 7**Completion**: 0%

#### Incomplete Tasks

- [ ] Review Code Quality Standards section from project-rules.mdc
- [ ] Review Testing Conventions section for test structure and patterns
- [ ] Review existing code patterns for helper function extraction
- [ ] Review error handling patterns in existing code
- [ ] Understand JSDoc documentation requirements
- [ ] Review test file structure to ensure mirroring
- [ ] Review file size limits and function size limits

**Note**: These are pre-development tasks. The actual refactoring work has been partially completed despite these tasks not being checked off.

### File Existence Validation

✅ **All mentioned files exist**:

- `lib/app-run.js` - ✅ Exists (213 lines)
- `lib/build.js` - ✅ Exists (408 lines)
- `lib/app-list.js` - ✅ Exists
- `lib/app-rotate-secret.js` - ✅ Exists
- `lib/external-system-deploy.js` - ✅ Exists
- `lib/external-system-download.js` - ✅ Exists (496 lines)
- `lib/external-system-test.js` - ✅ Exists (478 lines)
- `lib/api/pipeline.api.js` - ✅ Exists
- `lib/audit-logger.js` - ✅ Exists
- All other mentioned files exist

✅ **Helper files created**:

- `lib/app-run-helpers.js` - ✅ Created (413 lines)
- `lib/utils/build-helpers.js` - ✅ Created
- `lib/utils/app-run-containers.js` - ✅ Created

### Refactoring Progress Validation

#### 1. Parameter Reduction (3 functions)

**Status**: ⚠️ PARTIAL (2/3 complete)✅ **Completed**:

- `lib/api/pipeline.api.js:120` - `testDatasourceViaPipeline` - ✅ **REFACTORED** (now uses parameter object)
- `lib/audit-logger.js:269` - `logApiCall` - ✅ **REFACTORED** (now uses parameter object)

❌ **Not Completed**:

- `lib/external-system-test.js:283` - `callPipelineTestEndpoint` - ❌ **NOT FOUND** (function may have been removed or renamed)

#### 2. Complexity Reduction (~80+ functions)

**Status**: ⚠️ PARTIAL✅ **Progress Made**:

- `lib/app-run.js` - `runApp` - ✅ **REFACTORED** (helpers extracted to `app-run-helpers.js`)
- Extracted: `validateAppForRun`, `checkAndStopContainer`, `calculateHostPort`, `loadAndConfigureApp`, `startAppContainer`
- `lib/build.js` - `buildApp` - ✅ **REFACTORED** (helpers extracted to `build-helpers.js`)
- Extracted: `checkExternalAppType`, `prepareDevDirectory`, `prepareBuildContext`, `handleDockerfileGeneration`

❌ **Still Violating Complexity Rules** (from current lint output):

- `lib/app-readme.js:74` - `generateReadmeMd` (complexity: 14)
- `lib/app-run.js:81` - `calculateHostPort` (complexity: 11)
- `lib/audit-logger.js:269` - `logApiCall` (complexity: 11)
- `lib/build.js:271` - `prepareBuildContext` (complexity: 11)
- `lib/commands/login.js:173` - `handleCredentialsLogin` (complexity: 15)
- `lib/commands/login.js:430` - `handleLogin` (complexity: 11)
- `lib/commands/logout.js:98` - `clearClientTokens` (complexity: 11)
- `lib/commands/secrets-set.js:36` - `handleSecretsSet` (complexity: 11)
- `lib/commands/wizard.js:50` - `handleWizard` (complexity: 46) - **CRITICAL**
- `lib/datasource-list.js:27` - `extractDatasources` (complexity: 13)
- `lib/deployer.js:245` - `processDeploymentStatusResponse` (complexity: 12)
- `lib/diff.js:86` - `compareObjects` (complexity: 13)
- `lib/diff.js:173` - `compareFiles` (complexity: 14)
- `lib/environment-deploy.js:79` - `sendEnvironmentDeployment` (complexity: 12)
- `lib/environment-deploy.js:136` - `processEnvironmentStatusResponse` (complexity: 11)
- `lib/environment-deploy.js:244` - `deployEnvironment` (complexity: 12)
- `lib/external-system-deploy.js:55` - `validateExternalSystemFiles` (complexity: 14)
- `lib/external-system-deploy.js:137` - `buildExternalSystem` (complexity: 12)
- `lib/external-system-deploy.js:271` - `validateUpload` (complexity: 15)
- `lib/external-system-download.js:52` - `validateDownloadedData` (complexity: 12)
- `lib/external-system-test.js:42` - `loadExternalSystemFiles` (complexity: 15)
- `lib/generator-builders.js:119` - `buildBaseDeployment` (complexity: 14)
- `lib/generator-builders.js:243` - `buildOptionalFields` (complexity: 15)
- `lib/generator-external.js:27` - `generateExternalSystemDeployJson` (complexity: 16)
- `lib/generator-helpers.js:160` - `parseEnvironmentVariables` (complexity: 16)
- `lib/validator.js:38` - `validateVariables` (complexity: 16)
- `lib/wizard-generator.js:152` - `generateEnvTemplate` (complexity: 17)

**Many more functions still need refactoring** (80+ functions mentioned in plan)

#### 3. Statement Count Reduction (~100+ functions)

**Status**: ⚠️ PARTIAL✅ **Progress Made**:

- `lib/app-run.js` - `runApp` - ✅ **REFACTORED** (reduced from 50 statements)
- `lib/build.js` - `buildApp` - ✅ **REFACTORED** (reduced from 66 statements)

❌ **Still Violating Statement Count Rules** (from current lint output):

- `lib/app.js:35` - `displaySuccessMessage` (26 statements)
- `lib/app.js:284` - `createApp` (30 statements)
- `lib/build.js:227` - `prepareDevDirectory` (25 statements)
- `lib/cli.js:32` - `setupCommands` (35 statements)
- `lib/commands/login.js:173` - `handleCredentialsLogin` (32 statements)
- `lib/commands/login.js:430` - `handleLogin` (34 statements)
- `lib/commands/wizard.js:50` - `handleWizard` (125 statements) - **CRITICAL**
- `lib/config.js:207` - `setDeveloperId` (21 statements)
- `lib/datasource-list.js:94` - `listDatasources` (26 statements)
- `lib/diff.js:173` - `compareFiles` (24 statements)
- `lib/diff.js:245` - `formatDiffOutput` (24 statements)
- `lib/environment-deploy.js:244` - `deployEnvironment` (27 statements)
- `lib/external-system-deploy.js:55` - `validateExternalSystemFiles` (33 statements)
- `lib/external-system-deploy.js:137` - `buildExternalSystem` (32 statements)
- `lib/external-system-download.js:267` - `generateFilesInTempDir` (25 statements)
- `lib/external-system-test.js:42` - `loadExternalSystemFiles` (37 statements)
- `lib/external-system-test.js:268` - `testExternalSystem` (21 statements)
- `lib/external-system-test.js:388` - `testExternalSystemIntegration` (31 statements)
- `lib/generator-builders.js:243` - `buildOptionalFields` (27 statements)
- `lib/generator-external.js:27` - `generateExternalSystemDeployJson` (24 statements)
- `lib/generator-external.js:245` - `generateExternalSystemApplicationSchema` (24 statements)
- `lib/generator-helpers.js:160` - `parseEnvironmentVariables` (32 statements)
- `lib/generator-split.js:146` - `extractOptionalSections` (24 statements)
- `lib/validator.js:38` - `validateVariables` (31 statements)
- `lib/wizard-generator.js:25` - `generateWizardFiles` (25 statements)
- `lib/wizard-generator.js:152` - `generateEnvTemplate` (31 statements)

**Many more functions still need refactoring** (100+ functions mentioned in plan)

#### 4. Nesting Depth Reduction (6 functions)

**Status**: ❌ NOT VERIFIEDFunctions mentioned for nesting depth reduction:

- `lib/app-list.js:122` - Not verified
- `lib/app-rotate-secret.js:125` - Not verified
- `lib/external-system-test.js:231` - Not verified
- `lib/utils/app-register-auth.js:91` - Not verified
- `lib/utils/app-register-auth.js:94` - Not verified

**Note**: Nesting depth violations are not currently reported by ESLint, so these may have been fixed or may not be detected by current lint rules.

### Code Quality Validation

#### STEP 1 - FORMAT

✅ **Status**: PASSED (auto-fixable issues fixed)**Command**: `npm run lint:fix`**Result**: Some auto-fixable issues were fixed (13 errors and 0 warnings fixable)

#### STEP 2 - LINT

❌ **Status**: FAILED (154 problems remain)**Command**: `npm run lint`**Result**:

- **Total Problems**: 154
- **Errors**: 1
- **Warnings**: 150

**Critical Issues**:

1. **Error**: `lib/commands/wizard.js:22` - `testMcpConnection` is assigned but never used (no-unused-vars)
2. **Error**: Multiple quote style violations in `lib/commands/wizard.js` and `lib/utils/error-formatters/` files
3. **Error**: Trailing spaces in `lib/utils/error-formatters/http-status-errors.js`

**Warning Summary**:

- **max-statements violations**: ~30+ functions
- **complexity violations**: ~40+ functions
- **max-params violations**: 1 function (`lib/wizard-generator.js:94` - `generateOrUpdateVariablesYaml` has 6 params)
- **no-console violations**: 6 instances in `lib/wizard-prompts.js`

**Goal**: Fix 191 ESLint warnings**Current**: 150 warnings remain**Progress**: ~21% reduction (41 warnings fixed, 150 remain)

#### STEP 3 - TEST

✅ **Status**: PASSED**Command**: `npm test`**Result**:

- **Test Suites**: 137 passed, 137 total
- **Tests**: 3079 passed, 30 skipped, 3109 total
- **Time**: 8.191s
- **Status**: ✅ ALL TESTS PASSED

**Test Coverage**: Not explicitly checked, but all tests pass

### File Size Validation

❌ **Status**: SOME FILES EXCEED LIMITS**Files exceeding 500 lines** (limit: ≤500 lines):

- `lib/cli.js`: 692 lines ❌
- `lib/templates.js`: 498 lines ⚠️ (close to limit)
- `lib/external-system-download.js`: 496 lines ⚠️ (close to limit)
- `lib/commands/login.js`: 484 lines ⚠️ (close to limit)
- `lib/external-system-test.js`: 478 lines ⚠️ (close to limit)
- `lib/infra.js`: 469 lines ⚠️ (close to limit)
- `lib/app.js`: 467 lines ⚠️ (close to limit)
- `lib/app-prompts.js`: 459 lines ⚠️ (close to limit)
- `lib/secrets.js`: 443 lines ✅
- `lib/utils/device-code.js`: 442 lines ✅
- `lib/deployer.js`: 441 lines ✅
- `lib/app-deploy.js`: 432 lines ✅
- `lib/utils/paths.js`: 428 lines ✅
- `lib/utils/token-manager.js`: 420 lines ✅
- `lib/app-run-helpers.js`: 413 lines ✅
- `lib/utils/secrets-helpers.js`: 412 lines ✅
- `lib/build.js`: 408 lines ✅

**Critical**: `lib/cli.js` significantly exceeds the 500-line limit (692 lines)

### Cursor Rules Compliance

✅ **Code reuse**: PASSED (helper functions extracted)✅ **Error handling**: PASSED (try-catch patterns maintained)⚠️ **Logging**: PARTIAL (6 console.log violations in wizard-prompts.js)✅ **Type safety**: PASSED (JSDoc comments present in extracted helpers)✅ **Async patterns**: PASSED (async/await used correctly)✅ **File operations**: PASSED (path.join used, fs.promises used)✅ **Input validation**: PASSED (validation functions present)✅ **Module patterns**: PASSED (CommonJS exports correct)✅ **Security**: PASSED (no hardcoded secrets found)

### Implementation Completeness

❌ **Database schema**: N/A (not applicable for this refactoring plan)✅ **Services**: PARTIAL (some refactored, many remain)✅ **API endpoints**: N/A (not applicable)✅ **Schemas**: N/A (not applicable)✅ **Migrations**: N/A (not applicable)⚠️ **Documentation**: PARTIAL (JSDoc added to extracted helpers, but many functions still need documentation)

### Issues and Recommendations

#### Critical Issues

1. **Lint Errors Must Be Fixed**:

- Fix unused variable `testMcpConnection` in `lib/commands/wizard.js:22`
- Fix quote style violations (use single quotes)
- Fix trailing spaces

2. **High-Complexity Functions**:

- `lib/commands/wizard.js:50` - `handleWizard` (complexity: 46, 125 statements) - **CRITICAL PRIORITY**
- This function needs immediate refactoring

3. **File Size Violations**:

- `lib/cli.js` (692 lines) significantly exceeds 500-line limit
- Consider splitting into multiple files

#### High Priority Recommendations

1. **Complete Parameter Object Refactoring**:

- Find and refactor `callPipelineTestEndpoint` in `lib/external-system-test.js` (if it still exists)

2. **Continue Complexity Reduction**:

- Focus on functions with complexity >15 first
- Extract helper functions for nested conditionals
- Use early returns to reduce nesting

3. **Continue Statement Count Reduction**:

- Focus on functions with >30 statements
- Extract logical sections into separate functions
- Group related operations

4. **Fix Console.log Violations**:

- Replace 6 console.log statements in `lib/wizard-prompts.js` with logger utility

5. **Complete "Before Development" Tasks**:

- Mark pre-development tasks as complete or remove them if not needed

#### Medium Priority Recommendations

1. **File Size Management**:

- Split `lib/cli.js` into smaller modules
- Consider splitting other files approaching 500 lines

2. **Test Coverage**:

- Verify test coverage for extracted helper functions
- Add tests for new helper functions if missing

3. **Documentation**:

- Ensure all extracted helper functions have JSDoc comments
- Verify parameter types and return types are documented

### Final Validation Checklist

- [ ] All tasks completed
- [x] All files exist
- [x] Tests exist and pass
- [ ] Code quality validation passes (❌ 154 problems remain)
- [x] Cursor rules compliance verified (⚠️ minor issues)
- [ ] Implementation complete (❌ ~20% complete)

### Next Steps

1. **Immediate Actions**:

- Fix 1 lint error (unused variable, quote styles, trailing spaces)
- Refactor `handleWizard` function (complexity: 46, 125 statements)
- Continue refactoring high-complexity functions (>15)

2. **Short-term Goals**:

- Reduce warnings from 150 to <50
- Complete parameter object refactoring (find `callPipelineTestEndpoint`)
- Split `lib/cli.js` to meet file size limits

3. **Long-term Goals**:

- Complete all complexity reductions
- Complete all statement count reductions
- Achieve zero ESLint warnings
- Meet all file size limits

### Conclusion

The code quality refactoring plan has made **significant progress** with parameter object conversions and helper function extraction, but is **not complete**. The primary blocker is the **150 remaining ESLint warnings** and **1 lint error**. All tests pass, indicating backward compatibility is maintained. The plan requires continued refactoring work to achieve the goal of fixing all 191 ESLint warnings.**Recommendation**: Continue refactoring work, focusing on high-complexity functions and statement count violations. Fix lint errors immediately, then systematically work through remaining warnings.---

## Plan Update: Architecture Reorganization Integration

**Date**: 2024-12-19**Update**: Plan 23 has been updated to reflect the new folder structure from Plan 25 (Architecture Reorganization).

### Changes Made

1. **Added Dependency Notice**: Clear warning at the top that Plan 25 must be executed first
2. **Updated All File Paths**: All file references updated to use new folder structure:

- `lib/app-run.js` → `lib/app/run.js`
- `lib/build.js` → `lib/build/index.js`
- `lib/external-system-deploy.js` → `lib/external-system/deploy.js`
- `lib/audit-logger.js` → `lib/core/audit-logger.js`
- `lib/deployer.js` → `lib/deployment/deployer.js`
- And all other file paths updated accordingly

3. **Updated Execution Order**: Added Phase 0 to verify Plan 25 completion
4. **Updated Status Markers**: Marked completed items and noted partial progress

### Current Status

- **Plan 25 Status**: ⚠️ NOT EXECUTED (files still in old structure)
- **Plan 23 Status**: ⚠️ READY (updated for new structure, but cannot execute until Plan 25 is complete)
- **Recommendation**: Execute Plan 25 first, then resume Plan 23 refactoring work

### Next Steps

1. Execute Plan 25 (Architecture Reorganization) to move files to new structure