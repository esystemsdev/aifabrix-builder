<!-- 9a8e56e6-2a13-45a7-bdfd-825a67f664ce adbcfaef-15fc-49fb-9ea2-f6af4ae588f4 -->
# External System Creation and Deployment

## Overview

External systems should be created using the same `aifabrix create` command pattern as regular applications, but with `--type external` flag. When type is "external", the system:

- Creates application structure (variables.yaml, etc.)
- Sets `app.type: "external"` in variables.yaml
- Generates external system and datasource JSON templates
- Sets up externalIntegration block automatically
- Skips Docker image building during deployment
- Deploys via pipeline API (system first, then all datasources automatically)

## Current State

- ✅ Application creation pattern exists (`lib/app.js`, `lib/app-prompts.js`)
- ✅ Template system exists (`templates/applications/`)
- ✅ Pipeline API documentation exists (`.cursor/plans/pipeline.md`)
- ✅ External system and datasource schemas exist
- ❌ No support for `--type external` flag
- ❌ No external system template generation
- ❌ Deployment doesn't handle external type (skips image building)
- ❌ No automatic pipeline deployment for external systems

## Tasks

### Task 1: Add External Type Support to Create Command

#### 1.1: Update CLI command definition

**File**: `lib/cli.js`

- [ ] Add `--type <type>` option to `create` command
- [ ] Validate type is one of: `webapp`, `api`, `service`, `functionapp`, `external`
- [ ] Pass type to `createApp` function

#### 1.2: Update application prompts

**File**: `lib/app-prompts.js`

- [ ] Add prompt for app type if not provided via flag
- [ ] When type is "external", skip prompts for:
  - Port (not needed for external systems)
  - Language (not needed for external systems)
  - Database/Redis/Storage (not needed for external systems)
- [ ] Add prompts for external system configuration:
  - System key (defaults to app name)
  - System display name
  - System description
  - System type (openapi, mcp, custom)
  - Authentication type (oauth2, apikey, basic)
  - Number of datasources to create

#### 1.3: Update variables.yaml generation

**File**: `lib/templates.js` (or `lib/app-config.js`)

- [ ] When type is "external", set `app.type: "external"` in variables.yaml
- [ ] Skip image, port, build, requires fields for external type
- [ ] Add externalIntegration block with:
  - `schemaBasePath: ./schemas`
  - `systems: []` (will be populated with template generation)
  - `dataSources: []` (will be populated with template generation)
  - `autopublish: true`
  - `version: 1.0.0`

### Task 2: Create External System Templates

#### 2.1: Create external system template directory

**File**: `templates/external-system/`

- [ ] Create directory structure:
  ```
  templates/external-system/
    external-system.json.hbs
    external-datasource.json.hbs
    README.md.hbs (optional)
  ```


#### 2.2: Create external-system.json template

**File**: `templates/external-system/external-system.json.hbs`

- [ ] Template should include:
  - `key`: `{{systemKey}}`
  - `displayName`: `{{systemDisplayName}}`
  - `description`: `{{systemDescription}}`
  - `type`: `{{systemType}}` (openapi, mcp, custom)
  - `enabled`: `true`
  - `environment.baseUrl`: placeholder
  - `authentication`: based on auth type
  - `openapi` or `mcp` or `custom` block based on type
  - `tags`: array

#### 2.3: Create external-datasource.json template

**File**: `templates/external-system/external-datasource.json.hbs`

- [ ] Template should include:
  - `key`: `{{systemKey}}-{{entityKey}}-{{operation}}`
  - `displayName`: `{{displayName}}`
  - `description`: `{{description}}`
  - `systemKey`: `{{systemKey}}`
  - `entityKey`: `{{entityKey}}`
  - `resourceType`: `{{resourceType}}` (customer, contact, person, document, deal)
  - `enabled`: `true`
  - `version`: `1.0.0`
  - `metadataSchema`: placeholder structure
  - `fieldMappings`: placeholder structure
  - `exposed`: placeholder structure
  - `openapi`: placeholder operations block

#### 2.4: Implement template generation logic

**File**: `lib/external-system-generator.js` (new file)

- [ ] Implement `generateExternalSystemTemplate(appName, config)`:
  - Load external-system.json.hbs template
  - Render with system configuration
  - Write to `builder/{appName}/schemas/{systemKey}.json`

- [ ] Implement `generateExternalDataSourceTemplate(appName, datasourceConfig)`:
  - Load external-datasource.json.hbs template
  - Render with datasource configuration
  - Write to `builder/{appName}/schemas/{datasourceKey}.json`

- [ ] Implement `generateExternalSystemFiles(appName, config)`:
  - Create `builder/{appName}/schemas/` directory
  - Generate external-system.json
  - Generate datasource JSON files based on config
  - Update variables.yaml externalIntegration block with file names

### Task 3: Integrate Template Generation into Create Flow

#### 3.1: Update createApp function

**File**: `lib/app.js`

- [ ] After generating config files, check if `config.type === 'external'`
- [ ] If external, call `generateExternalSystemFiles(appName, config)`
- [ ] Skip app file generation for external type
- [ ] Update success message to show external system creation

#### 3.2: Update app-config generation

**File**: `lib/app-config.js`

- [ ] Modify `generateConfigFiles` to handle external type:
  - Skip env.template generation (or create minimal one)
  - Skip rbac.yaml generation
  - Skip aifabrix-deploy.json generation (external systems use pipeline API)

### Task 4: Update Commands for External Systems

#### 4.1: Update app register command

**File**: `lib/app-register.js`

- [ ] Update `extractAppConfiguration` to handle external type:
  - If `app.type === 'external'`, set `appType: 'external'`
  - Skip port requirement for external type
  - Skip image requirement for external type
- [ ] Update registration data structure to handle external type
- [ ] Ensure external systems can be registered in miso-controller

#### 4.2: Update build command for external systems

**File**: `lib/build.js` or `lib/app.js`

- [ ] Check if app type is "external" before building
- [ ] If external, deploy to dataplane instead of Docker build:
  - Load variables.yaml
  - Extract externalIntegration block
  - Validate external system JSON file exists
  - Validate all datasource JSON files exist
  - Get authentication (device token or client credentials)
  - Deploy external system via `POST /api/v1/pipeline/deploy` (deploy, not publish)
  - For each datasource in externalIntegration.dataSources:
    - Deploy via `POST /api/v1/pipeline/{systemKey}/deploy` (deploy, not publish)
  - Display deployment results
  - This creates the "built" external system in dataplane

#### 4.3: Update run command for external systems

**File**: `lib/app-run.js`

- [ ] Check if app type is "external" before running
- [ ] If external, run OpenAPI test cases instead of Docker container:
  - Load external system JSON
  - Extract OpenAPI configuration
  - Run test cases against OpenAPI endpoints
  - Display test results
- [ ] If type is not "external", use existing Docker run flow

#### 4.4: Update dockerfile command

**File**: `lib/app-dockerfile.js` or `lib/cli.js`

- [ ] Check if app type is "external" before generating Dockerfile
- [ ] If external, display warning and skip:
  - "⚠️  External systems don't require Dockerfiles. Skipping..."
- [ ] If type is not "external", use existing Dockerfile generation

#### 4.5: Update push command

**File**: `lib/app-push.js`

- [ ] Check if app type is "external" before pushing
- [ ] If external, skip push and display message:
  - "External systems don't require Docker images. Skipping push..."
- [ ] If type is not "external", use existing push flow

#### 4.6: Create external system deployment module

**File**: `lib/external-system-deploy.js` (new file)

- [ ] Implement `buildExternalSystem(appName, options)`:
  - Load variables.yaml
  - Extract externalIntegration block
  - Validate external system JSON file exists
  - Validate all datasource JSON files exist
  - Get authentication (device token or client credentials)
  - Deploy external system via `POST /api/v1/pipeline/deploy` (deploy endpoint)
  - For each datasource in externalIntegration.dataSources:
    - Deploy via `POST /api/v1/pipeline/{systemKey}/deploy` (deploy endpoint)
  - Display deployment results
  - This is the "build" step (deploys to dataplane, not published)

- [ ] Implement `deployExternalSystem(appName, options)`:
  - Load variables.yaml
  - Extract externalIntegration block
  - Get authentication (device token or client credentials)
  - Publish external system via `POST /api/v1/pipeline/publish` (publish endpoint)
  - For each datasource in externalIntegration.dataSources:
    - Publish via `POST /api/v1/pipeline/{systemKey}/publish` (publish endpoint)
  - Display deployment results
  - This is the "deploy" step (publishes to dataplane)

- [ ] Implement `validateExternalSystemFiles(appName)`:
  - Check external system JSON exists
  - Validate against external-system.schema.json
  - Check all datasource JSONs exist
  - Validate each against external-datasource.schema.json
  - Return validation results

#### 4.7: Update deploy command

**File**: `lib/app-deploy.js`

- [ ] Check app type from variables.yaml
- [ ] If type is "external":
  - Call `deployExternalSystem(appName, options)` (publish endpoints)
  - Skip manifest generation
  - Skip image push
- [ ] If type is not "external", use existing deployment flow

### Task 5: Update Validation

#### 5.1: Update application schema

**File**: `lib/schema/application-schema.json`

- [ ] Add "external" to `app.type` enum values
- [ ] Make image, port, registryMode optional when type is "external"
- [ ] Ensure externalIntegration block is required when type is "external"

#### 5.2: Update validator

**File**: `lib/validator.js`

- [ ] Add validation logic for external type:
  - If type is "external", externalIntegration block is required
  - Image, port, build fields are not required for external type
  - External system JSON file must exist
  - All datasource JSON files must exist

### Task 6: Update Documentation

#### 6.1: Update CONFIGURATION.md

**File**: `docs/CONFIGURATION.md`

- [ ] Add section on external system creation
- [ ] Document `app.type: "external"` option
- [ ] Explain that external systems don't require:
  - Docker images
  - Port configuration
  - Build configuration
- [ ] Update externalIntegration section to clarify it's auto-generated for external type
- [ ] Add example variables.yaml for external system

#### 6.2: Update CLI-REFERENCE.md

**File**: `docs/CLI-REFERENCE.md`

- [ ] Document `--type external` flag in create command
- [ ] Add example: `aifabrix create hubspot --type external`
- [ ] Document that `aifabrix deploy` works for external systems (uses pipeline API)
- [ ] Document that `aifabrix build` is skipped for external systems

#### 6.3: Update QUICK-START.md

**File**: `docs/QUICK-START.md`

- [ ] Add section on creating external systems
- [ ] Show example workflow for external system creation and deployment

### Task 7: Testing

#### 7.1: Unit tests

**Files**: `tests/lib/external-system-generator.test.js`, `tests/lib/external-system-deploy.test.js`

- [ ] Test template generation for external system
- [ ] Test template generation for datasources
- [ ] Test deployment flow for external systems
- [ ] Test validation for external type
- [ ] Test that build is skipped for external type

#### 7.2: Integration tests

**File**: `tests/integration/external-system-create.test.js`

- [ ] Test end-to-end creation of external system
- [ ] Test that files are generated correctly
- [ ] Test that deployment works (mocked API calls)

## Deliverables

1. **Template Files**:

   - `templates/external-system/external-system.json.hbs`
   - `templates/external-system/external-datasource.json.hbs`

2. **New Modules**:

   - `lib/external-system-generator.js` - Template generation
   - `lib/external-system-deploy.js` - Pipeline API deployment

3. **Updated Modules**:

   - `lib/cli.js` - Add --type flag
   - `lib/app.js` - Handle external type in createApp
   - `lib/app-prompts.js` - Add external system prompts
   - `lib/app-config.js` - Skip unnecessary files for external type
   - `lib/app-deploy.js` - Route to external deployment
   - `lib/build.js` - Skip build for external type
   - `lib/validator.js` - Validate external type
   - `lib/schema/application-schema.json` - Add external type

4. **Documentation Updates**:

   - `docs/CONFIGURATION.md` - External system configuration
   - `docs/CLI-REFERENCE.md` - --type flag documentation
   - `docs/QUICK-START.md` - External system quick start

5. **Test Files**:

   - Unit tests for new modules
   - Integration tests for external system creation

## Acceptance Criteria

- `aifabrix create hubspot --type external` creates external system structure
- External system JSON template is generated in `builder/hubspot/schemas/`
- Datasource JSON templates are generated based on prompts
- `variables.yaml` has `app.type: "external"` and externalIntegration block
- `aifabrix app register hubspot --environment dev` registers external system in miso-controller (same as webapp)
- `aifabrix build hubspot` deploys external system to dataplane via `/api/v1/pipeline/deploy` (deploy, not publish)
- `aifabrix run hubspot` runs OpenAPI test cases for external systems
- `aifabrix dockerfile hubspot` shows warning and skips for external type
- `aifabrix push hubspot` skips for external type
- `aifabrix deploy hubspot` publishes to dataplane via `/api/v1/pipeline/publish` (system + datasources)
- All validation passes for external type
- Documentation is updated with examples
- All tests pass with 80%+ coverage

## Implementation Notes

- Follow existing patterns from `lib/app.js` for application creation
- Use Handlebars templates like other template files
- Pipeline API endpoints from `.cursor/plans/pipeline.md`:
  - **Build (deploy to dataplane)**: 
    - `POST /api/v1/pipeline/deploy` for external system
    - `POST /api/v1/pipeline/{systemKey}/deploy` for datasources
  - **Deploy (publish to dataplane)**:
    - `POST /api/v1/pipeline/publish` for external system
    - `POST /api/v1/pipeline/{systemKey}/publish` for datasources
- Use `authenticatedApiCall` from `lib/utils/api.js` for API requests
- External systems workflow:

  1. `create` - Creates structure and templates
  2. `app register` - Registers in miso-controller (same as webapp)
  3. `build` - Deploys to dataplane (not published yet)
  4. `run` - Runs OpenAPI test cases
  5. `dockerfile` - Shows warning, skips
  6. `push` - Skips
  7. `deploy` - Publishes to dataplane

- Keep functions under 50 lines, files under 500 lines
- Use JSDoc for all public functions
- Follow ISO 27001 security standards (no hardcoded secrets)

### To-dos

- [ ] Add --type flag to create command in lib/cli.js with validation for external type
- [ ] Update lib/app-prompts.js to add prompts for external system configuration (system key, display name, type, auth, datasources)
- [ ] Create templates/external-system/ directory with external-system.json.hbs and external-datasource.json.hbs templates
- [ ] Create lib/external-system-generator.js with functions to generate external system and datasource JSON files from templates
- [ ] Update lib/templates.js or lib/app-config.js to generate variables.yaml with app.type: external and externalIntegration block
- [ ] Update lib/app.js createApp function to call external system generator when type is external
- [ ] Update lib/app-config.js to skip env.template, rbac.yaml, and aifabrix-deploy.json generation for external type
- [ ] Update lib/build.js or lib/app.js to skip Docker build when app type is external
- [ ] Create lib/external-system-deploy.js with deployExternalSystem function that deploys system and datasources via pipeline API
- [ ] Update lib/app-deploy.js to route to external deployment when app type is external
- [ ] Update lib/schema/application-schema.json to add external to app.type enum and make image/port optional for external
- [ ] Update lib/validator.js to validate external type applications (require externalIntegration, skip image/port validation)
- [ ] Update docs/CONFIGURATION.md with external system creation section and app.type: external documentation
- [ ] Update docs/CLI-REFERENCE.md with --type external flag documentation and examples
- [ ] Update docs/QUICK-START.md with external system creation workflow example
- [ ] Write unit tests for lib/external-system-generator.js covering template generation
- [ ] Write unit tests for lib/external-system-deploy.js covering deployment flow
- [ ] Write integration tests for end-to-end external system creation and deployment