<!-- e42a60b6-2c8d-4380-bfcc-8f9bf5e5aa71 075c00d7-6cae-46d4-a3c1-c932fbae1892 -->
# External System Development Workflow Implementation

## Overview

Enhance the AI Fabrix Builder CLI to support a complete external system development workflow:

1. Download external systems from dataplane to local development structure
2. Unit testing (local validation without API calls)
3. Integration testing via dataplane pipeline API
4. Enhanced deployment using application-level workflow

## Phase 1: Download External System from Dataplane

### Implementation

**New File**: `lib/external-system-download.js`

**Command**: `aifabrix download <system-key>`

**Workflow**:

1. Download from dataplane API: `GET /api/v1/external/systems/{systemIdOrKey}/config`
2. Response contains:

   - `application` - External system configuration (matches external-system.schema.json)
   - `dataSources` - Array of datasource configurations (matches external-datasource.schema.json)

3. Download to temporary folder first
4. Validate system type from downloaded `application.type` field
5. Create `integration/<system-key>/` folder structure
6. Generate development files:

   - `variables.yaml` - Application configuration with externalIntegration block
   - `<system-key>-deploy.json` - External system definition (from `application`)
   - `<system-key>-deploy-<entity>.json` - Datasource files (from `dataSources` array, one per entity)
   - `env.template` - Environment variables template (extract kv:// references from auth config)
   - `README.md` - Documentation with setup instructions

**Key Functions**:

- `downloadExternalSystem(systemKey, options)` - Main download function
- `validateSystemType(application)` - Validate and determine system type
- `generateVariablesYaml(systemKey, application, dataSources)` - Generate variables.yaml
- `generateEnvTemplate(application)` - Extract env vars from auth config
- `generateReadme(systemKey, application, dataSources)` - Generate README.md

**Dependencies**:

- Use `getDataplaneUrl()` from `lib/datasource-deploy.js` to get dataplane URL
- Use `authenticatedApiCall()` from `lib/utils/api.js` for API calls
- Use `getDeploymentAuth()` from `lib/utils/token-manager.js` for authentication

## Phase 2: Extend External Data Source Schema

### Implementation

**File**: `lib/schema/external-datasource.schema.json`

**Change**: Add `testPayload` property to support test payloads for unit and integration testing.

**Location**: Add after `portalInput` property (around line 473, before closing brace)

**Schema Addition**:

```json
"testPayload": {
  "type": "object",
  "description": "Test payload configuration for unit and integration testing",
  "properties": {
    "payloadTemplate": {
      "type": "object",
      "description": "Sample payload matching the expected API response structure. Used for testing field mappings and metadata schema validation.",
      "additionalProperties": true
    },
    "expectedResult": {
      "type": "object",
      "description": "Expected normalized result after field mapping transformations (optional, for validation)",
      "additionalProperties": true
    }
  },
  "additionalProperties": false
}
```

## Phase 3: Unit Test Command (Local Validation)

### Implementation

**New File**: `lib/external-system-test.js`

**Command**: `aifabrix test <app> [--datasource <key>]`

**Workflow**:

1. Load and validate `variables.yaml` syntax
2. Load and validate system JSON file(s) against `external-system.schema.json`
3. Load and validate datasource JSON file(s) against `external-datasource.schema.json`
4. If `testPayload.payloadTemplate` exists in datasource:

   - Validate metadata schema against test payload
   - Test field mapping expressions (mock transformer, no real API calls)
   - Compare with `expectedResult` if provided

5. Validate relationships (systemKey matches, entityKey consistency)
6. Return structured test results

**Key Functions**:

- `testExternalSystem(appName, options)` - Main unit test function
- `validateFieldMappings(datasource, testPayload)` - Test field mapping expressions locally
- `validateMetadataSchema(datasource, testPayload)` - Validate metadata schema against payload
- `displayTestResults(results)` - Display formatted test results

**Validation Checks**:

- JSON syntax validation
- Schema validation (external-system.schema.json, external-datasource.schema.json)
- Field mapping expression syntax validation
- Metadata schema validation against test payload
- Required fields presence
- Relationship validation (systemKey, entityKey)

## Phase 4: Integration Test Command (Dataplane Pipeline API)

### Implementation

**File**: `lib/external-system-test.js` (extend existing file)

**Command**: `aifabrix test-integration <app> [--datasource <key>] [--payload <file>]`

**Workflow**:

1. Get dataplane URL from controller
2. For each datasource (or specified one):

   - Load test payload from datasource config (`testPayload.payloadTemplate`) or from `--payload` file
   - Call dataplane pipeline API: `POST /api/v1/pipeline/{systemKey}/{datasourceKey}/test`
   - Request body: `{ "payloadTemplate": <testPayload> }`
   - Parse response with validation results, field mapping results, endpoint test results

3. Display results for each datasource
4. Return aggregated results

**Key Functions**:

- `testExternalSystemIntegration(appName, options)` - Main integration test function
- `callPipelineTestEndpoint(systemKey, datasourceKey, payloadTemplate, dataplaneUrl, authConfig)` - Call pipeline test API
- `displayIntegrationTestResults(results)` - Display formatted integration test results

**Response Handling**:

- Parse `validationResults` (isValid, errors, warnings, normalizedMetadata)
- Parse `fieldMappingResults` (accessFields, mappedFields, mappingCount)
- Parse `endpointTestResults` (endpointConfigured, connectivity status)

## Phase 5: Enhanced Deploy Command

### Implementation

**File**: `lib/external-system-deploy.js` (modify existing)

**Current Behavior**: Individual publishing (publish system, then publish each datasource separately)

**New Behavior**: Use application-level deployment workflow for external systems

**Workflow**:

1. Generate `application-schema.json` using existing `generateExternalSystemApplicationSchema()` from `lib/generator.js`
2. Deploy via miso-controller (existing `deployApp()` function):

   - Controller handles: upload to dataplane → validate → publish
   - Uses application-schema.json structure

3. For datasource-only deployments (if needed in future):

   - Deploy directly to dataplane (miso doesn't know about datasources)
   - Use individual publishing: `POST /api/v1/pipeline/{systemKey}/publish`

**Key Changes**:

- Modify `deployExternalSystem()` to use application-level workflow
- Ensure `application-schema.json` is generated before deployment
- Use existing miso-controller deployment flow (upload → validate → publish)

**Note**: The user clarified that we always use application file (e.g., `hubspot-deploy.json` or `application-schema.json`) for deployment, so the application-level workflow is appropriate.

## CLI Commands

### Add to `lib/cli.js`:

```javascript
// Download external system
program.command('download <system-key>')
  .description('Download external system from dataplane to local development structure')
  .option('-e, --environment <env>', 'Environment (dev, tst, pro)', 'dev')
  .option('-c, --controller <url>', 'Controller URL')
  .action(async(systemKey, options) => {
    try {
      const download = require('./external-system-download');
      await download.downloadExternalSystem(systemKey, options);
    } catch (error) {
      handleCommandError(error, 'download');
      process.exit(1);
    }
  });

// Unit test (local validation)
program.command('test <app>')
  .description('Run unit tests for external system (local validation, no API calls)')
  .option('-d, --datasource <key>', 'Test specific datasource only')
  .action(async(appName, options) => {
    try {
      const test = require('./external-system-test');
      const results = await test.testExternalSystem(appName, options);
      test.displayTestResults(results);
      if (!results.valid) {
        process.exit(1);
      }
    } catch (error) {
      handleCommandError(error, 'test');
      process.exit(1);
    }
  });

// Integration test (via dataplane)
program.command('test-integration <app>')
  .description('Run integration tests via dataplane pipeline API')
  .option('-d, --datasource <key>', 'Test specific datasource only')
  .option('-p, --payload <file>', 'Path to custom test payload file')
  .option('-e, --environment <env>', 'Environment (dev, tst, pro)', 'dev')
  .option('-c, --controller <url>', 'Controller URL')
  .action(async(appName, options) => {
    try {
      const test = require('./external-system-test');
      const results = await test.testExternalSystemIntegration(appName, options);
      test.displayIntegrationTestResults(results);
      if (!results.success) {
        process.exit(1);
      }
    } catch (error) {
      handleCommandError(error, 'test-integration');
      process.exit(1);
    }
  });
```

## File Structure After Download

```
integration/
  <system-key>/
    variables.yaml                    # App configuration with externalIntegration block
    <system-key>-deploy.json         # External system definition
    <system-key>-deploy-<entity1>.json  # Datasource 1
    <system-key>-deploy-<entity2>.json  # Datasource 2
    env.template                     # Environment variables template
    README.md                        # Documentation
```

## Workflow Example

```bash
# 1. Download external system from dataplane
aifabrix download hubspot --environment dev

# 2. Edit configuration files in integration/hubspot/

# 3. Run unit tests (local validation)
aifabrix test hubspot

# 4. Run integration tests (via dataplane)
aifabrix test-integration hubspot

# 5. Deploy back to dataplane (via miso-controller)
aifabrix deploy hubspot --environment dev
```

## Testing Requirements

- Unit tests for download functionality
- Unit tests for test command (local validation)
- Unit tests for integration test command (mocked API calls)
- Integration tests for download workflow
- Schema validation tests for testPayload extension

## Documentation Updates

- Update `docs/EXTERNAL-SYSTEMS.md` with new commands
- Update `docs/CLI-REFERENCE.md` with command documentation
- Add examples for test payload configuration

## Error Handling

- Clear error messages for missing files, invalid configs, API failures
- Handle authentication errors gracefully
- Validate system type before moving files
- Handle missing test payloads gracefully (warn but don't fail)

## Security Considerations

- Never log secrets or sensitive data in test outputs
- Mask kv:// references in logs
- Validate all inputs before API calls
- Use secure temporary folder for downloads

### To-dos

- [ ] Create lib/external-system-download.js with download functionality (download to temp, validate type, move to integration/)
- [ ] Extend lib/schema/external-datasource.schema.json with testPayload property
- [ ] Create lib/external-system-test.js with unit test and integration test functions
- [ ] Add download, test, and test-integration commands to lib/cli.js
- [ ] Enhance lib/external-system-deploy.js to use application-level deployment workflow
- [ ] Add unit tests for download, test, and test-integration functionality
- [ ] Update docs/EXTERNAL-SYSTEMS.md and docs/CLI-REFERENCE.md with new commands