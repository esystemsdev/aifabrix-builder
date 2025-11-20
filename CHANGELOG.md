## [2.6.2] - 2025-11-20

### Added
- **Secrets Set Command**: New `aifabrix secrets set <key> <value> [--shared]` command
  - Dynamically set secret values in secrets files without manual file editing
  - Supports saving to user secrets file (`~/.aifabrix/secrets.local.yaml`) or general secrets file (from `config.yaml` `aifabrix-secrets`)
  - `--shared` flag saves to general secrets file for shared configuration across projects
  - Supports both full URLs (e.g., `https://mydomain.com/keycloak`) and environment variable interpolation (e.g., `https://${KEYCLOAK_HOST}:${KEYCLOAK_PORT}`)
  - Automatically creates secrets file and directory structure if they don't exist
  - Merges with existing secrets without overwriting other keys
  - Sets proper file permissions (0o600 - owner read/write only) for ISO 27001 compliance
- **Extended Local Secrets Utilities**
  - New `saveSecret(key, value, secretsPath)` function in `lib/utils/local-secrets.js` for flexible path support
  - Supports both absolute and relative paths for general secrets files
  - Maintains backward compatibility with existing `saveLocalSecret()` function

### Changed
- **Secrets Management**: Enhanced secret management capabilities
  - Command handler in `lib/commands/secrets-set.js` with comprehensive validation
  - Path resolution for general secrets files (absolute vs relative paths)
  - Improved error handling with user-friendly messages

### Technical
- New command handler module: `lib/commands/secrets-set.js`
- Extended `lib/utils/local-secrets.js` with `saveSecret()` function
- Comprehensive test coverage: 19 test cases covering validation, path resolution, error handling, and edge cases
- Full JSDoc documentation for all public functions
- ISO 27001 compliant implementation with proper file permissions and secure handling

## [2.6.0] - 2025-11-19

### Added
- **JSON-Based Deployment Key Generation**
  - Deployment keys are now generated from the complete deployment manifest JSON (excluding the `deploymentKey` field itself)
  - New `generateDeploymentKeyFromJson()` function in `lib/key-generator.js` for manifest-based key generation
  - Deterministic JSON stringification with sorted keys ensures consistent hashing across environments
  - Enables Miso Controller to validate deployments by regenerating and comparing the key
  - Keys are SHA256 hashes of the complete deployment configuration for integrity verification
- **Deployment Key Validation**
  - New `validateDeploymentKey()` function to verify key format (64-character lowercase hex SHA256)
  - Key validation ensures proper format before deployment operations
- **Deployment Key Schema Requirement**
  - `deploymentKey` is now a required field in the application schema (`lib/schema/application-schema.json`)
  - Schema enforces 64-character lowercase hexadecimal pattern: `^[a-f0-9]{64}$`
  - All generated deployment JSON files must include a valid `deploymentKey`

### Changed
- **Deployment Key Generation Flow**
  - `aifabrix genkey` command now generates `aifabrix-deploy.json` first, then extracts the `deploymentKey` from it
  - Deployment key is computed from the complete manifest object rather than just `variables.yaml` content
  - Key generation uses deterministic JSON serialization (sorted keys, no whitespace) for consistency
  - Updated command output to show source file: "Generated from: builder/myapp/aifabrix-deploy.json"
- **Deployment JSON Generation**
  - `lib/generator.js` now builds the complete manifest first, then generates `deploymentKey` from it
  - `deploymentKey` is added to the manifest after generation, ensuring it's excluded from the hash calculation
  - Manifest validation occurs after `deploymentKey` is added to ensure schema compliance
- **Key Generator Module**
  - Enhanced `lib/key-generator.js` with JSON-based key generation capabilities
  - Added `sortObjectKeys()` helper function for deterministic object serialization
  - Maintains backward compatibility with `generateDeploymentKey()` and `generateDeploymentKeyFromContent()` functions
  - New `generateDeploymentKeyFromJson()` function for manifest-based generation

### Technical
- Deterministic JSON stringification ensures consistent deployment keys across different systems
- Recursive key sorting for nested objects and arrays maintains hash consistency
- Deployment key excludes itself from hash calculation to prevent circular dependencies
- Schema validation enforces deployment key format and presence in all deployment manifests
- Improved deployment integrity verification through manifest-based key generation

## [2.5.3] - 2025-11-19

### Added
- **Automatic Server Registration for pgAdmin4**
  - PostgreSQL server automatically registered in pgAdmin4 on first launch
  - New `templates/infra/servers.json.hbs` template for pgAdmin4 server configuration
  - Automatic generation of `servers.json` and `pgpass` files during infrastructure startup
  - Files are copied into pgAdmin4 container using `docker cp` to avoid Docker bind mount issues
  - Server appears as "PostgreSQL (pgvector)" in pgAdmin4 interface
  - Uses `PassFile` for secure password storage (ISO 27001 compliant)
- **Automatic Server Registration for Redis Commander**
  - Redis server automatically registered in Redis Commander on startup
  - Updated `REDIS_HOST` format to include database number: `local:redis:6379:0:`
  - Redis connection appears as "local" in Redis Commander interface
  - No manual configuration required

### Changed
- **Infrastructure File Generation**
  - `lib/infra.js` now generates `servers.json` and `pgpass` files before starting containers
  - Files are generated from Handlebars templates with PostgreSQL password from admin-secrets.env
  - Added `generatePgAdminConfig()` helper function for cleaner code organization
  - Files are automatically copied into containers after startup to ensure they're available
- **Redis Commander Configuration**
  - Updated `lib/secrets.js` to use correct `REDIS_HOST` format: `local:redis:6379:0:`
  - Format includes database index (0) for proper Redis Commander registration
- **Docker Compose Template**
  - Updated `templates/infra/compose.yaml.hbs` with pgAdmin4 environment variables
  - Added `PGADMIN_SERVER_JSON_FILE` and `PGPASSFILE` environment variables
  - Mounts infra directory to `/host-config` for file access
  - Command override to copy files into container on startup

### Fixed
- **File Size Compliance**
  - Reduced `lib/infra.js` from 523 lines to 478 lines (under 500 line limit)
  - Extracted `generatePgAdminConfig()` helper function
  - Consolidated comments and removed unnecessary blank lines
  - All files now comply with code quality standards

### Technical
- New `generatePgAdminConfig()` function in `lib/infra.js` for pgAdmin4 file generation
- Automatic file copying using `docker cp` after container startup
- Handlebars template for pgAdmin4 server configuration
- Improved error handling for file copy operations
- ISO 27001 compliant password handling using `PassFile` instead of plaintext passwords

## [2.5.0] - 2025-11-16

### Added
- **New CLI Command: `aifabrix down [app] --volumes`**
  - Stop and remove a specific application container: `aifabrix down myapp`
  - Optionally remove the app's named Docker volume: `aifabrix down myapp --volumes`
  - Preserves `builder/<app>` and `apps/<app>` files (no file deletions)
  - Handles developer-specific volume naming (dev0 vs dev{id} patterns)
  - New module: `lib/app-down.js` with comprehensive container and volume management
- **Environment Configuration System**
  - New `lib/utils/env-config-loader.js` utility for loading and merging environment configurations
  - Supports base config from `lib/schema/env-config.yaml` with user overrides from `~/.aifabrix/config.yaml`
  - Deep merging of environment variables for `local` and `docker` contexts
  - Configurable via `aifabrix-env-config` key in `config.yaml`
- **Environment Port Management**
  - New `lib/utils/env-ports.js` utility for updating container PORT values
  - Automatic developer-id offset calculation: `finalPort = basePort + (developerId * 100)`
  - Supports both environment variable and config file developer-id sources
  - Updates `.env` files in running containers with correct port values
- **Environment Endpoint Rewriting**
  - Enhanced `lib/utils/env-endpoints.js` with `rewriteInfraEndpoints()` function
  - Dynamic service endpoint rewriting based on environment context (local vs docker)
  - Infrastructure ports (Postgres, Redis) automatically adjusted for developer-id
  - Uses `getEnvHosts()` to get service values from env-config system
  - Supports config.yaml overrides for environment-specific endpoints
- **Token Management System**
  - New `lib/utils/token-manager.js` module for centralized token management
  - Device token management with automatic refresh via refresh tokens
  - Client token management with automatic refresh using client credentials
  - Priority-based authentication: Device token → Client token → Client credentials
  - Token expiration checking and automatic refresh on 401 errors
  - Client credentials loading from `~/.aifabrix/secrets.local.yaml`
  - Token storage in `~/.aifabrix/config.yaml` with expiration tracking
- **Image Name Utilities**
  - New `lib/utils/image-name.js` utility for developer-scoped Docker image names
  - Format: `<base>-dev<developerId>` for developer builds
  - Special handling for dev0: uses `<base>-extra` format
  - Ensures consistent local build naming across developer environments
- **Secrets Helpers Enhancement**
  - New `lib/utils/secrets-helpers.js` with comprehensive secrets and environment processing
  - Port offset handling for local and docker environments
  - Environment variable interpolation with `${VAR}` syntax support
  - Missing secrets detection and reporting
  - URL port resolution for Docker environment context
  - Hostname-to-service mapping for container-to-container communication
- **Comprehensive Test Coverage**
  - New test suite: `tests/lib/utils/env-generation.test.js` (1,454+ lines)
  - New test suite: `tests/lib/utils/env-ports.test.js` (444+ lines)
  - New test suite: `tests/lib/utils/env-config-loader.test.js` (202+ lines)
  - New test suite: `tests/lib/utils/token-manager.test.js` (252+ lines)
  - New test suite: `tests/lib/utils/image-name.test.js` (35+ lines)
  - New test suite: `tests/lib/utils/secrets-helpers.port-offset.test.js` (152+ lines)
  - New test suite: `tests/lib/utils/secrets-helpers.test.js` (117+ lines)
  - Expanded tests for environment generation, port handling, and token management

### Changed
- **Environment Generation Flow**
  - Fixed local `.env` file generation to use correct PORT from `build.localPort` or `port` in `variables.yaml`
  - Fixed local `.env` file to use correct infrastructure endpoints (e.g., `redis://dev.aifabrix:6379` instead of `redis://redis:6379`)
  - Implemented clear override chain for environment variables:
    1. Base config from `lib/schema/env-config.yaml`
    2. User config from `~/.aifabrix/config.yaml` → `aifabrix-env-config` file
    3. Application config from `variables.yaml`
    4. Developer-id adjustment: `finalPort = basePort + (developerId * 100)`
  - Local environment: Uses `build.localPort` (or `port` fallback) with developer-id offset
  - Docker environment: Uses `port` from `variables.yaml` with developer-id offset
  - Infrastructure ports (Postgres, Redis) now correctly use base ports + developer-id offset
- **Secrets Resolution**
  - Enhanced `lib/secrets.js` with improved environment transformations
  - `updatePortForDocker()` now follows proper override chain: env-config → config.yaml → variables.yaml → developer-id
  - `adjustLocalEnvPortsInContent()` correctly reads `build.localPort` with fallback to `port`
  - Improved port resolution for URLs in Docker environment context
- **Build and Template Pipeline**
  - Enhanced `lib/build.js` with improved environment file generation
  - Updated `lib/templates.js` for better template rendering
  - Improved `lib/env-reader.js` for environment variable processing
  - Enhanced `lib/utils/build-copy.js` for file operations
  - Updated `lib/utils/paths.js` for path resolution
- **Infrastructure Templates**
  - Updated `templates/infra/compose.yaml.hbs` with improved developer-id handling
  - Generated `templates/infra/compose.yaml` now correctly uses numeric devId
- **Application Templates**
  - Updated `templates/applications/miso-controller/env.template` with correct environment variables
- **API Authentication**
  - Enhanced `lib/utils/api.js` with automatic token refresh on 401 errors
  - `authenticatedApiCall()` now automatically refreshes device tokens when expired
  - Improved error handling for authentication failures
- **Configuration Management**
  - Extended `lib/config.js` to support environment config file paths
  - Added `getAifabrixEnvConfigPath()` for loading user env-config files
  - Enhanced token storage with expiration tracking for device and client tokens
- **Documentation Updates**
  - Updated `docs/BUILDING.md` with environment generation details
  - Updated `docs/CONFIGURATION.md` with env-config system documentation
  - Updated `docs/DEVELOPER-ISOLATION.md` with port handling clarifications
  - Updated `docs/CLI-REFERENCE.md` with `down` command documentation
  - Updated `docs/DEPLOYING.md` with token management and authentication details
  - Updated `docs/INFRASTRUCTURE.md`, `docs/RUNNING.md`, `docs/GITHUB-WORKFLOWS.md`, and `docs/QUICK-START.md`
- **Test Suite Updates**
  - Expanded and updated tests across `tests/lib/*.test.js` modules
  - Updated `tests/lib/utils/*.test.js` with new utility test coverage
  - Enhanced test fixtures for environment generation scenarios
  - Improved test coverage for secrets resolution and port handling

### Technical
- **78 files changed** with 6,453 insertions and 1,700 deletions
- Modular architecture improvements with focused utility modules
- Improved separation of concerns for environment generation, port management, and token handling
- Enhanced error handling and validation throughout the codebase
- Comprehensive test coverage for all new features and improvements
- ISO 27001 compliant implementation maintained throughout

## [2.4.0] - 2025-11-14

### Changed
- Centralized configuration for home and secrets paths in `config.yaml`:
  - New keys: `aifabrix-home` (base directory), `aifabrix-secrets` (default secrets file)
  - All path resolution now derives from `config.yaml` (single source of truth)
- Secrets resolution precedence clarified and enforced:
  1) User-local: `<home>/secrets.local.yaml` (highest)
  2) App build secrets: `builder/<app>/variables.yaml` → `build.secrets` (fills only missing keys)
  3) Default fallback: `<home>/secrets.yaml`

### Removed
- Environment variable overrides `AIFABRIX_HOME` and `AIFABRIX_SECRETS`

### Deprecated
- Legacy `secrets-path` in `config.yaml` is still read for backward compatibility
  - Prefer `aifabrix-secrets`; `secrets-path` will be removed in a future release

### Technical
- `lib/utils/paths.js` now reads `aifabrix-home` directly from `~/.aifabrix/config.yaml`
- `lib/utils/secrets-path.js` uses config for defaults and updated precedence
- `lib/secrets.js` uses configured home for admin secrets file locations
- Updated tests for new precedence and config-based resolution

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.5] - 2025-11-13

### Fixed
- Infrastructure health detection for developer ID "0"/"01"
  - Compose generation now passes a numeric `devId` into templates to avoid misnamed containers/networks for dev0
  - `aifabrix up` no longer times out waiting for health due to dev0 container name mismatches
- Container discovery collisions
  - Exact container-name matching prevents `redis` from being confused with `redis-commander`
  - Doctor/status now correctly report health instead of "unknown" for running services

### Changed
- Developer ID handling
  - Preserve string form in config (e.g., "01") while consistently using numeric form for Docker resource naming and port calculations

### Technical
- Updated `lib/infra.js` to send numeric `devId` into `templates/infra/compose.yaml.hbs`
- Hardened lookup in `lib/utils/infra-containers.js`:
  - Prefer exact-name match, safe fallback to `aifabrix-dev0-*` for dev0
  - Deterministic selection when multiple names are returned

## [2.3.2] - 2025-11-12

### Fixed
- **Comment Preservation in Secure Command**: Fixed `aifabrix secure` command to preserve all comments and formatting
  - Replaced YAML load/dump approach with line-by-line parsing
  - All comments (inline and block) are now preserved during encryption
  - Blank lines and indentation are maintained
  - Original file structure is kept intact
- **URL Exclusion**: Enhanced secure command to skip encrypting URLs
  - Values starting with `http://` or `https://` are not encrypted (URLs are not secrets)
  - Works for both quoted and unquoted URL values
  - Prevents accidental encryption of service endpoints and API URLs

### Changed
- **Secure Command Implementation**: Improved encryption process
  - Line-by-line YAML parsing preserves all formatting and comments
  - Skips YAML primitives (numbers, booleans, null) - only encrypts string values
  - Better handling of quoted strings (preserves quote style)
  - More robust handling of edge cases (multiline values, special characters)

### Technical
- New `lib/utils/yaml-preserve.js` module for line-by-line YAML encryption
- Enhanced `shouldEncryptValue()` function to detect URLs and YAML primitives
- Comprehensive test coverage for comment preservation and URL exclusion

## [2.3.0] - 2025-11-11

### Added
- **Secrets Encryption Command**: New `aifabrix secure` command for ISO 27001 compliance
  - Encrypts all secrets in `secrets.local.yaml` files using AES-256-GCM encryption
  - Supports user secrets file (`~/.aifabrix/secrets.local.yaml`) and app build secrets
  - Finds and encrypts secrets from all applications configured with `build.secrets` in `variables.yaml`
  - Encryption key management stored in `~/.aifabrix/config.yaml`
  - Interactive prompts for encryption key if not provided
  - Validates encryption key format (32 bytes, hex or base64)
  - Preserves YAML structure and comments during encryption
  - Skips already encrypted values (detected by `secure://` prefix)
- **AES-256-GCM Encryption Implementation**: ISO 27001 compliant encryption
  - New `lib/utils/secrets-encryption.js` module for encryption/decryption utilities
  - AES-256-GCM algorithm with 96-bit IV and 128-bit authentication tag
  - Encrypted values use `secure://<iv>:<ciphertext>:<authTag>` format
  - All components base64 encoded for safe storage in YAML files
  - Encryption key validation (64 hex characters or 44 base64 characters = 32 bytes)
  - Secure key normalization from hex or base64 format
- **Automatic Secret Decryption**: Seamless decryption during secret resolution
  - `lib/secrets.js` automatically detects and decrypts `secure://` prefixed values
  - Decryption uses encryption key from `config.yaml`
  - Transparent to applications - secrets are decrypted before use
  - Error handling for invalid keys or corrupted encrypted data
  - Graceful fallback if encryption key is not configured

### Changed
- **Secrets Loading**: Enhanced to support encrypted secrets
  - `loadSecrets()` function now automatically decrypts `secure://` prefixed values
  - `decryptSecretsObject()` function added to handle decryption of all encrypted values
  - Encryption key retrieved from config using `getSecretsEncryptionKey()`
  - Only attempts decryption if encrypted values are detected
  - Maintains backward compatibility with plaintext secrets
- **Configuration Management**: Extended to support encryption keys
  - `lib/config.js` now includes `getSecretsEncryptionKey()` and `setSecretsEncryptionKey()` functions
  - Encryption key stored in `~/.aifabrix/config.yaml` as `secrets-encryption-key`
  - Key persisted across CLI sessions for automatic decryption
  - Key validation before storage to ensure proper format

### Security
- **ISO 27001 Compliance**: Enhanced secrets protection
  - All secrets can now be encrypted at rest in YAML files
  - AES-256-GCM provides authenticated encryption (confidentiality and integrity)
  - Encryption keys stored separately from encrypted data
  - File permissions set to 0o600 (read/write for owner only) after encryption
  - No plaintext secrets in version control when using encryption

### Technical
- New `lib/commands/secure.js` module for secure command implementation
- Encryption utilities in `lib/utils/secrets-encryption.js` with comprehensive validation
- Integration with existing secrets resolution pipeline
- Support for multiple secrets files (user secrets and per-app build secrets)
- YAML structure preservation during encryption/decryption operations

## [2.2.0] - 2025-11-09

### Added
- **Developer Isolation System**: Complete isolation for multiple developers running applications simultaneously
  - Developer-specific numeric IDs (1, 2, 3, etc.) stored in `~/.aifabrix/config.yaml`
  - Automatic port calculation: `basePort + (developer-id * 100)` for all infrastructure services
  - Developer-specific Docker containers, networks, and volumes
  - Separate Docker Compose projects per developer (`infra-dev{id}`)
  - No conflicts between developers running the same applications
- **Port Management**: Intelligent port offsetting based on developer ID
  - Base ports: app=3000, postgres=5432, redis=6379, pgadmin=5050, redisCommander=8081
  - Developer 1: app=3100, postgres=5532, redis=6479, pgadmin=5150, redisCommander=8181
  - Developer 2: app=3200, postgres=5632, redis=6579, pgadmin=5250, redisCommander=8281
  - `localPort` in `variables.yaml` remains unchanged (only Docker host ports are offset)
  - Dockerfile container ports remain unchanged (internal container ports)
- **Developer Configuration Command**: New `aifabrix dev config` command
  - `aifabrix dev config` - Display current developer ID and calculated ports
  - `aifabrix dev config --set-id <id>` - Set developer ID in configuration
  - Shows all calculated ports for current developer
- **Enhanced Status Command**: Now displays both infrastructure services and running applications
  - Infrastructure services: postgres, redis, pgadmin, redisCommander
  - Running applications: Shows app name, container name, port mapping, and status
  - Developer-specific container discovery and status reporting
- **Developer Flag for Infrastructure**: `--developer <id>` option for `up` command
  - `aifabrix up --developer 1` - Sets developer ID and starts infrastructure
  - Automatically saves developer ID to configuration
  - Sets environment variable `AIFABRIX_DEVELOPERID` for current process
- **Developer Config Utility**: New `lib/utils/dev-config.js` module
  - `getDevPorts(developerId)` - Calculates all ports based on developer ID
  - Centralized port calculation logic
  - Returns object with all calculated ports for infrastructure and applications
- **API Error Handling System**: Comprehensive error handling with user-friendly messages
  - New `lib/utils/api-error-handler.js` module for structured error parsing and formatting
  - Support for RFC 7807 Problem Details format (detail, title, errors array)
  - Error type detection: permission (403), validation (400), authentication (401), network, server (500+), conflict (409), not found (404)
  - User-friendly formatted error messages with actionable guidance
  - Correlation ID tracking for error tracing
  - Context-aware error messages (e.g., "application already exists" for 409 conflicts)
  - Missing and required permissions display for permission errors
  - Field-level validation error details with path information
- **Two-Step Deployment Process**: Validate then deploy workflow
  - Step 1: Validate deployment via `/api/v1/pipeline/{env}/validate` endpoint
  - Step 2: Deploy using `validateToken` from validation step
  - Validation includes retry logic with exponential backoff
  - Draft deployment ID tracking during validation
  - Image server credentials returned from validation endpoint
  - Clear separation between validation and deployment phases
- **API Performance Logging**: Comprehensive audit logging for all API calls
  - All API calls logged to audit log with duration, status code, and success/failure
  - Error information including error type, message, and correlation ID
  - Performance metrics tracking for troubleshooting
  - Network error detection and logging
  - Automatic logging in `lib/utils/api.js` for all API calls
  - New `logApiCall()` function in `lib/audit-logger.js` for structured API logging

### Changed
- **Configuration System**: Extended `lib/config.js` to support developer IDs
  - `getConfig()` now returns `{ apiUrl, token, developerId }` (defaults to 1)
  - `saveConfig()` accepts and saves `developerId` alongside `apiUrl` and `token`
  - New helper functions: `getDeveloperId()` and `setDeveloperId(id)`
  - Config structure: `developer-id: 1` in `~/.aifabrix/config.yaml`
- **Infrastructure Management**: Complete isolation with developer-specific resources
  - Container names: `aifabrix-dev{id}-postgres`, `aifabrix-dev{id}-redis`, etc.
  - Network name: `infra-dev{id}-aifabrix-network`
  - Volume names: `dev{id}_postgres_data`, `dev{id}_redis_data`
  - Docker Compose project name: `infra-dev{id}`
  - All infrastructure functions now use developer-specific configuration
- **Application Running**: Developer-specific container naming and port mapping
  - Container names: `aifabrix-dev{id}-{appName}`
  - Docker host port uses dev-specific offset, container port uses config value (unchanged)
  - Port conflict detection with infrastructure ports
- **Docker Compose Generation**: Developer-specific network integration
  - Applications connect to developer-specific network: `infra-dev{id}-aifabrix-network`
  - Host port mapping uses dev-specific port, container port uses config value
- **Environment File Generation**: Developer-specific infrastructure ports for local context
  - Docker context (container-to-container): Uses service names (unchanged)
  - Local context (host machine): Uses `localhost` with dev-specific ports
  - `PORT` variable still uses `localPort` from `variables.yaml` (unchanged)
- **Infrastructure Template**: Converted to Handlebars template with developer variables
  - `templates/infra/compose.yaml.hbs` - Parameterized template
  - Variables: `{{devId}}`, `{{postgresPort}}`, `{{redisPort}}`, etc.
  - Dynamic generation with developer-specific values
- **Deployment Error Handling**: Unified error handling across all deployment operations
  - All deployment errors now use unified error handler from `lib/utils/api-error-handler.js`
  - Deployment errors automatically parsed and formatted with user-friendly messages
  - Error types properly categorized (permission, validation, network, server, etc.)
  - Correlation IDs included in error messages for troubleshooting
  - Audit logging integrated with error handling (prevents double-logging)
  - Network errors detected and handled separately from HTTP errors
- **API Error Handling**: Enhanced error handling in all API calls
  - `lib/utils/api.js` now uses unified error handler for all API calls
  - All API errors automatically parsed and formatted before returning
  - Error responses include `formattedError` field for direct CLI display
  - Network errors properly detected and categorized
  - RFC 7807 Problem Details format fully supported (detail, title, errors array)
  - Error data structure normalized for consistent handling
- **Deployment Process**: Two-step validation and deployment workflow
  - `lib/deployer.js` now implements validate-then-deploy pattern
  - `validateDeployment()` function validates configuration before deployment
  - `sendDeployment()` orchestrates validation and deployment steps
  - Validation errors caught early before deployment attempt
  - Retry logic with exponential backoff for both validation and deployment
  - Clear progress messages for each step (validation, deployment, polling)

### Documentation
- **Developer Isolation Guide**: New `docs/DEVELOPER-ISOLATION.md`
  - Explains developer isolation concept and benefits
  - Port calculation examples for different developer IDs
  - Configuration instructions and usage examples
  - Clarifies that `localPort` and Dockerfile ports remain unchanged
  - Complete isolation explanation (separate Docker Compose projects)

### Technical
- Infrastructure template generation now uses Handlebars for dynamic composition
- All Docker operations use developer-specific project names (`-p infra-dev{id}`)
- Developer-specific network and volume management
- Container discovery and status reporting for applications
- Port calculation utility for consistent port management across all commands
- Unified error handling architecture with `lib/utils/api-error-handler.js` as central error processing module
- All API calls automatically log performance metrics and errors to audit log
- Error parsing supports multiple response formats (RFC 7807, legacy formats, nested structures)
- Deployment validation endpoint integration with proper error handling and retry logic
- Correlation ID tracking throughout error handling chain for better troubleshooting
- Network error detection separated from HTTP error handling for better user experience

## [2.1.7] - 2025-11-07

### Fixed
- Fixed Keycloak port configuration for Docker containers
  - URLs in `.env` files now automatically resolve ports based on environment context
  - Docker environment uses `containerPort` from service's `variables.yaml` (e.g., `http://keycloak:8080`)
  - Local environment uses `localPort` or original port (e.g., `http://localhost:8082`)
  - Resolves connection failures when services try to connect to Keycloak in Docker containers
  - Port resolution works for all services (keycloak, miso-controller, dataplane, etc.)

### Changed
- Refactored `lib/secrets.js` to comply with code quality standards
  - Reduced file size from 595 lines to 367 lines (under 500 line limit)
  - Split large functions into smaller, focused helper functions (all under 50 lines)
  - Created `lib/utils/secrets-utils.js` utility module for secrets loading and port resolution
  - Improved code organization and maintainability
  - All functions now comply with cursor rules (≤50 lines per function, ≤500 lines per file)

### Added
- `lib/utils/secrets-utils.js` utility module with helper functions:
  - `loadSecretsFromFile()` - Loads secrets from file
  - `loadUserSecrets()` - Loads user secrets from ~/.aifabrix/secrets.local.yaml
  - `loadBuildSecrets()` - Loads build secrets from variables.yaml
  - `loadDefaultSecrets()` - Loads default secrets from ~/.aifabrix/secrets.yaml
  - `buildHostnameToServiceMap()` - Builds hostname to service name mapping
  - `resolveUrlPort()` - Resolves port for URLs in Docker environment

## [2.1.4] - 2025-11-06

### Fixed
- Fixed PostgreSQL database initialization to support database names with hyphens (e.g., `miso-logs`)
  - Added `pgQuote` Handlebars helper to properly quote PostgreSQL identifiers in SQL commands
  - Added `pgUser` Handlebars helper to generate properly quoted PostgreSQL user names
  - Database and user names with hyphens are now correctly quoted in CREATE DATABASE and CREATE USER commands
- Fixed password handling security issue in Docker Compose generation
  - Changed from parsing passwords from DATABASE_URL or generating random passwords to requiring explicit `DB_PASSWORD` or `DB_0_PASSWORD` variables in `.env` files
  - Passwords must now be explicitly set in `.env` files (typically resolved from `kv://` references)
  - Improved password validation to distinguish between missing password variables and empty password values
  - Provides clear error messages when required password variables are missing or empty

### Changed
- Database password resolution now requires `DB_PASSWORD` (single database) or `DB_0_PASSWORD`, `DB_1_PASSWORD`, etc. (multiple databases) to be set in `.env` files
- Password validation now uses key existence checks (`in` operator) instead of truthiness checks to properly handle empty values
- Docker Compose templates now use environment variables (`DB_0_PASSWORD`, `DB_1_PASSWORD`) for database passwords instead of hardcoded values

### Security
- Eliminated hardcoded database passwords from Docker Compose templates
- Database passwords must now be explicitly provided via `.env` files (resolved from secure key vaults)
- Improved password validation prevents accidental use of empty passwords

## [2.1.3] - 2025-11-06

### Fixed
- Fixed `aifabrix status` command showing ❌ for running services (normalized status value to handle quotes and whitespace)
- Fixed `aifabrix push` command to use correct image name from `variables.yaml` instead of app name
  - Now correctly resolves image name from `image.name`, `app.key`, or falls back to app name
  - Matches the same logic used by `aifabrix build` command
- Improved authentication error handling in push command:
  - Detects authentication errors and provides clear login instructions
  - Automatically retries authentication if push fails with auth error
  - Shows helpful error messages with `az acr login` command

### Changed
- Enhanced push error messages to include authentication troubleshooting steps
- Status command now normalizes Docker container status values before comparison

## [2.1.2] - 2025-11-06

### Fixed
- Authentication validation now allows `enableSSO: false` without requiring `type` and `requiredRoles` fields
- Fixed validation error when using authentication section with only `enableSSO: false` (e.g., in keycloak template)
- Authentication fields are now conditionally required based on `enableSSO` value:
  - When `enableSSO: false`: only `enableSSO` field is required
  - When `enableSSO: true`: `type`, `enableSSO`, and `requiredRoles` are required

### Changed
- Updated authentication schema to use conditional validation with `allOf` rules
- Updated `buildAuthenticationConfig()` to default `type: 'none'` and `requiredRoles: []` when `enableSSO: false`
- Updated variable transformer to handle partial authentication objects correctly

## [2.1.1] - 2025-11-06

### Added
- `--debug` flag for `aifabrix run` command to output detailed container information
- Debug logging for port detection, container status, Docker commands, and health check details
- Health check response format documentation in application schema
- Health check response format validation documentation in CONFIGURATION.md

### Changed
- Enhanced health check validation to support multiple response formats:
  - `status: "UP"` (Keycloak format)
  - `status: "ok"` (standard format with optional database connection check)
  - `status: "healthy"` (alternative format)
  - `success: true` (success-based format)
  - Non-JSON responses with HTTP 200 status code

### Documentation
- Added health check response format documentation to application schema JSON
- Added health check response format examples to CONFIGURATION.md
- Added `--debug` flag documentation to CLI-REFERENCE.md

## [2.1.0] - 2025-11-06

### Added
- Automatic README.md generation for applications during `aifabrix create`
- Application-specific README template with build instructions, prerequisites, and troubleshooting
- Conditional README sections based on application configuration (database, redis, storage, authentication)
- README.md generation only if file doesn't already exist (non-destructive)

## [2.0.2] - 2025-10-27

### Changed
- Updated documentation to reflect pipeline API authentication model (ClientId/ClientSecret + JWT)
- Updated GitHub Actions workflow examples to use correct pipeline API endpoints
- Clarified deployment authentication: pipeline uses ClientId/Secret, regular APIs use Keycloak tokens
- Fixed MisoClient configuration example typo in CONFIGURATION.md (process.APPLICATION_KEY → process.env.APPLICATION_KEY)

### Added
- Azure Marketplace deployment documentation
- External registry support in push command with --registry-type flag
- Deployment configuration section in application-schema.json
- Application registration documentation (aifabrix app register)
- Deployment logs documentation
- Pipeline environment variables documentation
- Support for Docker Hub, GitHub Container Registry, and other external registries
- authenticateExternalRegistry function for external registry authentication

### Fixed
- Incorrect pipeline API examples showing bearer tokens (now uses ClientId/Secret)
- Incorrect response field names (acrToken → validateToken, deploymentServer → acrServer)
- Missing tenantId parameter documentation (handled internally by controller)
- Incorrect environment variables for pipeline deployment (removed CONTROLLER_API_KEY, TENANT_ID, CLIENT_ID as env ID)

## [2.0.0] - 2025-01-25

### Added
- Initial release of AI Fabrix Builder SDK
- Infrastructure management commands (up, down, doctor, status, restart)
- Application creation command with interactive prompts
- Secrets management with kv:// references
- JSON deployment manifest generation
- Comprehensive documentation suite
- GitHub Actions workflow generation
- Environment file conversion and template generation
- RBAC configuration generation
- Comprehensive test suite with 90%+ coverage

### Security
- ISO 27001 compliant implementation
- No hardcoded secrets or sensitive data
- Proper access controls and authentication mechanisms
- Input validation and sanitization
- Audit logging for all operations
- Sensitive value detection and conversion to kv:// references

### Features
- **Create Command**: Interactive application scaffolding with configuration files
- **Infrastructure Management**: Docker-based local development environment
- **Secrets Management**: Secure handling of sensitive configuration values
- **GitHub Integration**: Automated CI/CD workflow generation
- **Environment Conversion**: Automatic .env file to template conversion
- **Multi-language Support**: TypeScript and Python application templates
- **Service Integration**: Database, Redis, Storage, and Authentication support

### Technical
- Node.js 18+ support
- Comprehensive error handling and validation
- Modular architecture with clear separation of concerns
- Extensive test coverage with Jest
- ESLint configuration for code quality
- Handlebars templating for configuration generation
- YAML configuration management

### Documentation
- CLI Reference Guide
- Quick Start Guide
- Configuration Guide
- Infrastructure Guide
- Building and Deployment Guides
- GitHub Workflows Documentation

## [Unreleased]

### Planned
- Build command implementation
- Run command implementation
- Push command for Azure Container Registry
- Deploy command for Miso Controller API
- Additional language support (Go, Rust, Java)
- Advanced templating options
- Plugin system for custom templates
