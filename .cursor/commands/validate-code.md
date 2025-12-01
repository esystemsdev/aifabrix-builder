# validate-code

This command analyzes all core code (lib, bin, templates, schemas) against development rules and creates or updates detailed improvement plans for each module category.

## Purpose

The command:
1. Reads all development rules from `.cursor/rules/project-rules.mdc`
2. Analyzes all core code in:
   - `lib/` (primary focus - core logic, commands, utilities)
   - `bin/` (CLI entry point)
   - `templates/` (Handlebars templates)
   - `lib/schema/` (JSON schemas)
3. Groups code by module category (e.g., "Core - App Management", "Core - Deployment", "Utils - Docker", "Commands - App")
4. For each category, checks if a plan file already exists with pattern `*-fix-and-improve-code.<category>.plan.md`
5. If a plan exists, updates the existing plan file
6. If no plan exists, creates a new plan file with format: `<next-number>-fix-and-improve-code.<category>.plan.md`
7. Documents all violations and required improvements based on cursor rules

## Usage

Run this command in chat with `/validate-code`

## What It Does

For each module category, the command:

1. **Analyzes Code Reuse**:
   - Checks for code duplication across modules
   - Verifies use of reusable utilities from `lib/utils/`
   - Validates proper abstraction of common patterns
   - Checks for forbidden manual implementations (error handling, file operations, path construction)
   - Identifies opportunities for shared utility functions
   - Verifies use of existing utility modules where applicable

2. **Analyzes Error Handling**:
   - Verifies proper Error usage with descriptive messages
   - Checks for proper exception propagation
   - Validates error messages are descriptive and user-friendly
   - Checks for proper error context in exceptions
   - Verifies try-catch blocks wrap all async operations
   - Validates error handling follows project patterns (chalk for colored output)
   - Checks for proper use of `api-error-handler.js` utilities where applicable

3. **Analyzes Logging**:
   - Verifies proper use of console.log/console.error with chalk for colored output
   - Checks for proper use of `lib/utils/logger.js` where applicable
   - Validates logging includes appropriate context (app names, file paths, operation names)
   - Checks for forbidden `console.log()` without chalk coloring in CLI commands
   - Verifies appropriate log levels (info, error, warning)
   - Validates audit logging for critical operations using `lib/audit-logger.js`
   - Checks that secrets are never logged

4. **Analyzes Type Safety**:
   - Verifies all functions have JSDoc comments with type annotations
   - Checks for proper return type annotations in JSDoc
   - Validates async function signatures in JSDoc
   - Checks for proper use of JSDoc types (string, number, Object, Array, Promise, etc.)
   - Verifies JSDoc includes `@param`, `@returns`, `@throws` where applicable
   - Validates `@fileoverview` at top of each file

5. **Analyzes Async Patterns**:
   - Verifies all file operations use async/await with `fs.promises`
   - Checks for proper use of async/await (not raw promises)
   - Validates no synchronous file operations in async functions (unless necessary)
   - Checks for proper async context management
   - Verifies API calls use async patterns where applicable
   - Validates proper error handling in async functions

6. **Analyzes File Operations**:
   - Verifies use of `fs.promises` for async file operations
   - Checks for proper use of `path.join()` for cross-platform paths
   - Validates file not found errors are handled properly
   - Checks for proper use of `fs.existsSync` when needed
   - Verifies no hardcoded file paths
   - Validates proper file encoding (utf8) is specified

7. **Analyzes Input Validation**:
   - Verifies all function parameters are validated
   - Checks for proper app name validation (alphanumeric, hyphens, underscores)
   - Validates file paths and existence checks
   - Checks for proper YAML syntax validation before parsing
   - Verifies JSON schema validation before deployment
   - Validates URL and endpoint validation
   - Checks for path traversal attack prevention

8. **Analyzes Module Patterns**:
   - Verifies modules use CommonJS (`require`/`module.exports`)
   - Checks for proper module export patterns (named vs default exports)
   - Validates proper separation of concerns
   - Checks for proper dependency injection patterns
   - Verifies modules don't contain CLI-specific logic (should be in commands)
   - Validates single responsibility principle

9. **Analyzes Testing**:
   - Checks for test coverage of core modules
   - Validates test structure mirrors code structure (`tests/lib/`)
   - Verifies all error cases are tested
   - Checks for proper use of Jest mocks (fs, axios, child_process)
   - Validates async test patterns
   - Checks for integration test coverage where needed
   - Verifies tests follow Jest patterns from project rules

10. **Analyzes Code Quality**:
    - Checks for proper function documentation (JSDoc)
    - Validates code follows JavaScript best practices
    - Checks for proper variable naming conventions (camelCase)
    - Verifies no hardcoded values (use configuration)
    - Validates proper use of constants (UPPER_SNAKE_CASE)
    - Checks file size limits (≤500 lines per file, ≤50 lines per function)
    - Verifies proper code organization and structure

11. **Analyzes Security & Compliance**:
    - Verifies no hardcoded secrets, passwords, or tokens
    - Checks for proper secret management using `lib/secrets.js`
    - Validates `kv://` references are used for secrets in templates
    - Checks that secrets are never logged or exposed
    - Verifies proper input sanitization
    - Validates audit logging for critical operations
    - Checks for ISO 27001 compliance patterns

12. **Analyzes Template Generation**:
    - Verifies Handlebars templates follow project patterns
    - Checks for proper template context validation
    - Validates template rendering uses `lib/templates.js`
    - Checks for proper error handling in template generation
    - Verifies templates are stored in correct directories

13. **Analyzes CLI Command Patterns**:
    - Verifies commands follow Commander.js patterns
    - Checks for proper command definitions in `lib/cli.js`
    - Validates command implementations in `lib/commands/`
    - Checks for proper input validation in commands
    - Verifies error handling with chalk colored output
    - Validates proper use of options and flags

## Output

Creates or updates plan files in `.cursor/plans/` with:
- Overview of the module category
- List of all files/modules in the category
- Detailed violation analysis
- Specific improvement tasks
- Code examples for fixes
- Testing requirements
- Priority recommendations

**Important**: If a plan file with pattern `*-fix-and-improve-code.<category>.plan.md` already exists (e.g., `70-fix-and-improve-code.core-app-management.plan.md`), the command will **update** the existing plan instead of creating a new one. This ensures that progress on existing plans is preserved and updated with the latest analysis.

**Execution Behavior**: When generating a new plan, it should be clearly identified as a "code improvement plan and execution". The command should execute improvements automatically without asking for user input or showing progress details, unless there are breaking changes or other critical reasons that require user confirmation. The focus is on silent, automated execution of code improvements based on the analysis.

## Example Plan Structure

```markdown
# Fix and Improve Code - Core - App Management

## Overview
[Description of the module category and its purpose]

## Modules Analyzed
[List of all files in this category]

## Key Issues Identified
[Summary of main violations]

## Implementation Tasks

### Task 1: Fix Code Duplication
[Detailed task description with code examples showing duplication and how to refactor using lib/utils/]

### Task 2: Add Proper Error Handling
[Detailed task description with code examples showing proper Error usage and try-catch patterns]

### Task 3: Improve Logging
[Detailed task description with code examples showing chalk usage and proper logging patterns]

### Task 4: Add JSDoc Comments
[Detailed task description with code examples showing proper JSDoc annotations]

### Task 5: Fix Async Patterns
[Detailed task description with code examples showing proper async/await and fs.promises usage]

### Task 6: Add Input Validation
[Detailed task description with code examples showing proper parameter validation]

### Task 7: Improve Security
[Detailed task description with code examples showing secret management and security best practices]

...
```

## Module Categories

The command groups code into the following categories:

### Core - App Management
- **Core - App Management**: `lib/app.js`, `lib/app-*.js` (app-config, app-deploy, app-dockerfile, app-down, app-list, app-prompts, app-push, app-readme, app-register, app-rotate-secret, app-run, app-run-helpers)

### Core - Deployment
- **Core - Deployment**: `lib/deployer.js`, `lib/generator.js`, `lib/push.js`

### Core - Infrastructure
- **Core - Infrastructure**: `lib/infra.js`, `lib/build.js`

### Core - Configuration & Validation
- **Core - Configuration**: `lib/config.js`, `lib/validator.js`, `lib/validate.js`, `lib/template-validator.js`

### Core - Templates & Secrets
- **Core - Templates**: `lib/templates.js`
- **Core - Secrets**: `lib/secrets.js`

### Core - CLI
- **Core - CLI**: `lib/cli.js`, `bin/aifabrix.js`

### Commands
- **Commands - App**: `lib/commands/app.js`
- **Commands - Datasource**: `lib/commands/datasource.js`
- **Commands - Login**: `lib/commands/login.js`
- **Commands - Secrets**: `lib/commands/secrets-set.js`, `lib/commands/secure.js`

### Utils - API & Authentication
- **Utils - API**: `lib/utils/api.js`, `lib/utils/api-error-handler.js`, `lib/utils/auth-headers.js`, `lib/utils/token-manager.js`

### Utils - Docker & Build
- **Utils - Docker**: `lib/utils/docker.js`, `lib/utils/docker-build.js`, `lib/utils/dockerfile-utils.js`, `lib/utils/build-copy.js`

### Utils - Environment & Configuration
- **Utils - Environment**: `lib/utils/env-*.js` (env-config-loader, env-copy, env-endpoints, env-map, env-ports, env-template), `lib/utils/environment-checker.js`

### Utils - Secrets & Security
- **Utils - Secrets**: `lib/utils/secrets-*.js` (secrets-encryption, secrets-generator, secrets-helpers, secrets-path, secrets-url, secrets-utils), `lib/utils/local-secrets.js`

### Utils - Infrastructure
- **Utils - Infrastructure**: `lib/utils/infra-containers.js`, `lib/utils/compose-generator.js`, `lib/utils/health-check.js`

### Utils - Deployment
- **Utils - Deployment**: `lib/utils/deployment-errors.js`, `lib/utils/deployment-validation.js`

### Utils - General Utilities
- **Utils - General**: `lib/utils/cli-utils.js`, `lib/utils/logger.js`, `lib/utils/paths.js`, `lib/utils/error-formatter.js`, `lib/utils/image-name.js`, `lib/utils/key-generator.js`, `lib/utils/variable-transformer.js`, `lib/utils/yaml-preserve.js`, `lib/utils/template-helpers.js`, `lib/utils/schema-loader.js`, `lib/utils/schema-resolver.js`, `lib/utils/dev-config.js`, `lib/utils/device-code.js`

### External System & Datasource
- **External System**: `lib/external-system-*.js` (external-system-deploy, external-system-generator)
- **Datasource**: `lib/datasource-*.js` (datasource-deploy, datasource-diff, datasource-list, datasource-validate)

### Other Core Modules
- **Core - Other**: `lib/audit-logger.js`, `lib/diff.js`, `lib/env-reader.js`, `lib/github-generator.js`

### Schemas
- **Schemas**: `lib/schema/*.json` (application-schema, external-datasource.schema, external-system.schema, infrastructure-schema), `lib/schema/env-config.yaml`

### Templates
- **Templates**: `templates/` directory (organized by type: typescript, python, infra, github, external-system)

## Notes

- **Existing Plans**: If a plan file matching pattern `*-fix-and-improve-code.<category>.plan.md` already exists, it will be updated rather than creating a new one
- **New Plans**: If no existing plan is found, a new plan is created with sequential numbering (starting from biggest number in plan folder plus 1). New plans are **code improvement plans and execution** - they should be executed automatically without user input or progress updates, unless breaking changes or other critical reasons require user confirmation
- **Execution**: Do NOT ask the user for input or show what's being done unless necessary for breaking changes or other critical reasons. The command should execute improvements silently and automatically
- Each category gets its own plan file
- Plans include actionable tasks with specific file locations and line numbers where applicable
- Plans reference specific cursor rules that are violated
- Focus is on `lib/` as the primary target, but all core code is analyzed
- The command prioritizes code reuse violations as they are critical for maintainability
- When updating existing plans, the command preserves the plan number and updates the content with the latest analysis
- All analysis should follow the patterns defined in `.cursor/rules/project-rules.mdc`
- Security and ISO 27001 compliance are critical - all plans must address security concerns
- File size limits (≤500 lines per file, ≤50 lines per function) must be checked and enforced
