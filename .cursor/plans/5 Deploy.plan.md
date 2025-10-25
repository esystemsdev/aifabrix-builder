<!-- d9e26a25-77df-4bbc-8095-19a16624f268 f1d44fa4-4c30-4020-aeeb-33be6be9ec16 -->
# Deploy Functionality Implementation Plan

## Overview

Implement `aifabrix deploy myapp --controller https://controller.aifabrix.ai` to deploy applications via Miso Controller API. The implementation includes manifest generation, deployment key authentication, API communication, comprehensive testing, and ISO 27001 compliant security measures.

## Phase 1: Core Deployment Module (lib/deployer.js)

Create a new dedicated deployment module for Miso Controller API communication.

**File**: `lib/deployer.js` (new file, ~250 lines)

**Key Functions**:

- `deployToController(manifest, controllerUrl, options)` - Main deployment orchestrator
- `validateControllerUrl(url)` - Validate and sanitize controller URL (HTTPS only)
- `sendDeploymentRequest(url, manifest)` - HTTP POST to controller with axios
- `pollDeploymentStatus(deploymentId, controllerUrl)` - Monitor deployment progress
- `handleDeploymentError(error)` - Security-aware error handling

**Security Requirements**:

- HTTPS-only validation for controller URLs
- Request/response sanitization
- No secrets in logs (mask sensitive data)
- Structured error handling with audit logging
- Timeout and retry mechanisms with exponential backoff

**Example Implementation Snippet**:

```javascript
async function deployToController(manifest, controllerUrl, options = {}) {
  validateControllerUrl(controllerUrl);
  
  const endpoint = `${controllerUrl}/api/pipeline/deploy`;
  const response = await axios.post(endpoint, manifest, {
    headers: { 'Content-Type': 'application/json' },
    timeout: options.timeout || 30000
  });
  
  return response.data;
}
```

## Phase 2: JSON Generator Implementation (lib/generator.js)

Complete the deployment manifest generation from configuration files.

**Current State**: All functions have TODO comments (lines 34-135)

**Functions to Implement**:

1. `generateDeployJson(appName, options)` - Main orchestrator

   - Load variables.yaml from `builder/{appName}/`
   - Load env.template and parse environment variables
   - Load rbac.yaml for roles/permissions
   - Generate deployment key via key-generator
   - Merge all configurations into manifest
   - Write JSON to `builder/{appName}/aifabrix-deploy.json`
   - Return path to generated file

2. `mergeConfigurations(variables, environment, rbac, options)` - Configuration merger

   - Extract app metadata (key, displayName, description, type, port)
   - Convert environment to configuration array format
   - Add RBAC roles and permissions arrays
   - Include health check, authentication, database requirements
   - Return complete manifest object

3. `convertEnvironmentToConfig(environment, variables)` - Environment transformer

   - Parse env.template line by line
   - For each variable, determine location:
     - If value starts with `kv://` → location: "keyvault", value: key name
     - Otherwise → location: "variable", value: actual value
   - Set required: true for all variables
   - Return array format: `[{name, value, location, required}, ...]`

4. `validateDeployManifest(manifest)` - Manifest validator

   - Check required fields: key, image, port, displayName
   - Validate configuration array structure
   - Validate RBAC arrays (roles, permissions)
   - Return `{valid: boolean, errors: string[]}`

**Expected Manifest Format** (based on `builder/miso/aifabrix-deploy.json`):

```json
{
  "key": "myapp",
  "displayName": "My Application",
  "description": "Application description",
  "type": "webapp",
  "port": 3000,
  "image": "myacr.azurecr.io/myapp:latest",
  "deploymentKey": "sha256hash...",
  "registryMode": "acr",
  "requiresDatabase": true,
  "requiresRedis": true,
  "requiresStorage": false,
  "databases": [{"name": "myapp"}],
  "configuration": [
    {"name": "PORT", "value": "3000", "location": "variable", "required": true},
    {"name": "DATABASE_URL", "value": "databases-0-urlKeyVault", "location": "keyvault", "required": true}
  ],
  "roles": [...],
  "permissions": [...],
  "healthCheck": {"path": "/health", "interval": 30},
  "authentication": {"type": "keycloak", "enableSSO": true, "requiredRoles": ["user"]}
}
```

## Phase 3: Deploy Function Implementation (lib/app.js)

Implement the `deployApp` function that orchestrates the deployment process.

**File**: `lib/app.js` (line 189, update existing TODO function)

**Implementation** (~45 lines):

```javascript
async function deployApp(appName, options = {}) {
  // 1. Input validation
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required');
  }
  if (!options.controller) {
    throw new Error('Controller URL is required (--controller)');
  }
  
  // 2. Load application configuration
  const builderPath = path.join(process.cwd(), 'builder', appName);
  if (!fs.existsSync(builderPath)) {
    throw new Error(`Application '${appName}' not found in builder/`);
  }
  
  // 3. Generate deployment manifest
  console.log(`Generating deployment manifest for ${appName}...`);
  const manifestPath = await generator.generateDeployJson(appName, options);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // 4. Generate deployment key
  const deploymentKey = await keyGenerator.generateDeploymentKey(appName);
  console.log(`Deployment key: ${deploymentKey}`);
  
  // 5. Deploy to controller
  console.log(`Deploying to ${options.controller}...`);
  const deployer = require('./deployer');
  const result = await deployer.deployToController(manifest, options.controller, {
    environment: options.environment
  });
  
  // 6. Display results
  console.log(`✅ Deployment initiated successfully`);
  if (result.deploymentUrl) {
    console.log(`   URL: ${result.deploymentUrl}`);
  }
  if (result.deploymentId) {
    console.log(`   Deployment ID: ${result.deploymentId}`);
  }
  
  return result;
}
```

## Phase 4: CLI Command Integration (lib/cli.js)

Uncomment and enable the deploy command in the CLI.

**File**: `lib/cli.js` (lines 83-87)

**Change**: Uncomment the deploy command block:

```javascript
program.command('deploy <app>')
  .description('Deploy to Azure via Miso Controller')
  .option('-c, --controller <url>', 'Controller URL (required)')
  .option('-e, --environment <env>', 'Target environment (dev/tst/pro)')
  .action(async (appName, options) => {
    try {
      await _app.deployApp(appName, options);
    } catch (error) {
      handleCommandError(error, 'deploy');
      process.exit(6); // Exit code 6 for deployment failures
    }
  });
```

## Phase 5: Comprehensive Test Suite

Create complete test coverage following the 80% minimum requirement.

### Unit Tests

**File**: `tests/lib/deployer.test.js` (new file, ~400 lines)

Test coverage:

- `deployToController()` success scenarios
- HTTP error handling (401, 403, 500, network errors)
- Controller URL validation (reject HTTP, accept HTTPS)
- Request/response format validation
- Timeout handling
- Retry logic with exponential backoff
- Security: sensitive data masking in logs

**File**: `tests/lib/generator.test.js` (new file, ~450 lines)

Test coverage:

- `generateDeployJson()` with complete configuration
- `mergeConfigurations()` with various config combinations
- `convertEnvironmentToConfig()` with kv:// references
- `validateDeployManifest()` with valid/invalid manifests
- Environment variable parsing (simple values, kv:// refs, ${VAR} substitution)
- RBAC integration (roles and permissions arrays)
- Missing configuration file handling
- Database requirements mapping

**File**: `tests/lib/app.test.js` (update existing, lines 184-214)

Complete the deploy test stubs:

- Deploy with valid configuration
- Deploy with missing controller URL
- Deploy with invalid app name
- Deploy with missing builder/ directory
- Deploy monitoring and status reporting
- Error handling for controller failures

### Integration Tests

**File**: `tests/integration/deploy.test.js` (new file, ~300 lines)

End-to-end deployment flow tests:

- Complete deployment flow (manifest → key → API → result)
- Mock Miso Controller API responses
- Test with real configuration files from `builder/miso/`
- Validate generated manifest structure
- Test deployment key generation and inclusion
- Error propagation through the stack
- Security validations (HTTPS enforcement, input sanitization)

### Test Utilities

**File**: `tests/helpers/mock-controller.js` (new file, ~150 lines)

Mock Miso Controller for testing:

- Express server mock for controller endpoints
- Configurable responses (success/failure scenarios)
- Request validation
- Response format matching real controller

## Phase 6: Security Implementation (ISO 27001 Compliance)

### Input Validation

All user inputs validated before processing:

- Controller URL: HTTPS only, valid domain format
- App name: lowercase, dashes only, no path traversal
- Environment: enum validation (dev/tst/pro)

### Secure Communication

- HTTPS enforcement for controller URLs
- Certificate validation enabled
- Timeout configurations
- Request/response size limits

### Audit Logging

**File**: `lib/audit-logger.js` (new file, ~100 lines)

Structured logging for compliance:

- Log all deployment attempts (success/failure)
- Include timestamp, user context, app name, controller URL
- Mask sensitive data (secrets, keys, passwords)
- JSON format for log aggregation
- Log levels: INFO, WARN, ERROR, AUDIT

### Error Handling

Security-aware error messages:

- Never expose internal paths or configurations
- No secret values in error messages
- Structured error responses with actionable guidance
- Error codes for categorization

## Phase 7: Documentation Updates

### CLI Reference

**File**: `docs/CLI-REFERENCE.md` (lines 197-223)

Update the deploy section with implementation specifics:

- Add examples with real output
- Document error codes and troubleshooting
- Add environment-specific examples
- Include deployment key explanation

### Deploying Guide

**File**: `docs/DEPLOYING.md` (update as needed)

Add implementation notes:

- Manifest generation process details
- Deployment key usage and validation
- API endpoint documentation
- Security considerations
- Troubleshooting common issues

### README

**File**: `README.md`

Add deploy command to quick start examples with real usage patterns.

## File Size Compliance

All new files comply with 500-line limit:

- `lib/deployer.js`: ~250 lines
- `lib/generator.js`: ~450 lines (existing file, complete TODOs)
- `lib/audit-logger.js`: ~100 lines
- `tests/lib/deployer.test.js`: ~400 lines
- `tests/lib/generator.test.js`: ~450 lines
- `tests/integration/deploy.test.js`: ~300 lines
- `tests/helpers/mock-controller.js`: ~150 lines

## Implementation Order

1. Create `lib/audit-logger.js` for security logging
2. Complete `lib/generator.js` implementation
3. Create `lib/deployer.js` for API communication
4. Update `lib/app.js` deployApp function
5. Uncomment deploy command in `lib/cli.js`
6. Create all test files with comprehensive coverage
7. Update documentation files
8. Run build, lint, and test validation
9. Generate test coverage report (verify 80%+ coverage)

## Testing Strategy

Before completion, verify:

1. `npm run lint` - No errors
2. `npm test` - All tests pass (100% success rate)
3. `npm run test:ci` - Coverage report shows 80%+ for deploy modules
4. Manual testing with `builder/miso/` example application
5. Security review checklist completion

## Success Criteria

- Deploy command functional: `aifabrix deploy myapp --controller URL`
- Deployment manifest generation working from variables.yaml/env.template/rbac.yaml
- Deployment key generated and included in manifest
- HTTP communication with Miso Controller API
- All tests passing with 80%+ coverage
- Documentation updated with implementation details
- ISO 27001 security requirements met
- No linting errors
- File size limits respected (≤500 lines per file)

### To-dos

- [ ] Create lib/audit-logger.js for ISO 27001 compliant structured logging
- [ ] Complete lib/generator.js implementation (generateDeployJson, mergeConfigurations, convertEnvironmentToConfig, validateDeployManifest)
- [ ] Create lib/deployer.js for Miso Controller API communication with security measures
- [ ] Implement deployApp function in lib/app.js with full orchestration
- [ ] Uncomment and configure deploy command in lib/cli.js
- [ ] Create tests/lib/deployer.test.js with comprehensive unit tests
- [ ] Create tests/lib/generator.test.js with comprehensive unit tests
- [ ] Complete deploy test cases in tests/lib/app.test.js
- [ ] Create tests/integration/deploy.test.js for end-to-end testing
- [ ] Create tests/helpers/mock-controller.js for API testing
- [ ] Update docs/CLI-REFERENCE.md and docs/DEPLOYING.md with implementation details
- [ ] Run npm run build to ensure all dependencies resolved, linting passes, and tests pass with 80%+ coverage