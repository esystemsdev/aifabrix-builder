# Code Quality Refactoring Plan

## Overview

Fix 191 ESLint warnings across the codebase by refactoring functions that violate:

- **max-statements** (≤20): ~100+ functions
- **complexity** (≤10): ~80+ functions  
- **max-params** (≤5): 3 functions
- **max-depth** (≤4): 6 functions

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

- `lib/api/pipeline.api.js:119` - `testDatasourceViaPipeline` (6 params)
- `lib/audit-logger.js:268` - `logApiCall` (6 params)
- `lib/external-system-test.js:283` - `callPipelineTestEndpoint` (6 params)

**Approach**: Create parameter objects like `{ controllerUrl, environment, datasourceKey, testConfig, token, options }`

### 2. Complexity Reduction (~80+ functions)

Extract helper functions to reduce cyclomatic complexity:**High Priority (complexity >15)**:

- `lib/app-run.js:37` - `runApp` (complexity: 28) → Extract: `validateAppForRun`, `checkAndStopContainer`, `calculateHostPort`, `prepareRunEnvironment`
- `lib/build.js:348` - `buildApp` (complexity: 31) → Extract: `checkExternalAppType`, `loadBuildConfiguration`, `prepareBuildContext`, `handleDockerfileGeneration`, `executeDockerBuild`
- `lib/external-system-deploy.js:211` - `deployExternalSystem` (complexity: 39) → Extract: `validateDeploymentPrerequisites`, `prepareDeploymentFiles`, `sendDeploymentRequest`, `monitorDeploymentStatus`
- `lib/utils/app-register-auth.js:57` - `checkAuthentication` (complexity: 25) → Extract: `validateTokenExpiry`, `refreshTokenIfNeeded`, `handleAuthErrors`
- `lib/commands/logout.js:71` - `handleLogout` (complexity: 25) → Extract: `clearDeviceTokens`, `clearClientTokens`, `clearConfigTokens`
- `lib/external-system-download.js:259` - `downloadExternalSystem` (complexity: 27) → Extract: `fetchExternalSystemData`, `validateDownloadedData`, `generateConfigurationFiles`, `saveDownloadedFiles`
- `lib/external-system-test.js:317` - `testExternalSystemIntegration` (complexity: 24) → Extract: `prepareTestEnvironment`, `executeTestSuite`, `processTestResults`, `displayTestOutput`
- `lib/app-rotate-secret.js:90` - `rotateSecret` (complexity: 24) → Extract: `validateRotationRequest`, `generateNewSecret`, `updateSecretReferences`, `verifyRotationSuccess`
- `lib/utils/error-formatter.js` - `formatError` (complexity: 41) → Extract: `formatHttpError`, `formatNetworkError`, `formatValidationError`, `formatPermissionError`
- `lib/utils/variable-transformer.js` - `transformFlatStructure` (complexity: 21) → Extract: `transformAppSection`, `transformBuildSection`, `transformDeploySection`
- `lib/utils/variable-transformer.js` - `validateAppOrFile` (complexity: 21) → Extract: `validateAppName`, `validateFileStructure`, `validateRequiredFields`
- `lib/generator-split.js:92` - `extractVariablesYaml` (complexity: 36) → Extract: `extractAppSection`, `extractBuildSection`, `extractDeploySection`, `extractOptionalSections`
- `lib/generator-external.js:92` - `generateExternalSystemApplicationSchema` (complexity: 30) → Extract: `buildBaseSchema`, `addFieldDefinitions`, `addValidationRules`, `addOptionalFields`
- `lib/utils/app-register-validator.js:76` - `configuration` method (complexity: 13) → Extract: `validateAppConfig`, `validateBuildConfig`, `validateDeployConfig`
- `lib/utils/generator-helpers.js:71` - `validatePortalInput` (complexity: 23) → Extract: `validatePortalUrl`, `validatePortalCredentials`, `validatePortalConnection`
- `lib/utils/generator-helpers.js:128` - `parseEnvironmentVariables` (complexity: 16) → Extract: `parseSingleVariable`, `parseVariableGroup`, `validateParsedVariables`
- `lib/utils/yaml-preserve.js` - `isYamlPrimitive` (complexity: 37) → Extract: `isPrimitiveType`, `isPrimitiveArray`, `isPrimitiveObject`
- `lib/utils/env-config-loader.js` - `processEnvVariables` (complexity: 40) → Extract: `processSingleVariable`, `processVariableGroup`, `applyVariableTransformations`
- `lib/utils/error-formatters/error-parser.js` - `handleDeploymentErrors` (complexity: 44) → Extract: `parseHttpError`, `parseNetworkError`, `parseValidationError`, `formatErrorResponse`

**Medium Priority (complexity 11-15)**:

- Extract helper functions for conditional logic, nested if-else chains, and switch statements
- Focus on functions with multiple early returns and nested conditionals

### 3. Statement Count Reduction (~100+ functions)

Split large functions into smaller, focused functions:**Functions with >30 statements**:

- `lib/external-system-download.js:259` - `downloadExternalSystem` (86 statements)
- `lib/build.js:348` - `buildApp` (66 statements)
- `lib/utils/env-config-loader.js` - `processEnvVariables` (66 statements)
- `lib/app-rotate-secret.js:90` - `rotateSecret` (61 statements)
- `lib/generator-external.js:92` - `generateExternalSystemApplicationSchema` (58 statements)
- `lib/external-system-test.js:129` - `testExternalSystem` (54 statements)
- `lib/external-system-deploy.js:211` - `deployExternalSystem` (55 statements)
- `lib/app-run.js:37` - `runApp` (50 statements)
- `lib/generator-split.js:92` - `extractVariablesYaml` (47 statements)
- `lib/external-system-test.js:317` - `testExternalSystemIntegration` (47 statements)
- `lib/app-list.js:89` - `listApplications` (44 statements)
- `lib/utils/error-formatter.js` - `formatError` (44 statements)
- `lib/datasource-deploy.js:70` - `deployDatasource` (42 statements)
- `lib/commands/logout.js:71` - `handleLogout` (40 statements)
- `lib/commands/secure.js:133` - `handleSecure` (40 statements)
- `lib/deployer.js:32` - `validateDeployment` (38 statements)
- `lib/external-system-test.js:41` - `loadExternalSystemFiles` (37 statements)
- `lib/generator-split.js:267` - `splitDeployJson` (36 statements)
- `lib/utils/env-template.js` - `adjustLocalEnvPortsInContent` (36 statements)
- `lib/cli.js:32` - `setupCommands` (34 statements)
- `lib/app-run-helpers.js:245` - `prepareEnvironment` (34 statements)
- `lib/deployer.js:135` - `sendDeploymentRequest` (34 statements)
- `lib/commands/login.js:416` - `handleLogin` (34 statements)
- `lib/utils/app-register-display.js` - `displayValidationResults` (34 statements)
- `lib/external-system-deploy.js:55` - `validateExternalSystemFiles` (33 statements)
- `lib/utils/env-template.js` - `updateEnvTemplate` (32 statements)
- `lib/commands/login.js:173` - `handleCredentialsLogin` (32 statements)
- `lib/app-run-helpers.js:136` - `validateAppConfiguration` (30 statements)
- `lib/app.js:284` - `createApp` (30 statements)
- `lib/utils/app-register-config.js:99` - `extractExternalIntegrationUrl` (30 statements)
- `lib/utils/app-register-config.js` - `resolveExternalFiles` (30 statements)

**Approach**:

- Extract logical sections into separate functions
- Group related operations (validation, preparation, execution, cleanup)
- Maintain single responsibility principle

### 4. Nesting Depth Reduction (6 functions)

Flatten deeply nested blocks (depth >4):

- `lib/app-list.js:122` - Extract nested conditionals into helper functions
- `lib/app-rotate-secret.js:125` - Extract nested try-catch blocks
- `lib/external-system-test.js:231` - Extract nested conditionals
- `lib/utils/app-register-auth.js:91` - Extract nested conditionals (depth: 5)
- `lib/utils/app-register-auth.js:94` - Extract nested conditionals (depth: 6)

**Approach**:

- Use early returns to reduce nesting
- Extract nested blocks into separate functions
- Use guard clauses for validation

## File-by-File Refactoring Plan

### Priority 1: Core Application Files

1. **[lib/app-run.js](lib/app-run.js)** - `runApp` (50 statements, complexity: 28)
2. **[lib/build.js](lib/build.js)** - `buildApp` (66 statements, complexity: 31)
3. **[lib/app-list.js](lib/app-list.js)** - `listApplications` (44 statements, complexity: 22), `extractApplications` (complexity: 11), max-depth: 5
4. **[lib/app-rotate-secret.js](lib/app-rotate-secret.js)** - `rotateSecret` (61 statements, complexity: 24), max-depth: 5

### Priority 2: External System Files

5. **[lib/external-system-deploy.js](lib/external-system-deploy.js)** - `deployExternalSystem` (55 statements, complexity: 39), `validateExternalSystemFiles` (33 statements, complexity: 14), `buildExternalSystem` (32 statements, complexity: 12)
6. **[lib/external-system-download.js](lib/external-system-download.js)** - `downloadExternalSystem` (86 statements, complexity: 27), `generateEnvTemplate` (25 statements, complexity: 19), `validateDownloadedData` (complexity: 12)
7. **[lib/external-system-test.js](lib/external-system-test.js)** - `testExternalSystemIntegration` (47 statements, complexity: 24), `testExternalSystem` (54 statements, complexity: 20), `loadExternalSystemFiles` (37 statements, complexity: 15), `callPipelineTestEndpoint` (6 params), max-depth: 5

### Priority 3: Generator Files

8. **[lib/generator-external.js](lib/generator-external.js)** - `generateExternalSystemApplicationSchema` (58 statements, complexity: 30), `generateExternalSystemDeployJson` (24 statements, complexity: 16)
9. **[lib/generator-split.js](lib/generator-split.js)** - `extractVariablesYaml` (47 statements, complexity: 36), `extractRbacYaml` (complexity: 11), `splitDeployJson` (36 statements)
10. **[lib/generator-builders.js](lib/generator-builders.js)** - `buildBaseDeployment` (complexity: 14), `buildOptionalFields` (27 statements, complexity: 15)
11. **[lib/generator-helpers.js](lib/generator-helpers.js)** - `validatePortalInput` (22 statements, complexity: 23), `parseEnvironmentVariables` (32 statements, complexity: 16)

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

25. **[lib/api/pipeline.api.js](lib/api/pipeline.api.js)** - `testDatasourceViaPipeline` (6 params)

### Priority 7: Other Files

26. **[lib/audit-logger.js](lib/audit-logger.js)** - `logApiCall` (6 params, complexity: 11)
27. **[lib/deployer.js](lib/deployer.js)** - `validateDeployment` (38 statements, complexity: 19), `sendDeploymentRequest` (34 statements, complexity: 17), `pollDeploymentStatus` (24 statements, complexity: 17)
28. **[lib/environment-deploy.js](lib/environment-deploy.js)** - `deployEnvironment` (27 statements, complexity: 12), `pollEnvironmentStatus` (23 statements, complexity: 18), `sendEnvironmentDeployment` (complexity: 12)
29. **[lib/datasource-deploy.js](lib/datasource-deploy.js)** - `deployDatasource` (42 statements, complexity: 13)
30. **[lib/datasource-list.js](lib/datasource-list.js)** - `listDatasources` (26 statements), `extractDatasources` (complexity: 13)
31. **[lib/diff.js](lib/diff.js)** - `compareFiles` (24 statements, complexity: 14), `compareObjects` (complexity: 17), `formatDiffOutput` (24 statements)
32. **[lib/app-run-helpers.js](lib/app-run-helpers.js)** - `validateAppConfiguration` (30 statements, complexity: 16), `prepareEnvironment` (34 statements, complexity: 13), `startContainer` (29 statements), `checkContainerRunning` (21 statements)
33. **[lib/app.js](lib/app.js)** - `createApp` (30 statements), `displaySuccessMessage` (26 statements)
34. **[lib/app-deploy.js](lib/app-deploy.js)** - `loadDeploymentConfig` (22 statements)
35. **[lib/app-prompts.js](lib/app-prompts.js)** - `resolveConflicts` (complexity: 13)
36. **[lib/app-readme.js](lib/app-readme.js)** - `generateReadmeMd` (complexity: 14)
37. **[lib/cli.js](lib/cli.js)** - `setupCommands` (34 statements)
38. **[lib/config.js](lib/config.js)** - `getConfig` (26 statements, complexity: 18), `setDeveloperId` (21 statements)
39. **[lib/generator.js](lib/generator.js)** - `generateDeployJson` (23 statements)
40. **[lib/github-generator.js](lib/github-generator.js)** - `getTemplateContext` (complexity: 14), `validateWorkflowConfig` (complexity: 13)
41. **[lib/infra.js](lib/infra.js)** - `startInfra` (45 statements, complexity: 11), arrow functions (complexity: 11)
42. **[lib/push.js](lib/push.js)** - `parseRegistryUrl` (complexity: 11)
43. **[lib/secrets.js](lib/secrets.js)** - `updatePortForDocker` (24 statements, complexity: 18)
44. **[lib/templates.js](lib/templates.js)** - `generateVariablesYaml` (24 statements, complexity: 15)
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

1. **Phase 1**: Fix max-params violations (3 functions) - Quick wins
2. **Phase 2**: Fix max-depth violations (6 functions) - Reduce nesting
3. **Phase 3**: Refactor high-complexity functions (>15) - Biggest impact
4. **Phase 4**: Refactor high-statement-count functions (>40) - Large functions
5. **Phase 5**: Refactor remaining functions (11-15 complexity, 21-40 statements)
6. **Phase 6**: Update and add tests for all refactored code
7. **Phase 7**: Final validation - run lint, tests, coverage

## Notes

- Maintain backward compatibility - no breaking changes to public APIs
- Preserve all existing functionality - refactoring only, no feature changes
- Follow existing code style and patterns
- Update JSDoc comments for all extracted functions

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
- ✅ File size limits and function size limits clearly stated
- ✅ Test coverage requirements (≥80%) documented