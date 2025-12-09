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

   - **Note**: Verify this endpoint exists in dataplane API. If not available, use alternative endpoint or document alternative approach.
   - **Alternative**: May need to use `GET /api/v1/pipeline/{systemIdOrKey}` or similar endpoint

2. Response contains:

   - `application` - External system configuration (matches external-system.schema.json)
   - `dataSources` - Array of datasource configurations (matches external-datasource.schema.json)

3. Download to temporary folder first
4. Validate downloaded data:

   - Validate system type from downloaded `application.type` field
   - Validate JSON structure against schemas before writing files
   - Handle partial downloads gracefully (if system downloads but datasources fail)

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
- `validateDownloadedData(application, dataSources)` - Validate JSON structure before writing
- `generateVariablesYaml(systemKey, application, dataSources)` - Generate variables.yaml
- `generateEnvTemplate(application)` - Extract env vars from auth config
- `generateReadme(systemKey, application, dataSources)` - Generate README.md
- `handlePartialDownload(systemKey, systemData, datasourceErrors)` - Handle partial download errors gracefully

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

**Note**: `testPayload` is optional (not required). Do not add it to the root `required` array. This allows datasources without test payloads to still be valid.

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
- Field mapping expression syntax validation:
  - Validate pipe-based DSL syntax: `{{path.to.field}} | toUpper | trim`
  - Ensure path is wrapped in `{{}}`
  - Validate transformation names (toUpper, toLower, trim, default, toNumber, etc.)
  - Check for proper pipe separator `|`
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
- `callPipelineTestEndpoint(systemKey, datasourceKey, payloadTemplate, dataplaneUrl, authConfig, timeout)` - Call pipeline test API with timeout
- `displayIntegrationTestResults(results, verbose)` - Display formatted integration test results
- `retryApiCall(fn, maxRetries, backoffMs)` - Retry API calls with exponential backoff

**Response Handling**:

- Parse `validationResults` (isValid, errors, warnings, normalizedMetadata)
- Parse `fieldMappingResults` (accessFields, mappedFields, mappingCount)
- Parse `endpointTestResults` (endpointConfigured, connectivity status)

## Phase 5: Enhanced Deploy Command

### Implementation

**File**: `lib/external-system-deploy.js` (modify existing)

**File**: `lib/generator.js` (add new function)

**Current Behavior**: Individual publishing (publish system, then publish each datasource separately)

**New Behavior**: Use application-level deployment workflow for external systems

**Workflow**:

1. Generate `application-schema.json` structure:

   - **New Function**: Create `generateExternalSystemApplicationSchema(appName)` in `lib/generator.js`
   - Function should:
     - Load system JSON file (`<system-key>-deploy.json`)
     - Load all datasource JSON files (`<system-key>-deploy-<entity>.json`)
     - Combine into application-schema.json format:
       ```json
       {
         "version": "1.0.0",
         "application": { /* external system JSON */ },
         "dataSources": [ /* array of datasource JSONs */ ]
       }
       ```

     - Validate against `application-schema.json` schema
     - Return path to generated file or in-memory object

2. Application-level deployment via dataplane API (not miso-controller):

   - **Step 1 - Upload**: `POST /api/v1/pipeline/upload` with application-schema.json structure
   - **Step 2 - Validate**: `POST /api/v1/pipeline/upload/{uploadId}/validate` to see changes before publishing
   - **Step 3 - Publish**: `POST /api/v1/pipeline/upload/{uploadId}/publish?generateMcpContract=true` for atomic publish

3. For datasource-only deployments (if needed in future):

   - Deploy directly to dataplane (miso doesn't know about datasources)
   - Use individual publishing: `POST /api/v1/pipeline/{systemKey}/publish`

**Key Changes**:

- **Create** `generateExternalSystemApplicationSchema(appName)` function in `lib/generator.js`:
  - Load system JSON from `<system-key>-deploy.json`
  - Load all datasource JSONs matching pattern `<system-key>-deploy-*.json`
  - Combine into application-schema.json structure
  - Validate against `lib/schema/application-schema.json`
  - Return application schema object (or write to temp file)
- Modify `deployExternalSystem()` in `lib/external-system-deploy.js`:
  - Replace individual publishing with application-level workflow
  - Add upload step: `POST /api/v1/pipeline/upload`
  - Add validation step: `POST /api/v1/pipeline/upload/{uploadId}/validate` (show changes, optional `--skip-validation`)
  - Add publish step: `POST /api/v1/pipeline/upload/{uploadId}/publish?generateMcpContract=true`
- Use dataplane API directly (not miso-controller) for application-level deployment
- Add `--skip-validation` flag to skip validation step and go straight to publish

**Note**: The user clarified that we always use application file (e.g., `hubspot-deploy.json` or `application-schema.json`) for deployment, so the application-level workflow is appropriate. The application-level workflow provides atomic transactions and rollback support.

## CLI Commands

### Add to `lib/cli.js`:

```javascript
// Download external system
program.command('download <system-key>')
  .description('Download external system from dataplane to local development structure')
  .option('-e, --environment <env>', 'Environment (dev, tst, pro)', 'dev')
  .option('-c, --controller <url>', 'Controller URL')
  .option('--dry-run', 'Show what would be downloaded without actually downloading')
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
  .option('-v, --verbose', 'Show detailed validation output')
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
  .option('-v, --verbose', 'Show detailed test output')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
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
- Add retry logic for transient API failures (3 retries with exponential backoff)
- Handle partial downloads gracefully (if system downloads but datasources fail, show clear error)
- Validate file paths to prevent directory traversal attacks
- Add structured error codes for programmatic error handling

## Security Considerations

- Never log secrets or sensitive data in test outputs
- Mask kv:// references in logs
- Validate all inputs before API calls (sanitize system keys, file paths)
- Use secure temporary folder for downloads
- Validate file paths to prevent directory traversal attacks
- Add input sanitization for system keys (alphanumeric, hyphens, underscores only)
- Add audit logging for download and test operations (use `lib/audit-logger.js`)
- Rate limiting for API calls (prevent abuse)

## Pre-Implementation Verification

### Critical Action Items

Before starting implementation, verify the following:

1. **Phase 1 - Download Endpoint**:

   - ✅ Verify `GET /api/v1/external/systems/{systemIdOrKey}/config` endpoint exists in dataplane API
   - ✅ If not available, identify alternative endpoint (e.g., `GET /api/v1/pipeline/{systemIdOrKey}`)
   - ✅ Document the actual endpoint and response structure
   - ✅ Test endpoint with sample system key to confirm response format

2. **Phase 5 - Application Schema Generation**:

   - ✅ Review `lib/schema/application-schema.json` structure
   - ✅ Verify schema supports external system + datasources structure
   - ✅ Plan implementation of `generateExternalSystemApplicationSchema()` function
   - ✅ Test schema validation with sample data

### Implementation Order

Recommended implementation order:

1. **Phase 2** - Schema extension (simplest, no dependencies)
2. **Phase 3** - Unit test command (local validation, no API calls)
3. **Phase 1** - Download command (after endpoint verification)
4. **Phase 4** - Integration test command (uses verified API endpoint)
5. **Phase 5** - Enhanced deploy command (most complex, depends on all previous phases)

### Testing Strategy

- Start with unit tests for each phase
- Mock API calls for integration test command
- Add integration tests after all phases complete
- Test error scenarios (missing files, invalid configs, API failures)
- Test edge cases (empty datasources, missing test payloads, partial downloads)