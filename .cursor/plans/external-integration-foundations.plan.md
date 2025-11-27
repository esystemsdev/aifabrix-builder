<!-- cddaf008-1150-4857-ab25-57954f267df3 4caa29b0-393a-44df-a6bf-93ed980a2ef2 -->
# Phase 1: External Integration Validation and Deployment

## Overview

Implement validation, comparison, and deployment commands for external systems and datasources. Commands follow the existing app command pattern and integrate with Miso Controller and Dataplane APIs.

## Current State

- ✅ `external-system.schema.json` - Complete schema (draft-07)
- ✅ `external-datasource.schema.json` - Complete schema (draft-2020-12)
- ✅ `application-schema.json` - Includes `externalIntegration` block
- ✅ Existing validation infrastructure (`lib/validator.js`, AJV, error formatting)
- ✅ Existing API utilities (`lib/utils/api.js`, authentication patterns)

## Tasks

### Task 1.1: Schema Resolution Utilities

#### 1.1.1: Create schema resolver

**File**: `lib/utils/schema-resolver.js`

- [ ] Implement `resolveSchemaBasePath(appName)`:
  - Load `builder/{appName}/variables.yaml`
  - Extract `externalIntegration.schemaBasePath`
  - Resolve relative path from variables.yaml location
  - Support absolute paths
  - Validate path exists
  - Return resolved absolute path

- [ ] Implement `resolveExternalFiles(appName)`:
  - Resolve schemaBasePath
  - Resolve `systems[]` file paths (relative to schemaBasePath)
  - Resolve `dataSources[]` file paths (relative to schemaBasePath)
  - Validate all files exist
  - Return array of resolved file paths with metadata (type: 'system' | 'datasource')

- [ ] Add error handling with clear messages
- [ ] Use `path.join()` for cross-platform compatibility
- [ ] Follow JSDoc documentation standards

#### 1.1.2: Create schema loader

**File**: `lib/utils/schema-loader.js`

- [ ] Implement `loadExternalSystemSchema()`:
  - Load `lib/schema/external-system.schema.json`
  - Compile with AJV
  - Cache compiled validator
  - Return validator function

- [ ] Implement `loadExternalDataSourceSchema()`:
  - Load `lib/schema/external-datasource.schema.json`
  - Compile with AJV
  - Cache compiled validator
  - Return validator function

- [ ] Implement `detectSchemaType(filePath, content)`:
  - Auto-detect schema type from file content or naming
  - Return 'application' | 'external-system' | 'external-datasource'
  - Handle JSON parsing errors

### Task 1.2: Main Validation Command

#### 1.2.1: Implement validate command

**File**: `lib/validate.js`

- [ ] Implement `validateAppOrFile(appOrFile)`:
  - Detect if input is app name or file path
  - If app name:
    - Call existing `validateApplication(appName)` from `lib/validator.js`
    - If `externalIntegration` block exists:
      - Use schema resolver to find external files
      - Validate each external-system.json file
      - Validate each external-datasource.json file
      - Aggregate all validation results
  - If file path:
    - Load file content
    - Detect schema type using `detectSchemaType()`
    - Load appropriate schema and validate
    - Return validation result

- [ ] Use existing `formatValidationErrors` from `lib/utils/error-formatter.js`
- [ ] Display validation results with clear success/error messages
- [ ] Return structured result object

**File**: `lib/cli.js`

- [ ] Add command to `setupCommands()`:
  ```javascript
  program.command('validate <appOrFile>')
    .description('Validate application or external integration file')
    .action(async(appOrFile, options) => {
      try {
        const result = await validateAppOrFile(appOrFile);
        // Display results and exit appropriately
      } catch (error) {
        handleCommandError(error, 'validate');
        process.exit(1);
      }
    });
  ```


### Task 1.3: Diff Command

#### 1.3.1: Implement diff command

**File**: `lib/diff.js`

- [ ] Implement `compareFiles(file1, file2)`:
  - Load both files (support JSON)
  - Parse JSON content
  - Perform deep comparison
  - Identify differences:
    - Added fields (with path)
    - Removed fields (with path)
    - Changed field values (with old/new values)
    - Version changes
  - Categorize changes:
    - Breaking changes (removed required fields, type changes)
    - Non-breaking changes (added optional fields, value changes)
  - Return structured diff result

- [ ] Implement `formatDiffOutput(diffResult)`:
  - Display formatted diff output
  - Highlight breaking changes
  - Show version differences
  - Use chalk for colored output

- [ ] Return exit code 0 if identical, 1 if different

**File**: `lib/cli.js`

- [ ] Add command to `setupCommands()`:
  ```javascript
  program.command('diff <file1> <file2>')
    .description('Compare two configuration files (for deployment pipeline)')
    .action(async(file1, file2, options) => {
      try {
        const result = await compareFiles(file1, file2);
        // Display diff and exit appropriately
      } catch (error) {
        handleCommandError(error, 'diff');
        process.exit(1);
      }
    });
  ```


### Task 1.4: Datasource Command Group

#### 1.4.1: Create datasource command module

**File**: `lib/commands/datasource.js`

- [ ] Create command module following pattern from `lib/commands/app.js`
- [ ] Export `setupDatasourceCommands(program)` function
- [ ] Create nested command group:
  ```javascript
  const datasource = program
    .command('datasource')
    .description('Manage external data sources');
  ```


#### 1.4.2: Implement datasource validate

**File**: `lib/datasource-validate.js`

- [ ] Implement `validateDatasourceFile(filePath)`:
  - Load file content
  - Load `external-datasource.schema.json` using schema loader
  - Validate against schema
  - Use `formatValidationErrors` for error messages
  - Return validation result

**File**: `lib/commands/datasource.js`

- [ ] Add command:
  ```javascript
  datasource
    .command('validate <file>')
    .description('Validate external datasource JSON file')
    .action(async(file, options) => {
      try {
        const result = await validateDatasourceFile(file);
        // Display results
      } catch (error) {
        logger.error(chalk.red('❌ Validation failed:'), error.message);
        process.exit(1);
      }
    });
  ```


#### 1.4.3: Implement datasource list

**File**: `lib/datasource-list.js`

- [ ] Implement `listDatasources(options)`:
  - Get authentication (device token or credentials) - follow pattern from `lib/app-list.js`
  - Call controller API: `GET /api/v1/environments/{env}/datasources` (or similar endpoint)
  - Extract datasources from response (handle multiple response formats)
  - Display datasources in table format:
    - Key, Display Name, System Key, Version, Status
  - Use chalk for colored output
  - Handle API errors gracefully

**File**: `lib/commands/datasource.js`

- [ ] Add command:
  ```javascript
  datasource
    .command('list')
    .description('List datasources from environment')
    .requiredOption('-e, --environment <env>', 'Environment ID or key')
    .action(async(options) => {
      try {
        await listDatasources(options);
      } catch (error) {
        logger.error(chalk.red('❌ Failed to list datasources:'), error.message);
        process.exit(1);
      }
    });
  ```


#### 1.4.4: Implement datasource diff

**File**: `lib/datasource-diff.js`

- [ ] Implement `compareDatasources(file1, file2)`:
  - Reuse diff logic from `lib/diff.js`
  - Specialize for datasource comparison (for dataplane deployment)
  - Focus on fields relevant to dataplane:
    - fieldMappings changes
    - exposed fields changes
    - sync configuration changes
  - Display formatted diff output

**File**: `lib/commands/datasource.js`

- [ ] Add command:
  ```javascript
  datasource
    .command('diff <file1> <file2>')
    .description('Compare two datasource configuration files (for dataplane)')
    .action(async(file1, file2, options) => {
      try {
        await compareDatasources(file1, file2);
      } catch (error) {
        logger.error(chalk.red('❌ Diff failed:'), error.message);
        process.exit(1);
      }
    });
  ```


#### 1.4.5: Implement datasource deploy

**File**: `lib/datasource-deploy.js`

- [ ] Implement `getDataplaneUrl(controllerUrl, appKey, environment, authConfig)`:
  - Call controller API: `GET /api/v1/environments/{env}/applications/{appKey}`
  - Extract dataplane URL from application response
  - Handle API errors
  - Return dataplane URL

- [ ] Implement `deployDatasource(appKey, filePath, options)`:
  - Load and validate datasource file
  - Get authentication (similar to `getDeploymentAuth` from `lib/utils/token-manager.js`)
  - Get dataplane URL from controller
  - Extract `systemKey` from datasource file
  - Deploy to dataplane:
    - POST to `http://<dataplane-url>/api/v1/pipeline/{systemKey}/deploy`
    - Send datasource configuration as request body
    - Use `authenticatedApiCall` from `lib/utils/api.js`
    - Create dummy/mock API call structure (since full specs not available)
  - Display deployment results
  - Handle errors gracefully

**File**: `lib/commands/datasource.js`

- [ ] Add command:
  ```javascript
  datasource
    .command('deploy <myapp> <file>')
    .description('Deploy datasource to dataplane')
    .requiredOption('--controller <url>', 'Controller URL')
    .requiredOption('-e, --environment <env>', 'Environment (miso, dev, tst, pro)')
    .action(async(myapp, file, options) => {
      try {
        await deployDatasource(myapp, file, options);
      } catch (error) {
        logger.error(chalk.red('❌ Deployment failed:'), error.message);
        process.exit(1);
      }
    });
  ```


#### 1.4.6: Register datasource commands

**File**: `bin/aifabrix.js`

- [ ] Import `setupDatasourceCommands`:
  ```javascript
  const { setupDatasourceCommands } = require('../lib/commands/datasource');
  ```

- [ ] Call in `initializeCLI()` after `setupAppCommands(program)`:
  ```javascript
  setupDatasourceCommands(program);
  ```


### Task 1.5: Testing

#### 1.5.1: Unit tests for schema resolver

**File**: `tests/lib/utils/schema-resolver.test.js`

- [ ] Test absolute path resolution
- [ ] Test relative path resolution
- [ ] Test missing files
- [ ] Test invalid paths
- [ ] Test with different application locations
- [ ] Mock fs operations

#### 1.5.2: Unit tests for validation

**File**: `tests/lib/validate.test.js`

- [ ] Test app name validation (with externalIntegration)
- [ ] Test app name validation (without externalIntegration)
- [ ] Test file path validation (external-system)
- [ ] Test file path validation (external-datasource)
- [ ] Test file path validation (application)
- [ ] Test error cases (missing files, invalid JSON)

#### 1.5.3: Unit tests for diff

**File**: `tests/lib/diff.test.js`

- [ ] Test identical files
- [ ] Test different files
- [ ] Test breaking changes detection
- [ ] Test version comparison
- [ ] Test error cases

#### 1.5.4: Unit tests for datasource commands

**File**: `tests/lib/datasource-validate.test.js`

**File**: `tests/lib/datasource-list.test.js`

**File**: `tests/lib/datasource-diff.test.js`

**File**: `tests/lib/datasource-deploy.test.js`

- [ ] Test each command with valid inputs
- [ ] Test each command with invalid inputs
- [ ] Mock API calls
- [ ] Test error handling

#### 1.5.5: Integration tests

**File**: `tests/integration/external-validation.test.js`

- [ ] Test end-to-end validation flow
- [ ] Test with real example configurations
- [ ] Test path resolution with actual file structure
- [ ] Test error cases

## Deliverables

1. **Utility Modules**:

   - `lib/utils/schema-resolver.js` - Path resolution
   - `lib/utils/schema-loader.js` - Schema loading and detection

2. **Main Commands**:

   - `lib/validate.js` - Main validation command
   - `lib/diff.js` - Diff command
   - Updates to `lib/cli.js` - Command registration

3. **Datasource Commands**:

   - `lib/commands/datasource.js` - Command group
   - `lib/datasource-validate.js` - Validation
   - `lib/datasource-list.js` - List datasources
   - `lib/datasource-diff.js` - Compare datasources
   - `lib/datasource-deploy.js` - Deploy to dataplane
   - Updates to `bin/aifabrix.js` - Command registration

4. **Test Files**:

   - Unit tests for all modules
   - Integration tests

## Acceptance Criteria

- All commands work from any directory
- Validation detects schema type automatically
- ExternalIntegration block validation works end-to-end
- Path resolution handles edge cases (absolute, relative, missing files)
- Error messages are clear and actionable
- All commands have proper exit codes (0 = success, 1 = errors)
- Datasource deploy gets dataplane URL from controller
- API calls use dummy/mock structure (documented as placeholder)
- Code follows project patterns (CommonJS, JSDoc, error handling)
- All tests pass with 80%+ coverage

## Implementation Notes

- Follow existing patterns from `lib/commands/app.js` for command structure
- Follow existing patterns from `lib/app-list.js` for API calls
- Follow existing patterns from `lib/app-deploy.js` for deployment flow
- Use `authenticatedApiCall` from `lib/utils/api.js` for API requests
- Use `formatValidationErrors` from `lib/utils/error-formatter.js`
- Use chalk for colored CLI output
- Use logger from `lib/utils/logger.js`
- Keep functions under 50 lines, files under 500 lines
- Use try-catch for all async operations
- Validate all inputs
- Document API endpoints as placeholders until full specs available

### To-dos

- [ ] Create lib/utils/schema-resolver.js with resolveSchemaBasePath and resolveExternalFiles functions
- [ ] Create lib/utils/schema-loader.js with loadExternalSystemSchema, loadExternalDataSourceSchema, and detectSchemaType functions
- [ ] Create lib/validate.js with validateAppOrFile function and register command in lib/cli.js
- [ ] Create lib/diff.js with compareFiles function and register command in lib/cli.js
- [ ] Create lib/commands/datasource.js with setupDatasourceCommands function
- [ ] Create lib/datasource-validate.js and add validate command to datasource group
- [ ] Create lib/datasource-list.js and add list command to datasource group
- [ ] Create lib/datasource-diff.js and add diff command to datasource group
- [ ] Create lib/datasource-deploy.js with getDataplaneUrl and deployDatasource functions, add deploy command to datasource group
- [ ] Register datasource commands in bin/aifabrix.js by calling setupDatasourceCommands
- [ ] Write unit tests for schema-resolver.js covering path resolution edge cases
- [ ] Write unit tests for validate.js covering app and file validation scenarios
- [ ] Write unit tests for diff.js covering file comparison scenarios
- [ ] Write unit tests for all datasource command modules
- [ ] Write integration tests for end-to-end validation and deployment flows