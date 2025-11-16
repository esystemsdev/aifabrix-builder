<!-- 9f51efeb-6bfc-4bac-8724-156a8c783ff3 85bd8934-ee80-4e17-96e3-ba0e8fa6413a -->
# Add deploymentKey to Schema and Generate from JSON Manifest

## Overview

Add `deploymentKey` as a required field in the application schema and change the generation logic to compute the key from the JSON manifest itself (excluding the `deploymentKey` field), enabling Miso-controller to validate deployments by regenerating and comparing the key. Update `aifabrix genkey` command to generate JSON first, then extract the key from it.

## Changes Required

### 1. Update Application Schema (`lib/schema/application-schema.json`)

- Add `deploymentKey` to the `required` array (line 37)
- Add `deploymentKey` property definition:
- Type: `string`
- Pattern: `^[a-f0-9]{64} (64-character lowercase hex SHA256)
- Description: SHA256 hash of deployment manifest (excluding deploymentKey field)

### 2. Update Key Generator (`lib/key-generator.js`)

- Add new function `generateDeploymentKeyFromJson(deploymentObject)`:
- Accepts deployment manifest object
- Removes `deploymentKey` field if present
- Uses deterministic JSON stringification (sorted keys, no whitespace)
- Generates SHA256 hash
- Returns 64-character hex string

### 3. Update Generator (`lib/generator.js`)

- Modify `generateDeployJson()` function:
- Build deployment manifest WITHOUT `deploymentKey` initially
- Generate `deploymentKey` from the manifest object using new function
- Add `deploymentKey` to manifest
- Validate against schema (which now requires `deploymentKey`)
- Write to file

### 4. Update genkey Command (`lib/cli.js`)

- Modify `genkey` command handler (line 305-316):
- Call `generator.generateDeployJson(appName)` first to generate JSON
- Read the generated `aifabrix-deploy.json` file
- Extract `deploymentKey` from the JSON object
- Display the key with updated message indicating it's from JSON

### 5. Update Documentation

- `docs/CLI-REFERENCE.md` (line 1199-1221):
- Update description: "Generates deployment JSON first, then extracts deployment key"
- Update "What" section: "Generates aifabrix-deploy.json and extracts deploymentKey"
- Update output example to show "Generated from: builder/myapp/aifabrix-deploy.json"
- `docs/DEPLOYING.md` (line 630-633):
- Update "Generate Deployment Key" section to reflect JSON-based generation

### 6. Update Tests

- `tests/lib/deployer.test.js` - Update tests to expect `deploymentKey` in manifest
- `tests/integration/steps/step-05-genkey.test.js` - Update to verify JSON is generated first
- Update any other tests that use `genkey` command

## Implementation Details

### Key Generation Flow

1. Build complete deployment manifest (without `deploymentKey`)
2. Convert to deterministic JSON string (sorted keys, no whitespace)
3. Generate SHA256 hash → `deploymentKey`
4. Add `deploymentKey` to manifest
5. Validate complete manifest against schema
6. Write to `aifabrix-deploy.json`

### genkey Command Flow

1. Call `generateDeployJson(appName)` to create/update JSON file
2. Read `builder/<app>/aifabrix-deploy.json`
3. Parse JSON and extract `deploymentKey` field
4. Display key with source information

### Deterministic JSON Stringification

Use `JSON.stringify()` with sorted keys to ensure consistent hashing:

- Sort object keys alphabetically
- No whitespace/formatting
- Consistent property order

### Schema Validation

The schema will now require `deploymentKey`:

- Format: 64-character lowercase hexadecimal
- Pattern: `^[a-f0-9]{64}
- Required field in deployment JSON

## Files to Modify

1. `lib/schema/application-schema.json` - Add deploymentKey property and requirement
2. `lib/key-generator.js` - Add `generateDeploymentKeyFromJson()` function
3. `lib/generator.js` - Update generation flow to use JSON-based key generation
4. `lib/cli.js` - Update genkey command to generate JSON first
5. `docs/CLI-REFERENCE.md` - Update genkey command documentation
6. `docs/DEPLOYING.md` - Update deployment key generation documentation
7. `tests/lib/deployer.test.js` - Update tests for deploymentKey validation
8. `tests/integration/steps/step-05-genkey.test.js` - Update integration test

## Validation

- Schema validation will ensure `deploymentKey` is present and correctly formatted
- Miso-controller can validate by regenerating key from JSON (excluding deploymentKey field) and comparing
- genkey command will always generate fresh JSON before extracting key