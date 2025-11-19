<!-- 61c8fbd8-a570-4164-bdf5-bca9719be47d e640e60f-b486-4c71-8722-f003cbe58136 -->
# Fix Variable Interpolation with Developer-ID Adjustment

## Problem

Currently, the code searches for `DB_PORT=`, `DATABASE_PORT=`, etc. in the generated .env file and replaces them. This is wrong. Instead, we should:

1. Apply developer-id adjustment to port variables from env-config.yaml (DB_PORT, REDIS_PORT, KEYCLOAK_PORT, etc.) BEFORE interpolation
2. Let `${VAR}` interpolation use the adjusted values naturally
3. Only handle static PORT variable replacement in adjustLocalEnvPortsInContent
4. Refactor adjustLocalEnvPortsInContent (currently 100+ lines) into smaller functions

## Current Flow

1. `buildEnvVarMap` loads env-config.yaml → creates envVars map
2. `interpolateEnvVars` replaces `${VAR}` in env.template using envVars
3. `replaceKvInContent` replaces `kv://` and interpolates `${VAR}` in secret values
4. `adjustLocalEnvPortsInContent` searches for `DB_PORT=` in file and replaces it ❌ WRONG

## Correct Flow

1. `buildEnvVarMap` loads env-config.yaml → creates envVars map
2. **Apply developer-id adjustment to port values in envVars for local context** ✅
3. `interpolateEnvVars` replaces `${VAR}` using adjusted envVars
4. `replaceKvInContent` replaces `kv://` and interpolates `${VAR}` in secret values using adjusted envVars
5. `adjustLocalEnvPortsInContent` only handles static PORT variable ✅

## Implementation Steps

1. **Modify `buildEnvVarMap` to apply developer-id adjustment for local context**

- Add optional developer-id parameter
- Apply adjustment to all `*_PORT` variables for local context (DB_PORT, REDIS_PORT, KEYCLOAK_PORT, etc.)
- Return adjusted envVars map
- This ensures `${VAR}` interpolation uses adjusted values

2. **Update `resolveKvReferences` to pass developer-id to `buildEnvVarMap`**

- Get developer-id when environment is 'local'
- Pass it to `buildEnvVarMap` so port values are adjusted before interpolation
- This ensures secrets with `${DB_PORT}` etc. get adjusted values

3. **Simplify `adjustLocalEnvPortsInContent` - only handle static PORT variable**

- Remove DB_PORT, DATABASE_PORT, REDIS_PORT replacement code (handled by interpolation now)
- Keep only PORT variable handling with override chain:
- env-config.yaml → environments.local.PORT
- config.yaml → environments.local.PORT
- variables.yaml → build.localPort (strongest)
- variables.yaml → port (fallback)
- Apply developer-id adjustment
- Remove rewriteInfraEndpoints call (no longer needed)

4. **Refactor `adjustLocalEnvPortsInContent` into smaller functions**

- Extract port calculation logic to `calculateAppPort(variablesPath, localEnv)`
- Extract localhost URL replacement to `updateLocalhostUrls(content, basePort, appPort)`
- Keep main function focused on orchestration (< 50 lines)

5. **Refactor `rewriteInfraEndpoints` into smaller functions**

- Extract getServicePort logic to separate function
- Extract host/port parsing to separate function
- Extract endpoint update logic to separate function
- Keep main function focused on orchestration (< 50 lines)

## Files to Modify

- `lib/utils/env-map.js` - Add developer-id adjustment to buildEnvVarMap
- `lib/secrets.js` - Pass developer-id to buildEnvVarMap in resolveKvReferences
- `lib/utils/secrets-helpers.js` - Simplify adjustLocalEnvPortsInContent, remove port replacements, refactor into smaller functions
- `lib/utils/env-endpoints.js` - Refactor rewriteInfraEndpoints into smaller functions

## Test Coverage Requirements

Based on DEVELOPER-ISOLATION.md scenarios, add comprehensive tests:

1. **PORT Override Chain Scenarios** (4 scenarios):

- All sources present (env-config.yaml → config.yaml → variables.yaml build.localPort)
- Only variables.yaml present
- Only variables.yaml port (no build.localPort)
- Only env-config.yaml present

2. **Infrastructure Port Override Scenarios**:

- DB_PORT override chain (env-config.yaml → config.yaml)
- REDIS_PORT override chain (env-config.yaml → config.yaml)

3. **Variable Interpolation with Developer-ID**:

- Secrets with ${VAR} references (e.g., KEYCLOAK_SERVER_URL=kv://key where secret value is "http://${KEYCLOAK_HOST}:${KEYCLOAK_PORT}")
- Direct ${VAR} in env.template (e.g., KC_PORT=${KEYCLOAK_PORT})
- buildEnvVarMap applies developer-id adjustment to port variables before interpolation

4. **Complete End-to-End Scenarios**:

- Developer ID 1, Local Context - all variables
- Developer ID 2, Local Context - all variables
- Docker context (no developer-id adjustment for infra ports)

## Test Files to Add/Modify

- `tests/lib/utils/env-generation.test.js` - Add PORT override chain scenario tests
- `tests/lib/utils/env-map.test.js` - Add tests for buildEnvVarMap with developer-id adjustment (create if doesn't exist)
- `tests/lib/secrets.test.js` - Add tests for variable interpolation with developer-id adjusted ports

### To-dos

- [ ] Add direct DB_PORT update in adjustLocalEnvPortsInContent using adjusted dbPort value
- [ ] Verify rewriteInfraEndpoints correctly uses devPorts.postgres when provided
- [ ] Test that local .env has DB_PORT with developer-id adjustment and docker .env remains correct
- [ ] Modify buildEnvVarMap to apply developer-id adjustment to port variables for local context
- [ ] Update resolveKvReferences to pass developer-id to buildEnvVarMap for local environment
- [ ] Simplify adjustLocalEnvPortsInContent to only handle PORT variable with variables.yaml override chain
- [ ] Refactor adjustLocalEnvPortsInContent into smaller functions (extract port calculation, URL replacement)
- [ ] Refactor rewriteInfraEndpoints into smaller functions (extract getServicePort, host parsing, endpoint updates)
- [ ] Add tests for PORT override chain scenarios (4 scenarios from documentation)
- [ ] Add tests for infrastructure port override scenarios (DB_PORT, REDIS_PORT)
- [ ] Add tests for variable interpolation with developer-id adjusted ports (${VAR} in secrets and templates)
- [ ] Add tests for buildEnvVarMap with developer-id adjustment
- [ ] Add complete end-to-end scenario tests matching documentation tables