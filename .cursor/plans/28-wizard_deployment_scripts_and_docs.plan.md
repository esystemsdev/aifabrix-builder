# Wizard Deployment Scripts and Documentation Enhancement

## Overview

Enhance the wizard functionality to generate complete deployment packages with `deploy.sh` and `deploy.ps1` scripts, integrate with the dataplane's deployment-docs API for AI-generated README.md, and update documentation to reflect these improvements.

## Current State

- Wizard generates: system JSON, datasource JSONs, variables.yaml, env.template, basic README.md, application-schema.json
- Missing: deploy.sh, deploy.ps1, integration with dataplane deployment-docs API
- Documentation needs validation and updates

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[API Client Structure Pattern](.cursor/rules/project-rules.mdc#api-client-structure-pattern)** - New API function must use centralized API client structure with type definitions
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits (≤500 lines, ≤50 lines per function), JSDoc documentation requirements
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory checks before commit (build, lint, test)
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, coverage requirements (≥80%)
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, logging standards, never log secrets
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Wizard command updates must follow CLI patterns
- **[Template Development](.cursor/rules/project-rules.mdc#template-development)** - Deploy scripts generation follows template patterns
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - No hardcoded secrets in generated files, proper input validation

**Key Requirements**:

- Use centralized API client (`lib/api/`) for new API calls
- Define request/response types using JSDoc `@typedef` in `lib/api/types/`
- Add JSDoc comments for all public functions
- Use try-catch for all async operations
- Keep files ≤500 lines and functions ≤50 lines
- Write tests for all new functions with Jest
- Mock all external dependencies in tests
- Never log secrets or sensitive data
- Use path.join() for cross-platform paths
- Validate all inputs (systemKey, file paths, URLs)
- Use chalk for colored output in CLI
- Follow error handling patterns with meaningful messages

## Before Development

- [ ] Read API Client Structure Pattern section from project-rules.mdc
- [ ] Review existing wizard API functions for patterns
- [ ] Review existing generator functions for file generation patterns
- [ ] Review deploy.sh example from `/workspace/aifabrix-dataplane/data/hubspot/deployment/deploy.sh`
- [ ] Understand testing requirements and mock patterns
- [ ] Review JSDoc documentation patterns for API functions
- [ ] Review error handling patterns in existing code
- [ ] Understand file size limits and function size requirements

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs lint + test)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments with proper types
7. **Code Quality**: All rule requirements met
8. **Security**: No hardcoded secrets in generated scripts, ISO 27001 compliance
9. **API Client**: New API function uses centralized API client structure
10. **Type Definitions**: Request/response types defined in `lib/api/types/wizard.types.js`
11. **Tests**: All new functions have tests with proper mocking
12. **Error Handling**: All async operations wrapped in try-catch with meaningful error messages
13. **Documentation**: Both `docs/wizard.md` and dataplane `wizard.md` updated
14. All tasks completed

## Implementation Tasks

### 1. Add Deployment Docs API Integration

**File**: `lib/api/wizard.api.js`

- Add `getDeploymentDocs(dataplaneUrl, authConfig, systemKey)` function
- Calls `GET /api/v1/wizard/deployment-docs/{systemKey}`
- Returns AI-generated README.md content from dataplane

**File**: `lib/api/types/wizard.types.js`

- Add JSDoc type definitions for deployment docs request/response:
- `DeploymentDocsRequest` - systemKey parameter
- `DeploymentDocsResponse` - systemKey, content, contentType

### 2. Generate Deployment Scripts

**File**: `lib/generator/wizard.js`

- Add `generateDeployScripts(appPath, systemKey, datasourceFileNames)` function
- Generates `deploy.sh` (bash) based on example from `/workspace/aifabrix-dataplane/data/hubspot/deployment/deploy.sh`
- Generates `deploy.ps1` (PowerShell) equivalent for Windows
- Scripts should:
- Validate all JSON files using `aifabrix validate`
- Deploy all datasources using `aifabrix datasource deploy`
- Support ENVIRONMENT and CONTROLLER environment variables
- Support optional RUN_TESTS flag
- Use proper error handling with `set -e` (bash) and `$ErrorActionPreference = "Stop"` (PowerShell)

**Template Structure**:

- `deploy.sh`: Bash script with validation, deployment loop, optional testing
- `deploy.ps1`: PowerShell equivalent with same functionality

### 3. Update Wizard File Generation

**File**: `lib/generator/wizard.js`

- Update `generateWizardFiles()` to:

1. Call `getDeploymentDocs()` API if systemKey is available
2. Use AI-generated README.md from dataplane if available, fallback to basic README
3. Call `generateDeployScripts()` to create deploy.sh and deploy.ps1
4. Return paths to all generated files including scripts

- Update `generateReadme()` to accept optional AI-generated content parameter
- If AI content provided, use it; otherwise generate basic README

### 4. Update Wizard Command Flow

**File**: `lib/commands/wizard.js`

- Update `handleFileSaving()` to pass systemKey to file generation
- Ensure systemKey is available from `handleConfigurationGeneration()` response
- Update success message to mention deploy.sh/deploy.ps1 scripts

### 5. Update Documentation

**File**: `docs/wizard.md`

- Add section about deployment scripts (deploy.sh and deploy.ps1)
- Document the deployment-docs API integration
- Update file structure section to include scripts
- Add deployment workflow section showing how to use scripts

**File**: `/workspace/aifabrix-dataplane/knowledgebase/advanced/wizard.md` (validation)

- Review "Builder Integration" section (lines 650-748)
- Validate that builder workflow description matches implementation:
- Step 3 mentions generating README.md on-the-fly (correct)
- Step 4 mentions builder generates deploy.sh (needs implementation)
- Step 5 describes complete deployment package (needs deploy.ps1 addition)
- Update if needed to reflect:
- Both deploy.sh and deploy.ps1 are generated
- README.md is fetched from dataplane API when available
- Complete file list in deployment package

### 6. Add Tests

**File**: `tests/lib/generator/wizard-generator.test.js`

- Test `generateDeployScripts()` function
- Verify deploy.sh and deploy.ps1 are generated correctly
- Test script content includes validation, deployment, and optional testing
- Test environment variable support

**File**: `tests/lib/api/wizard.api.test.js`

- Test `getDeploymentDocs()` API function
- Mock dataplane API response
- Test error handling

## File Changes Summary

### New Functions

- `lib/api/wizard.api.js`: `getDeploymentDocs()`
- `lib/generator/wizard.js`: `generateDeployScripts()`, update `generateWizardFiles()`, update `generateReadme()`

### Modified Files

- `lib/commands/wizard.js`: Update `handleFileSaving()` to pass systemKey
- `lib/api/types/wizard.types.js`: Add deployment docs types
- `docs/wizard.md`: Add deployment scripts documentation
- `/workspace/aifabrix-dataplane/knowledgebase/advanced/wizard.md`: Validate and update builder section

### Test Files

- `tests/lib/generator/wizard-generator.test.js`: Add deploy scripts tests
- `tests/lib/api/wizard.api.test.js`: Add deployment docs API tests

## Deployment Script Template

**deploy.sh** (based on example):

- Script directory detection
- Environment variable defaults (ENVIRONMENT=dev, CONTROLLER=<http://localhost:3000>)
- Validation loop for all JSON files
- Deployment loop for all datasource files
- Optional integration testing
- Proper error handling

**deploy.ps1** (PowerShell equivalent):

- Same functionality as deploy.sh
- PowerShell-specific syntax
- Environment variable handling
- Error handling with `$ErrorActionPreference = "Stop"`

## Validation Checklist

- [ ] deploy.sh generated and executable
- [ ] deploy.ps1 generated with correct syntax
- [ ] Scripts validate all JSON files
- [ ] Scripts deploy all datasources
- [ ] Environment variables supported
- [ ] Optional testing flag works

## Plan Validation Report

**Date**: 2025-01-27**Plan**: `.cursor/plans/28-wizard_deployment_scripts_and_docs.plan.md`**Status**: ✅ VALIDATED

### Plan Purpose

**Summary**: Enhance wizard functionality to generate complete deployment packages with `deploy.sh` and `deploy.ps1` scripts, integrate with dataplane deployment-docs API for AI-generated README.md, and update documentation.**Scope**:

- API client integration (wizard.api.js)
- File generation (wizard.js generator)
- CLI command updates (wizard.js command)
- Documentation updates (wizard.md, dataplane wizard.md)
- Test additions

**Type**: Development (CLI commands, features, modules) + Documentation

### Applicable Rules

- ✅ **[API Client Structure Pattern](.cursor/rules/project-rules.mdc#api-client-structure-pattern)** - New `getDeploymentDocs()` API function must follow centralized API client structure
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits, JSDoc documentation requirements
- ✅ **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory build, lint, test checks
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, ≥80% coverage
- ✅ **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, never log secrets
- ✅ **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Wizard command updates
- ✅ **[Template Development](.cursor/rules/project-rules.mdc#template-development)** - Deploy scripts generation
- ✅ **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - No secrets in generated files

### Rule Compliance

- ✅ **DoD Requirements**: Documented in Definition of Done section
- ✅ **API Client Structure**: Plan specifies using centralized API client with type definitions
- ✅ **Code Quality**: Plan addresses file size limits and JSDoc requirements
- ✅ **Testing**: Plan includes test tasks for all new functions
- ✅ **Error Handling**: Plan mentions proper error handling patterns
- ✅ **Security**: Plan addresses no secrets in generated files

### Plan Updates Made

- ✅ Added Rules and Standards section with applicable rule references
- ✅ Added Before Development checklist
- ✅ Added Definition of Done section with mandatory requirements
- ✅ Added rule references: API Client Structure, Code Quality, Quality Gates, Testing, Error Handling, CLI Development, Template Development, Security
- ✅ Documented validation order: BUILD → LINT → TEST
- ✅ Documented file size limits and JSDoc requirements
- ✅ Documented test coverage requirement (≥80%)

### Recommendations

- ✅ Plan is production-ready and compliant with all applicable rules
- ✅ All mandatory DoD requirements are documented
- ✅ Rule references are comprehensive and accurate
- ✅ Test requirements are clearly specified
- ✅ Security considerations are addressed

### Next Steps

1. Begin implementation following the plan tasks
2. Ensure all code follows the referenced rules
3. Run build → lint → test validation before marking complete
4. Verify file size limits are respected