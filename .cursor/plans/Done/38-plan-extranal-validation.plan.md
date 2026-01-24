---
name: ""
overview: ""
todos: []
isProject: false
---

# Plan: Unified External System Validation Flow & File Naming Standardization

## Overview

Implement a unified validation and deployment flow for external systems:

1. **File Naming Standardization**: Rename files to consistent naming pattern
2. **Unified Validation**: Single `aifabrix validate <app> --type external` command that validates components + full manifest
3. **Simplified Deployment**: All deployment goes through controller pipeline (remove direct dataplane calls)
4. **Fix Datasource List**: Fix `aifabrix datasource list --environment dev` command
5. **Documentation Updates**: Update all documentation to reflect new file names and deployment flow

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Command patterns, user experience, error handling, and input validation. Applies because we're updating `validate`, `deploy`, and `datasource list` commands.

- **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** - Schema validation using AJV, YAML validation, error formatting. Applies because this plan focuses on unified validation flow with schema validation.

- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits (≤500 lines, ≤50 lines per function), JSDoc documentation requirements. Applies because we're creating new files and modifying existing ones.

- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) **- Mandatory checks before commit (build, lint, test, coverage). **MANDATORY** - applies to all plans.

- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure mirroring, mock patterns, ≥80% coverage. Applies because we need to write tests for new validation flow and deployment changes.

- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, structured error messages, chalk for colored output. Applies because validation needs clear error reporting.

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Module structure, file organization, CommonJS patterns. Applies because we're creating new modules and updating file organization.

- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - Input validation, secret management, no hardcoded secrets. Applies because validation and deployment handle user inputs and configuration.

- **[Development Workflow](.cursor/rules/project-rules.mdc#development-workflow)** - Pre/during/post development steps, TDD approach. Applies to all development work.

- **[API Client Structure Pattern](.cursor/rules/project-rules.mdc#api-client-structure-pattern)** - Use centralized API client (`lib/api/`) for API calls. Applies because we're fixing datasource list command and deployment uses API calls.

**Key Requirements**:

- Use Commander.js pattern for command definitions
- Add input validation and error handling with chalk for colored output
- Use AJV for schema validation with proper error formatting
- Use try-catch for all async operations
- Write tests for all new functions with Jest (≥80% coverage)
- Add JSDoc comments for all public functions
- **File Size Limits**: Keep files ≤500 lines and functions/methods ≤50 lines (mandatory)
- **Linting**: `npm run lint` must pass with **ZERO errors and ZERO warnings** (mandatory)
- Use path.join() for cross-platform paths
- Never log secrets or sensitive data
- Use centralized API client (`lib/api/`) for API calls
- Validate all inputs (app names, file paths, URLs)
- Use structured error messages with context

## Before Development

- [ ] Read CLI Command Development section from project-rules.mdc
- [ ] Read Validation Patterns section from project-rules.mdc (schema validation, YAML validation)
- [ ] Review existing validation code in `lib/validation/validate.js`
- [ ] Review existing generator code in `lib/generator/` modules
- [ ] Review existing deployment code in `lib/external-system/deploy.js`
- [ ] Review existing API client structure in `lib/api/` for datasource list fix
- [ ] Review existing schema files (`lib/schema/application-schema.json`, `external-system.schema.json`, `external-datasource.schema.json`)
- [ ] Understand testing requirements and Jest mock patterns
- [ ] Review JSDoc documentation patterns in existing code
- [ ] Review file naming patterns in existing codebase
- [ ] Review error handling patterns in existing validation code

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs lint + test:ci)
2. **Lint**: Run `npm run lint` (must pass with **ZERO errors and ZERO warnings** - no exceptions)
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: 

   - **Files**: Maximum **500 lines per file** (split large files into smaller modules)
   - **Functions/Methods**: Maximum **50 lines per function/method** (break down complex functions)

6. **JSDoc Documentation**: All public functions have JSDoc comments with proper parameter types and return types
7. **Code Quality**: All rule requirements met, code follows project patterns
8. **Security**: No hardcoded secrets, ISO 27001 compliance, proper input validation
9. **Rule References**: All applicable rule sections referenced and followed
10. **All Tasks Completed**: All plan tasks marked as complete
11. **Validation Flow**: Unified validation flow works correctly (components + full manifest)
12. **Deployment Flow**: Deployment uses controller pipeline only (no direct dataplane calls)
13. **File Naming**: All files use new naming convention consistently
14. **Documentation**: All 14 documentation files updated with new file names and validation display format
15. **Datasource List**: Command fixed and working correctly
16. **Tests**: Tests written for new validation flow, deployment validation, and file naming changes

## Current State

### What exists

- `validateExternalFilesForApp()` - Validates individual system/datasource files
- `generateExternalSystemApplicationSchema()` - Generates dataplane format `{version, application, dataSources}`
- `validateApplication()` - Validates variables.yaml against application schema
- Individual file validation against external-system.schema.json and external-datasource.schema.json

### What's missing

- Generation of controller-compatible deployment manifest format
- Validation of the full bundled deployment manifest
- Unified validation flow that combines component + full manifest validation
- Consistent file naming (current naming is inconsistent)
- Simplified deployment through controller (currently tries direct dataplane calls)
- Working datasource list command

### File Naming Issues

- **Current**: `application-schema.json` (unclear purpose)
- **Current**: `<systemKey>-deploy.json` (system file, confusing with deployment manifest)
- **Current**: `<systemKey>-deploy-<entityType>.json` (datasource files, confusing naming)

### New File Naming Standard

- **Deployment Manifest**: `<systemKey>-deploy.json` (e.g., `my-hubspot-deploy.json`)
  - Contains full deployment manifest with inline system + dataSources
  - This is what gets deployed to controller
- **System File**: `<systemKey>-system.json` (e.g., `my-hubspot-system.json`)
  - Contains external system configuration
  - Referenced in variables.yaml
- **Datasource Files**: `<systemKey>-datasource-<dataSourceKey>.json` (e.g., `my-hubspot-datasource-record-storage.json`)
  - Contains datasource configuration
  - Referenced in variables.yaml

## Implementation Plan

### Phase 0: File Naming Standardization

**Purpose**: Rename files to consistent, clear naming pattern

**File Renames**:

1. `application-schema.json` → `<systemKey>-deploy.json`
2. `<systemKey>-deploy.json` (system file) → `<systemKey>-system.json`
3. `<systemKey>-deploy-<entityType>.json` → `<systemKey>-datasource-<dataSourceKey>.json`

**Files to Update**:

- `lib/generator/wizard.js` - Update file generation
- `lib/generator/external.js` - Update file references
- `lib/generator/external-schema-utils.js` - Update split logic
- `lib/generator/index.js` - Update generation paths
- `lib/validation/validate.js` - Update file resolution
- `lib/utils/schema-resolver.js` - Update file resolution
- `lib/external-system/deploy-helpers.js` - Update file references
- `variables.yaml` template in wizard - Update file references

**Migration Strategy**:

- Support both old and new names during transition
- Update wizard to generate new names
- Update all file references to use new names
- Add migration helper to rename existing files

**Example**:

```yaml
Before:
  my-hubspot/
    ├── application-schema.json
    ├── my-hubspot-deploy.json (system)
    └── my-hubspot-deploy-record-storage.json (datasource)

After:
  my-hubspot/
    ├── my-hubspot-deploy.json (deployment manifest)
    ├── my-hubspot-system.json (system)
    └── my-hubspot-datasource-record-storage.json (datasource)
```

---

### Phase 1: Create Controller-Compatible Manifest Generator

**File**: `lib/generator/external-controller-manifest.js` (new)

**Function**: `generateControllerManifest(appName)`

**Purpose**: Generate controller deployment format with inline system + dataSources

**Output Format**:

```json
{
  "key": "my-hubspot",
  "displayName": "My Hubspot",
  "description": "...",
  "type": "external",
  "deploymentKey": "<generated>",
  "system": {
    // Inline external system JSON from my-hubspot-system.json
  },
  "dataSources": [
    // Inline datasource JSONs from my-hubspot-datasource-*.json files
  ]
}
```

**Steps**:

1. Load variables.yaml to get app metadata
2. Load system file from externalIntegration.systems (new name: `<systemKey>-system.json`)
3. Load datasource files from externalIntegration.dataSources (new name: `<systemKey>-datasource-<key>.json`)
4. Generate deploymentKey using existing key generator
5. Build manifest with inline system + dataSources
6. Return manifest object (don't write to disk yet)

**File Path**: `lib/generator/external-controller-manifest.js` (new)

**Dependencies**:

- `lib/utils/key-generator.js` - For deploymentKey generation
- `lib/generator/external.js` - For loading system/datasource files
- `lib/utils/paths.js` - For app path detection

---

### Phase 2: Update Validation Flow

**File**: `lib/validation/validate.js`

**Function**: `validateAppOrFile()` - Update for external systems

**New Flow for External Systems**:

```javascript
async function validateAppOrFile(appOrFile, options = {}) {
  // ... existing file path check ...
  
  const appName = appOrFile;
  const { appPath, isExternal } = await detectAppType(appName, options);
  
  // For external systems, use new unified validation
  if (isExternal && options.type === 'external') {
    return await validateExternalSystemComplete(appName);
  }
  
  // ... existing regular app validation ...
}
```

**New Function**: `validateExternalSystemComplete(appName)`

**Steps**:

1. **Step 1: Validate Application Config**

   - Validate variables.yaml structure
   - Check externalIntegration block exists
   - Validate app metadata (key, displayName, etc.)

2. **Step 2: Validate Individual Components**

   - Validate external system file(s) against external-system.schema.json
   - Validate all datasource files against external-datasource.schema.json
   - Collect all errors/warnings
   - **If errors found, return early with component errors**

3. **Step 3: Generate Full Manifest** (only if Step 2 passes)

   - Call `generateControllerManifest(appName)`
   - Generate in-memory (don't write to disk)
   - This ensures we always validate the latest generated version

4. **Step 4: Validate Full Manifest**

   - Validate generated manifest against application-schema.json schema
   - Check required fields: key, displayName, description, type, deploymentKey
   - Check system structure matches external-system.schema.json
   - Check each datasource in dataSources array matches external-datasource.schema.json
   - Validate conditional requirements (if type=external, system/dataSources required)

5. **Step 5: Aggregate Results**

   - Combine errors from all steps
   - Return unified result object

**Return Format**:

```javascript
{
  valid: boolean,
  errors: string[],
  warnings: string[],
  steps: {
    application: { valid, errors, warnings },
    components: { valid, errors, warnings, files: [...] },
    manifest: { valid, errors, warnings }
  }
}
```

---

### Phase 3: Update Display Function

**File**: `lib/validation/validate-display.js`

**Function**: `displayValidationResults()` - Update to show step-by-step results

**New Display Format**:

```yaml
✓ Validation passed!

Application:
  ✓ Application configuration is valid
    ⚠ rbac.yaml not found - role-based access control disabled

External Integration Files:
  ✓ my-hubspot-system.json (system)
  ✓ my-hubspot-datasource-record-storage.json (datasource)

Dimensions (ABAC):
  ✓ my-hubspot-datasource-record-storage.json
      id → metadata.id

RBAC Configuration:
  ✓ RBAC configuration is valid
    ⚠ rbac.yaml not found - role-based access control disabled

Deployment Manifest:
  ✓ Full my-hubspot-deploy.json is valid
    ✓ System configuration valid
    ✓ 1 datasource(s) valid
    ✓ Schema validation passed

Warnings:
  • rbac.yaml not found - role-based access control disabled
  • No dimensions configured in some datasources - ABAC filtering may be limited
  • Authentication not configured - authentication disabled (security risk)
```

**Or if errors**:

```yaml
✗ Validation failed!

Application:
  ✓ Application configuration is valid

External Integration Files:
  ✗ my-hubspot-system.json (system):
    • Field "key": Must be a string
  ✓ my-hubspot-datasource-record-storage.json (datasource)

Deployment Manifest:
  ✗ Full my-hubspot-deploy.json validation failed:
    • Field "deploymentKey": Required field missing
    • System validation: Field "key" must be a string
```

---

### Phase 4: Update Generator to Use Controller Format

**File**: `lib/generator/index.js`

**Function**: `generateDeployJson()` - Update for external systems

**Change**: For external systems, generate controller format instead of dataplane format

**Current**: Generates `{version, application, dataSources}` (dataplane format) as `application-schema.json`

**New**: Generates `{key, displayName, type: "external", system, dataSources, deploymentKey}` (controller format) as `<systemKey>-deploy.json`

**File Output**:

- Old: `integration/my-hubspot/application-schema.json`
- New: `integration/my-hubspot/my-hubspot-deploy.json`

**Note**: This affects `aifabrix json` command output - it should generate the deployment-ready format with correct naming.

---

### Phase 5: Schema Validation Helper

**File**: `lib/validation/external-manifest-validator.js` (new)

**Function**: `validateControllerManifest(manifest)`

**Purpose**: Validate the generated controller manifest against application-schema.json schema

**Steps**:

1. Load application-schema.json schema (the JSON schema file, not the generated deployment file)
2. Setup AJV with external schemas (external-system, external-datasource)
3. Validate manifest structure
4. Validate inline system against external-system.schema.json
5. Validate each datasource against external-datasource.schema.json
6. Return validation result with formatted errors

---

## File Changes Summary

### New Files

1. `lib/generator/external-controller-manifest.js` - Controller manifest generator
2. `lib/validation/external-manifest-validator.js` - Full manifest validator

### Modified Files

1. `lib/validation/validate.js` - Add `validateExternalSystemComplete()` function
2. `lib/validation/validate-display.js` - Update display for step-by-step results
3. `lib/generator/index.js` - Update `generateDeployJson()` to use controller format for external systems

---

## Testing Plan

### Test Cases

1. **Valid external system**

   - All files valid
   - Full manifest valid
   - Should show "All good"

2. **Invalid system file**

   - System file has errors
   - Should stop at Step 2, show component errors

3. **Invalid datasource file**

   - Datasource file has errors
   - Should stop at Step 2, show component errors

4. **Valid components, invalid manifest**

   - Components valid but generated manifest fails schema validation
   - Should show Step 2 passed, Step 4 failed

5. **Missing files**

   - System or datasource files missing
   - Should show clear error messages

6. **Invalid variables.yaml**

   - Missing externalIntegration block
   - Should show Step 1 errors

---

## Implementation Order

1. ✅ Create `external-controller-manifest.js` with `generateControllerManifest()`
2. ✅ Create `external-manifest-validator.js` with `validateControllerManifest()`
3. ✅ Add `validateExternalSystemComplete()` to `validate.js`
4. ✅ Update `validateAppOrFile()` to call new function for external systems
5. ✅ Update `validate-display.js` for step-by-step display
6. ✅ Update `generateDeployJson()` to use controller format
7. ✅ Write tests for new validation flow
8. ✅ Update integration tests

---

## Questions Resolved

✅ **File generation**: Generate in-memory for validation (don't write to disk)

✅ **Error reporting**: Show errors grouped by step (Step 1, Step 2, Step 4)

✅ **Schema format**: Use inline format `{system: {...}, dataSources: [...]}`

✅ **Existing file**: Always regenerate to ensure completeness

---

### Phase 6: Fix Datasource List Command

**File**: `lib/datasource/list.js` and `lib/api/environments.api.js`

**Issue**: `aifabrix datasource list --environment dev` not working

**Investigation Needed**:

1. Check if API endpoint is correct: `/api/v1/environments/{envKey}/datasources`
2. Check response format handling
3. Check authentication flow
4. Test with actual controller

**Potential Issues**:

- API endpoint might be wrong
- Response format might be different than expected
- Authentication might not be working
- Environment key format might be wrong

**Fix Steps**:

1. Test API endpoint manually
2. Check response format from controller
3. Update response parsing if needed
4. Add better error messages
5. Add validation for environment parameter

---

### Phase 7: Add Deployment Validation

**File**: `lib/external-system/deploy.js`

**Function**: `deployExternalSystem()` - Add validation before deployment

**Purpose**: Run the same validation flow before deploying to ensure deployment-ready manifest

**New Flow**:

```javascript
async function deployExternalSystem(appName, options = {}) {
  try {
    logger.log(chalk.blue(`\n🚀 Deploying external system: ${appName}`));

    // Step 0: Validate before deployment (same as validate command)
    logger.log(chalk.blue('🔍 Validating external system before deployment...'));
    const validation = require('../validation/validate');
    const validationResult = await validation.validateExternalSystemComplete(appName);
    
    if (!validationResult.valid) {
      validation.displayValidationResults(validationResult);
      throw new Error('Validation failed. Fix errors before deploying.');
    }
    
    logger.log(chalk.green('✓ Validation passed, proceeding with deployment...'));

    // Step 1: Generate controller manifest (validated, ready for deployment)
    const { generateControllerManifest } = require('../generator/external-controller-manifest');
    const manifest = await generateControllerManifest(appName);
    
    // Step 2: Get deployment configuration (auth, controller URL, etc.)
    const { environment, controllerUrl, authConfig } = await prepareDeploymentConfig(appName, options);

    // Step 3: Deploy via controller pipeline (same as regular apps)
    const deployer = require('../deployment/deployer');
    const result = await deployer.deployToController(
      manifest,
      controllerUrl,
      {
        environment,
        authConfig,
        ...options
      }
    );

    // Display success summary
    logger.log(chalk.green('\n✅ External system deployed successfully!'));
    logger.log(chalk.blue(`System: ${manifest.key}`));
    logger.log(chalk.blue(`Datasources: ${manifest.dataSources.length}`));
    
    return result;
  } catch (error) {
    throw new Error(`Failed to deploy external system: ${error.message}`);
  }
}
```

**Key Changes**:

1. **Pre-deployment validation**: Run `validateExternalSystemComplete()` before deployment
2. **Fail fast**: If validation fails, stop deployment and show errors
3. **Generate manifest**: Use `generateControllerManifest()` to get validated manifest
4. **Use controller pipeline**: Deploy via `deployToController()` (same as regular apps)
5. **Unified flow**: Same validation logic for both `validate` and `deploy` commands

**Benefits**:

- Prevents deploying invalid configurations
- Same validation logic in both commands (DRY)
- Clear error messages before deployment starts
- Ensures deployment manifest is always validated and complete

**Error Handling**:

- If validation fails → Show validation errors, exit with error code
- If manifest generation fails → Show error, exit
- If deployment fails → Show deployment error, exit

---

### Phase 7: Simplify Deployment - Use Controller Pipeline Only

**File**: `lib/external-system/deploy.js`

**Current Issue**:

- Tries to deploy directly to dataplane
- Uses separate dataplane API calls
- Complex deployment logic

**Solution**: Use the same controller pipeline as regular apps - **remove all dataplane direct calls**

**Changes**:

1. **Remove all dataplane API calls**:

   - Remove `createExternalSystem()` calls
   - Remove `publishExternalSystem()` calls
   - Remove `deployDatasourceViaPipeline()` calls
   - Remove `getDataplaneUrlForDeployment()` - not needed
   - Remove `discoverDataplaneUrl()` - not needed

2. **Use unified controller pipeline**:

   - Use `deployToController()` from `lib/deployment/deployer.js` (same as regular apps)
   - Controller handles routing to dataplane automatically
   - Same authentication flow as regular apps
   - Same validation flow as regular apps

3. **Simplify deployment function**:

   - Remove `buildExternalSystem()` function (not needed)
   - Remove `deploySystem()` function (not needed)
   - Remove `deployAllDatasources()` function (not needed)
   - Remove `deploySingleDatasource()` function (not needed)
   - Keep only `deployExternalSystem()` which uses controller pipeline

**Deployment Flow** (same as regular apps):

```
1. Validate (components + full manifest) - local validation
2. Generate controller manifest (<systemKey>-deploy.json)
3. Validate manifest via controller (/api/v1/pipeline/{env}/validate)
4. Deploy via controller (/api/v1/pipeline/{env}/deploy)
5. Controller routes to dataplane and publishes external system + datasources
```

**Code Reduction**:

- Remove ~200 lines of dataplane-specific deployment code
- Use existing `deployToController()` function
- Same code path as regular apps = less maintenance

---

## Updated File Changes Summary

### New Files

1. `lib/generator/external-controller-manifest.js` - Controller manifest generator
2. `lib/validation/external-manifest-validator.js` - Full manifest validator

### Modified Files

1. `lib/generator/wizard.js` - Update file naming (system, datasource, deploy files)
2. `lib/generator/external.js` - Update file references and generation
3. `lib/generator/external-schema-utils.js` - Update split logic for new file names
4. `lib/generator/index.js` - Update `generateDeployJson()` to use controller format and new file names
5. `lib/validation/validate.js` - Add `validateExternalSystemComplete()`, update file resolution
6. `lib/validation/validate-display.js` - Update display for step-by-step results, new file names
7. `lib/utils/schema-resolver.js` - Update file resolution for new file names
8. `lib/external-system/deploy-helpers.js` - Update file references
9. `lib/external-system/deploy.js` - Simplify to use controller pipeline only, remove dataplane calls
10. `lib/datasource/list.js` - Fix datasource list command
11. `lib/commands/datasource.js` - Verify command setup

---

## Updated Testing Plan

### Additional Test Cases for Deployment

7. **Deploy with invalid components**

   - System file has errors
   - Should fail validation, not deploy
   - Should show validation errors

8. **Deploy with invalid manifest**

   - Components valid but manifest invalid
   - Should fail validation, not deploy
   - Should show manifest validation errors

9. **Deploy with valid configuration**

   - All validation passes
   - Should generate manifest
   - Should deploy via controller
   - Should succeed

10. **Deploy validation failure display**

    - Should show same validation output as `validate` command
    - Should clearly indicate deployment was prevented

---

## Updated Implementation Order

### Phase 0: File Naming (Foundation)

1. ✅ Update `lib/generator/wizard.js` - Generate files with new names
2. ✅ Update `lib/generator/external.js` - Update file references
3. ✅ Update `lib/generator/external-schema-utils.js` - Update split logic
4. ✅ Update `lib/utils/schema-resolver.js` - Update file resolution
5. ✅ Update `lib/external-system/deploy-helpers.js` - Update file references
6. ✅ Update `variables.yaml` references in code

### Phase 1-5: Validation & Generation

7. ✅ Create `external-controller-manifest.js` with `generateControllerManifest()`
8. ✅ Create `external-manifest-validator.js` with `validateControllerManifest()`
9. ✅ Add `validateExternalSystemComplete()` to `validate.js`
10. ✅ Update `validateAppOrFile()` to call new function for external systems
11. ✅ Update `validate-display.js` for step-by-step display and new file names
12. ✅ Update `generateDeployJson()` to use controller format and new file names

### Phase 6: Fix Datasource List

13. ✅ Investigate and fix `aifabrix datasource list --environment dev`
14. ✅ Test datasource list command

### Phase 7-8: Deployment

15. ✅ **Simplify `deployExternalSystem()` - remove all dataplane calls**
16. ✅ **Update `deployExternalSystem()` to use `deployToController()` only**
17. ✅ **Add pre-deployment validation to `deployExternalSystem()`**

### Testing & Documentation

18. ✅ Write tests for new validation flow
19. ✅ Write tests for deployment validation
20. ✅ Write tests for new file naming
21. ✅ Update integration tests
22. ✅ **Fix datasource list command and test**
23. ✅ **Update all documentation files (13 files identified)**
24. ✅ **Update integration examples (hubspot README, QUICK_START)**

---

## Documentation Updates Required

### Files to Update

1. **`docs/commands/validation.md`** (Primary validation documentation):

   - **Lines 47-71**: Update validation output examples
     - Add: Dimensions (ABAC) section
     - Add: RBAC Configuration section
     - Add: Deployment Manifest section
     - Update: File names to new naming convention (`hubspot.json` → `hubspot-system.json`, etc.)
     - Update: Show improved validation display format with warnings
     - Fix: Error example to show correct file names
   - **Line 13**: Update description to mention full manifest validation
   - **Lines 32-45**: Update process description to include deployment manifest validation

2. **`docs/external-systems.md`** (Primary documentation):

   - **Line 342-360**: Update Step 5 deployment section
     - Change: `application-schema.json` → `<systemKey>-deploy.json`
     - Change: Deployment description to show unified controller pipeline
     - Remove: References to dataplane direct calls
     - Add: Note that deployment goes through controller (same as regular apps)
   - **Line 330-340**: Update Step 4 validation section
     - Update: Show new validation output format with Dimensions, RBAC, Deployment Manifest
     - Update: File naming examples
   - **Throughout file**: Search and replace file naming:
     - `application-schema.json` → `<systemKey>-deploy.json`
     - `<systemKey>-deploy.json` (system) → `<systemKey>-system.json`
     - `<systemKey>-deploy-<entity>.json` → `<systemKey>-datasource-<key>.json`
   - **Update examples**: All file naming examples
   - **Update variables.yaml examples**: Update externalIntegration.systems and dataSources references
   - **Lines 742-748**: Update RBAC section with new file names
   - **Lines 971-1001**: Update Dimensions section with new file names

3. **`docs/commands/external-integration.md`**:

   - **Lines 497-536**: Update test output examples (validation display format)
   - **Line 170**: Update validation error message
   - **Line 419**: Update validation error message
   - **Line 557**: Update validation error message
   - Update `datasource list` command documentation (fix broken command reference)
   - Update file naming examples
   - Update deployment flow description

4. **`docs/configuration.md`**:

   - **Line 518**: Update `application-schema.json` → `<systemKey>-deploy.json`
   - Update externalIntegration examples with new file names
   - Update any validation output examples if present

5. **`docs/commands/deployment.md`**:

   - **Line 385**: Update validation error message
   - Update external system deployment section
   - Remove dataplane direct call references
   - Update to show unified controller pipeline
   - Update any validation output examples

6. **`docs/wizard.md`**:

   - Update file naming in wizard examples
   - Update generated file names
   - Update validation output examples if present

7. **`docs/commands/utilities.md`**:

   - **Line 80**: Update validation error message
   - Update file references if any

8. **`docs/commands/application-development.md`**:

   - Update file references if any
   - Update validation examples if present

9. **`docs/quick-start.md`**:

   - Update file naming examples
   - Update validation output examples if present

10. **`docs/github-workflows.md`**:

    - Update file references if any
    - Update validation examples if present

11. **`docs/deploying.md`**:

    - **Lines 282-868**: Update deployment flow diagrams if they reference validation
    - Update external system deployment section
    - Update validation references

12. **`docs/cli-reference.md`**:

    - Verify datasource list command reference is correct
    - Update validation command reference if needed

13. **`integration/hubspot/README.md`**:

    - Update file naming references
    - Update deployment instructions
    - Update validation examples

14. **`integration/hubspot/QUICK_START.md`**:

    - Update file naming references
    - Update examples
    - Update validation output examples

### Documentation Search & Replace Patterns

**Pattern 1**: `application-schema.json`

- Replace with: `<systemKey>-deploy.json` (or use example like `my-hubspot-deploy.json`)

**Pattern 2**: System file naming

- Old: `hubspot-deploy.json` (when referring to system file)
- New: `hubspot-system.json`
- Old: `hubspot.json` (generic system file)
- New: `hubspot-system.json`

**Pattern 3**: Datasource file naming

- Old: `hubspot-deploy-company.json`, `hubspot-deploy-contact.json`
- New: `hubspot-datasource-company.json`, `hubspot-datasource-contact.json`
- Old: `hubspot-deal.json` (generic datasource)
- New: `hubspot-datasource-deal.json` (or use actual datasource key)

**Pattern 4**: Deployment description

- Old: "Deploys directly to dataplane" or "Uses dataplane API"
- New: "Deploys via Miso Controller pipeline (same as regular apps)"

**Pattern 5**: variables.yaml examples

- Update `externalIntegration.systems` to reference `-system.json` files
- Update `externalIntegration.dataSources` to reference `-datasource-*.json` files

**Pattern 6**: Validation output examples

- Old: Simple validation output without Dimensions, RBAC, Deployment Manifest
- New: Enhanced validation output with all sections (see improved format above)
- Update: File names in validation examples to new naming convention
- Fix: Typos ("rolebase" → "role-based", "autentication" → "authentication")

### Documentation Changes Summary

**File Naming**:

- ❌ Old: `application-schema.json`
- ✅ New: `<systemKey>-deploy.json`

- ❌ Old: `<systemKey>-deploy.json` (system file)
- ✅ New: `<systemKey>-system.json`

- ❌ Old: `<systemKey>-deploy-<entityType>.json` (datasource)
- ✅ New: `<systemKey>-datasource-<dataSourceKey>.json`

**Deployment Flow**:

- ❌ Old: "Deploys directly to dataplane"
- ✅ New: "Deploys via controller pipeline (same as regular apps)"

**Commands**:

- Update examples to show new file names
- Update `aifabrix json` output description
- Fix `aifabrix datasource list` documentation

---

## Notes

- The generated manifest uses **inline** system + dataSources (not file references)
- This ensures the deployment file is self-contained and complete
- The validation is fast because we validate components first, then only generate if components are valid
- The `aifabrix json` command generates `<systemKey>-deploy.json` (controller format, consistent with deployment)
- **Deployment now uses the same validation as the validate command** - ensures consistency
- **Deployment goes through controller pipeline only** - same unified flow as regular apps, no direct dataplane calls
- **Validation prevents invalid deployments** - fail fast with clear error messages
- **File naming is now consistent and clear** - deployment manifest, system file, and datasource files have distinct names
- **Code simplification** - removed ~200 lines of dataplane-specific code, using unified controller pipeline

---

## Summary of Changes

### File Naming Changes

| Old Name | New Name | Purpose |

|----------|----------|---------|

| `application-schema.json` | `<systemKey>-deploy.json` | Deployment manifest (what gets deployed) |

| `<systemKey>-deploy.json` | `<systemKey>-system.json` | External system configuration |

| `<systemKey>-deploy-<entity>.json` | `<systemKey>-datasource-<key>.json` | Datasource configuration |

### Code Simplification

- **Remove**: All direct dataplane API calls (~200 lines)
- **Remove**: `buildExternalSystem()`, `deploySystem()`, `deployAllDatasources()`, `deploySingleDatasource()`
- **Remove**: `getDataplaneUrlForDeployment()`, `discoverDataplaneUrl()` usage
- **Add**: Use `deployToController()` from `lib/deployment/deployer.js` (same as regular apps)
- **Result**: External systems deploy exactly like regular apps - unified code path

### Validation Flow

- **Before**: Only validates individual files
- **After**: Validates components → generates manifest → validates full manifest → reports all errors

### Deployment Flow

- **Before**: Direct dataplane calls, complex logic
- **After**: Controller pipeline only (validate → deploy via controller → controller routes to dataplane)

### Files Affected

- **11 code files** to modify
- **2 new code files** to create
- **14 documentation files** to update (including validation display format updates)
- **2 integration example files** to update

### Documentation Files Requiring Validation Display Updates

1. `docs/commands/validation.md` - **Primary validation docs** - Update all output examples
2. `docs/external-systems.md` - Update validation section and examples
3. `docs/commands/external-integration.md` - Update test output examples
4. `docs/commands/deployment.md` - Update validation references
5. `docs/commands/utilities.md` - Update validation error messages
6. `docs/wizard.md` - Update validation examples if present
7. `docs/quick-start.md` - Update validation examples if present
8. `docs/github-workflows.md` - Update validation examples if present
9. `docs/deploying.md` - Update validation references
10. `integration/hubspot/README.md` - Update validation examples
11. `integration/hubspot/QUICK_START.md` - Update validation examples

### Commands Fixed

- `aifabrix validate <app> --type external` - Now validates full deployment manifest
- `aifabrix deploy <app>` (external) - Now uses controller pipeline, validates before deploy
- `aifabrix datasource list --environment dev` - Fix broken command
- `aifabrix json <app> --type external` - Generates `<systemKey>-deploy.json` with controller format

---

## Plan Validation Report

**Date**: 2025-01-15

**Plan**: `.cursor/plans/38-plan-extranal-validation.md`

**Status**: ✅ VALIDATED

### Plan Purpose

This plan implements a unified validation and deployment flow for external systems with the following key objectives:

- **File Naming Standardization**: Rename files to consistent, clear naming pattern (`<systemKey>-deploy.json`, `<systemKey>-system.json`, `<systemKey>-datasource-<key>.json`)
- **Unified Validation**: Single `aifabrix validate <app> --type external` command that validates components + full manifest
- **Simplified Deployment**: All deployment goes through controller pipeline (remove direct dataplane calls)
- **Fix Datasource List**: Fix `aifabrix datasource list --environment dev` command
- **Documentation Updates**: Update all documentation to reflect new file names and deployment flow

**Plan Type**: Development (CLI commands, validation flow, deployment), Refactoring (file naming, code simplification), Testing (test additions), Documentation (14 files to update)

**Affected Areas**: CLI commands (validate, deploy, datasource list), validation logic, schema validation, file generation, deployment flow, API client usage, documentation

### Applicable Rules

- ✅ **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Applies because we're updating `validate`, `deploy`, and `datasource list` commands with new functionality and error handling

- ✅ **[Validation Patterns](.cursor/rules/project-rules.mdc#validation-patterns)** - Applies because this plan focuses on unified validation flow with schema validation using AJV and YAML validation

- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - Applies because we're creating new files (`external-controller-manifest.js`, `external-manifest-validator.js`) and modifying existing ones, requiring file size limits and JSDoc documentation

- ✅ **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates) **- **MANDATORY** - Applies to all plans. DoD requirements must be documented and followed

- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Applies because we need to write tests for new validation flow, deployment validation, and file naming changes (≥80% coverage)

- ✅ **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Applies because validation needs clear error reporting with structured error messages and chalk for colored output

- ✅ **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Applies because we're creating new modules (`lib/generator/external-controller-manifest.js`, `lib/validation/external-manifest-validator.js`) and updating file organization

- ✅ **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - Applies because validation and deployment handle user inputs and configuration, requiring proper input validation and no hardcoded secrets

- ✅ **[Development Workflow](.cursor/rules/project-rules.mdc#development-workflow)** - Applies to all development work, including TDD approach and pre/during/post development steps

- ✅ **[API Client Structure Pattern](.cursor/rules/project-rules.mdc#api-client-structure-pattern)** - Applies because we're fixing datasource list command and deployment uses API calls, requiring use of centralized API client (`lib/api/`)

### Rule Compliance

- ✅ **DoD Requirements**: Documented with BUILD → LINT → TEST validation order (mandatory sequence)
- ✅ **Code Quality Standards**: File size limits (≤500 lines, ≤50 lines per function) documented in DoD
- ✅ **Testing Conventions**: Test structure mirroring and coverage requirements (≥80%) documented in DoD
- ✅ **Code Style**: Error handling and async/await patterns documented in implementation guidelines
- ✅ **Quality Gates**: All mandatory checks (build, lint, test, coverage) documented in DoD
- ✅ **JSDoc Documentation**: Requirement for all public functions documented in DoD
- ✅ **Validation Patterns**: Schema validation requirements documented in plan (AJV, error formatting)
- ✅ **CLI Command Development**: Command update requirements documented (validate, deploy, datasource list)
- ✅ **Error Handling & Logging**: Error handling patterns documented (structured errors, chalk output)
- ✅ **Security & Compliance**: Input validation and secret management requirements documented
- ✅ **API Client Structure Pattern**: Requirement to use centralized API client documented

### Plan Updates Made

- ✅ Added **Rules and Standards** section with links to applicable rule sections and key requirements
- ✅ Added **Before Development** checklist with rule compliance items and prerequisites
- ✅ Added **Definition of Done** section with mandatory BUILD → LINT → TEST validation order
- ✅ Added explicit requirements for file size limits, JSDoc documentation, and test coverage
- ✅ Added rule references: CLI Command Development, Validation Patterns, Code Quality Standards, Quality Gates, Testing Conventions, Error Handling & Logging, Architecture Patterns, Security & Compliance, Development Workflow, API Client Structure Pattern
- ✅ Added validation order requirement: BUILD → LINT → TEST (mandatory sequence, never skip steps)
- ✅ Added comprehensive DoD checklist with 16 items covering all aspects of completion

### Recommendations

- ✅ Plan is production-ready with all DoD requirements documented
- ✅ All applicable rules referenced with explanations
- ✅ Validation order explicitly documented (BUILD → LINT → TEST)
- ✅ Test structure mirroring requirements clearly documented
- ✅ File naming standardization strategy well-defined
- ✅ Code simplification approach clearly documented (removing ~200 lines of dataplane code)
- ✅ Documentation update requirements clearly identified (14 files)
- ⚠️ **Note**: Ensure migration strategy supports both old and new file names during transition period
- ⚠️ **Note**: When implementing, ensure all API calls use centralized API client (`lib/api/`) instead of direct `makeApiCall`
- ⚠️ **Note**: When writing tests, ensure proper mocking of API client, file operations, and schema validation
- ⚠️ **Note**: When updating documentation, ensure all file naming examples are updated consistently across all 14 files