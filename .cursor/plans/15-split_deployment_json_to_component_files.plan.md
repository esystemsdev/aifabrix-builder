# Split Deployment JSON to Component Files

## Overview

Create a new function `splitDeployJson()` in `lib/generator.js` that performs the reverse operation of `generateDeployJson()`. This function will read a deployment JSON file and extract its components into separate files:

- `env.template` - Environment variables template (from `configuration` array)
- `variables.yaml` - Application configuration (from deployment JSON metadata)
- `rbac.yml` - Roles and permissions (from `roles` and `permissions` arrays)
- `README.md` - Application documentation (generated from deployment JSON)

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Module structure, file organization, CommonJS patterns. Applies because we're adding functions to existing `lib/generator.js` module.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits (≤500 lines, ≤50 lines per function), JSDoc documentation. Applies because we're adding new functions that must comply with size limits and documentation requirements.
- **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory checks before commit. Applies to all plans - must include DoD requirements.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, coverage requirements. Applies because plan includes comprehensive test suite.
- **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, logging standards. Applies because functions must handle errors properly with meaningful messages.
- **[YAML Processing Pattern](.cursor/rules/project-rules.mdc#yaml-processing-pattern)** - js-yaml usage, error handling. Applies because we're converting JSON to YAML format (variables.yaml, rbac.yml).
- **[File Operations](.cursor/rules/project-rules.mdc#file-operations)** - Async file operations, path handling. Applies because we're reading deployment JSON and writing component files.
- **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Command patterns, user experience. Applies if optional CLI command is implemented.
- **[Input Validation](.cursor/rules/project-rules.mdc#input-validation)** - Parameter validation, file path validation. Applies because functions must validate inputs (file paths, JSON structure).
- **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - Secret management, data protection. Applies because we're handling deployment JSON that may contain sensitive references (kv://).

**Key Requirements**:

- Use CommonJS exports (`module.exports`)
- Keep files ≤500 lines and functions ≤50 lines
- Add JSDoc comments for all public functions with `@async`, `@param`, `@returns`, `@throws`
- Use `fs.promises` for async file operations
- Use `path.join()` for cross-platform path construction
- Use `js-yaml` with proper error handling for YAML generation
- Use try-catch for all async operations
- Provide meaningful error messages with context
- Never log secrets or sensitive data (kv:// references)
- Validate all function parameters (file paths, JSON structure)
- Write comprehensive tests with Jest (≥80% coverage)
- Use chalk for colored output in CLI (if CLI command is added)
- Follow Commander.js pattern for CLI command (if implemented)

## Before Development

- [ ] Read Architecture Patterns section from project-rules.mdc
- [ ] Review existing `lib/generator.js` module structure and patterns
- [ ] Review `parseEnvironmentVariables()` function to understand reverse conversion logic
- [ ] Review `lib/generator-builders.js` to understand how deployment JSON is built
- [ ] Review `lib/app-readme.js` for README generation patterns
- [ ] Review existing test files in `tests/lib/generator.test.js` for testing patterns
- [ ] Understand YAML generation patterns (js-yaml usage)
- [ ] Review image parsing logic in `lib/generator-builders.js` (`buildImageReference()`)
- [ ] Review error handling patterns in existing generator functions
- [ ] Understand file operation patterns (fs.promises, path.join)

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs lint + test:ci)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` or `npm run test:ci` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, functions ≤50 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments with `@fileoverview`, `@async`, `@function`, `@param`, `@returns`, `@throws`
7. **Code Quality**: All rule requirements met
8. **Security**: No hardcoded secrets, proper handling of kv:// references, never log sensitive data
9. **Input Validation**: All function parameters validated (file paths, JSON structure, app names)
10. **Error Handling**: All async operations wrapped in try-catch with meaningful error messages
11. **Test Coverage**: ≥80% coverage for all new functions
12. **Edge Cases**: All edge cases from plan are handled and tested
13. **CLI Command**: If CLI command is implemented, follows Commander.js pattern with proper error handling
14. All tasks completed

## Implementation Details

### 1. Create `splitDeployJson()` Function

**Location**: `lib/generator.js`**Function Signature**:

```javascript
/**
    * Splits a deployment JSON file into component files
    * @async
    * @function splitDeployJson
    * @param {string} deployJsonPath - Path to deployment JSON file
    * @param {string} outputDir - Directory to write component files (defaults to same directory as JSON)
    * @returns {Promise<Object>} Object with paths to generated files
    * @throws {Error} If JSON file not found or invalid
 */
async function splitDeployJson(deployJsonPath, outputDir = null)
```

**Key Operations**:

- Load and parse deployment JSON file
- Extract and convert `configuration` array → `env.template`
- Extract deployment metadata → `variables.yaml`
- Extract `roles` and `permissions` → `rbac.yml`
- Generate `README.md` from deployment JSON

### 2. Extract Configuration to env.template

**Function**: `extractEnvTemplate(configuration)`Convert the `configuration` array back to `env.template` format:

- Each config item: `{name, value, location, required}` → `KEY=VALUE`
- If `location === 'keyvault'`, prefix value with `kv://`
- Preserve comments and section headers (group by common prefixes like `DATABASE_`, `REDIS_`, etc.)
- Handle `${VAR}` references in values

**Example**:

```javascript
// Input: configuration array
[
  {name: "DATABASE_URL", value: "databases-miso-controller-0-urlKeyVault", location: "keyvault", required: true},
  {name: "PORT", value: "3000", location: "variable", required: false}
]

// Output: env.template
DATABASE_URL=kv://databases-miso-controller-0-urlKeyVault
PORT=3000
```



### 3. Extract Variables to variables.yaml

**Function**: `extractVariablesYaml(deployment)`Extract and structure deployment JSON into `variables.yaml` format:**Mapping**:

- `deployment.key` → `app.key`
- `deployment.displayName` → `app.displayName`
- `deployment.description` → `app.description`
- `deployment.type` → `app.type`
- `deployment.image` → Parse into `image.name`, `image.registry`, `image.tag`
- `deployment.registryMode` → `image.registryMode`
- `deployment.port` → `port`
- `deployment.requiresDatabase` → `requires.database`
- `deployment.requiresRedis` → `requires.redis`
- `deployment.requiresStorage` → `requires.storage`
- `deployment.databases` → `requires.databases`
- `deployment.healthCheck` → `healthCheck`
- `deployment.authentication` → `authentication` (sanitize type: `local` → `keycloak` if needed)
- `deployment.build` → `build`

**Image Parsing**:Parse full image string (e.g., `"devflowiseacr.azurecr.io/aifabrix/miso-controller:latest"`) into:

- `registry`: `"devflowiseacr.azurecr.io"`
- `name`: `"aifabrix/miso-controller"`
- `tag`: `"latest"`

**Function**: `parseImageReference(imageString)`

### 4. Extract RBAC to rbac.yml

**Function**: `extractRbacYaml(deployment)`Extract `roles` and `permissions` arrays directly from deployment JSON:

- `deployment.roles` → `roles` array
- `deployment.permissions` → `permissions` array
- Return `null` if both arrays are empty or missing

### 5. Generate README.md

**Function**: `generateReadmeFromDeployJson(deployment)`Generate a basic README.md with:

- Application name and description
- Quick start instructions
- Configuration overview
- Links to documentation

Use a simple template or reference `lib/app-readme.js` for consistency.

### 6. Add CLI Command (Optional)

**Location**: `lib/cli.js`Add a new command:

```javascript
program.command('app split-json <app-name>')
  .description('Split deployment JSON into component files (env.template, variables.yaml, rbac.yml, README.md)')
  .option('-o, --output <dir>', 'Output directory for component files')
  .action(async (appName, options) => {
    // Implementation
  });
```



## File Structure

```javascript
lib/
├── generator.js          # Add splitDeployJson() and helper functions
└── cli.js               # Add CLI command (optional)

New helper functions in generator.js:
- splitDeployJson()           # Main function
- extractEnvTemplate()        # Convert configuration array to env.template
- extractVariablesYaml()       # Convert deployment JSON to variables.yaml
- extractRbacYaml()            # Extract roles and permissions
- parseImageReference()       # Parse image string into components
- generateReadmeFromDeployJson() # Generate README.md
```



## Testing

**Location**: `tests/lib/generator-split.test.js`Test cases:

1. Split complete deployment JSON with all components
2. Split deployment JSON without rbac (roles/permissions)
3. Split deployment JSON with external registry mode
4. Handle missing optional fields gracefully
5. Validate generated files match expected formats
6. Test image parsing for various formats (with/without registry, with/without tag)

## Edge Cases

- Handle missing `build` section
- Handle missing `authentication` section
- Handle missing `healthCheck` section
- Handle `deploymentKey` field (should not be included in variables.yaml)
- Handle image strings without registry or tag
- Handle empty `configuration` array
- Handle `location` values other than `variable` or `keyvault`

## Dependencies

- `fs` (already used)
- `path` (already used)
- `yaml` (js-yaml, already used)
- `lib/app-readme.js` (for README generation, optional)

## Notes

- This is a reverse operation, so some information may be lost (e.g., comments in env.template)
- The generated `variables.yaml` may not match the original exactly, but should be functionally equivalent
- The `deploymentKey` field should be excluded from variables.yaml (it's generated, not configured)
- Image parsing should handle edge cases like images without registry or tag
- Security: Never log or expose kv:// secret references in error messages or logs

## Plan Validation Report

**Date**: 2024-12-19

**Plan**: Split Deployment JSON to Component Files

**Status**: ✅ VALIDATED

### Plan Purpose

**Summary**: Create a reverse conversion function `splitDeployJson()` that splits a deployment JSON file (like `miso-controller-deploy.json`) back into component files: `env.template`, `variables.yaml`, `rbac.yml`, and `README.md`. This enables migration of existing deployment JSON files back to the component file structure.**Scope**:

- Core module (`lib/generator.js`) - Add reverse conversion functions
- Optional CLI command (`lib/cli.js`) - Add `app split-json` command
- Testing (`tests/lib/generator-split.test.js`) - Comprehensive test coverage

**Plan Type**: Development (Module feature addition with optional CLI command)**Key Components**:

- `lib/generator.js` - Main implementation
- `lib/cli.js` - Optional CLI command
- `tests/lib/generator-split.test.js` - Test suite
- Helper functions for parsing and conversion

### Applicable Rules

- ✅ **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Module structure, file organization, CommonJS patterns
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits, JSDoc documentation
- ✅ **[Quality Gates](.cursor/rules/project-rules.mdc#quality-gates)** - Mandatory checks before commit
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, coverage requirements
- ✅ **[Error Handling & Logging](.cursor/rules/project-rules.mdc#error-handling--logging)** - Error patterns, logging standards
- ✅ **[YAML Processing Pattern](.cursor/rules/project-rules.mdc#yaml-processing-pattern)** - js-yaml usage, error handling
- ✅ **[File Operations](.cursor/rules/project-rules.mdc#file-operations)** - Async file operations, path handling
- ✅ **[CLI Command Development](.cursor/rules/project-rules.mdc#cli-command-development)** - Command patterns, user experience (if CLI command is added)
- ✅ **[Input Validation](.cursor/rules/project-rules.mdc#input-validation)** - Parameter validation, file path validation
- ✅ **[Security & Compliance (ISO 27001)](.cursor/rules/project-rules.mdc#security--compliance-iso-27001)** - Secret management, data protection

### Rule Compliance

- ✅ **DoD Requirements**: Documented with BUILD → LINT → TEST validation order
- ✅ **File Size Limits**: Documented (≤500 lines, ≤50 lines per function)
- ✅ **JSDoc Documentation**: Documented as requirement for all public functions
- ✅ **Test Coverage**: ≥80% requirement documented
- ✅ **Error Handling**: Patterns documented
- ✅ **YAML Processing**: Patterns documented
- ✅ **File Operations**: Patterns documented
- ✅ **Security Considerations**: Documented (kv:// handling, no logging of secrets)
- ✅ **Input Validation**: Documented
- ✅ **CLI Command Patterns**: Documented (if CLI command is implemented)

### Plan Updates Made

- ✅ Added Rules and Standards section with all applicable rule references
- ✅ Added Before Development checklist
- ✅ Added Definition of Done section with mandatory requirements
- ✅ Enhanced Notes section with security considerations
- ✅ Fixed title formatting
- ✅ Added validation report

### Recommendations

- Plan is now production-ready with all required sections
- Ensure all helper functions stay within 50-line limit
- Consider splitting `splitDeployJson()` if it exceeds 50 lines
- Test image parsing thoroughly for various formats
- Ensure proper error messages include file paths for debugging