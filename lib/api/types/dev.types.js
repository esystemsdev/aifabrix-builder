/**
 * @fileoverview Builder Server (dev) API type definitions – issue-cert, settings, users, SSH keys, secrets
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Issue certificate request (POST /api/dev/issue-cert). Public; no client cert.
 * @typedef {Object} IssueCertDto
 * @property {string} developerId - Developer ID (must match user for whom PIN was created)
 * @property {string} pin - One-time PIN from POST /api/dev/users/:id/pin
 * @property {string} csr - PEM-encoded Certificate Signing Request
 */

/**
 * Issue certificate response (POST /api/dev/issue-cert)
 * @typedef {Object} IssueCertResponseDto
 * @property {string} certificate - PEM-encoded X.509 certificate
 * @property {number} validDays - Validity in days
 * @property {string} validNotAfter - ISO 8601 validity end (UTC)
 */

/**
 * Developer settings (GET /api/dev/settings). Cert-authenticated.
 * @typedef {Object} SettingsResponseDto
 * @property {string} user-mutagen-folder - Server path to workspace root (no app segment)
 * @property {string} secrets-encryption - Encryption key (hex)
 * @property {string} aifabrix-secrets - Path or URL for secrets
 * @property {string} aifabrix-env-config - Env config path
 * @property {string} remote-server - Builder-server base URL
 * @property {string} docker-endpoint - Docker API endpoint
 * @property {string} sync-ssh-user - SSH user for Mutagen
 * @property {string} sync-ssh-host - SSH host for Mutagen
 */

/**
 * User list item (GET /api/dev/users)
 * @typedef {Object} UserResponseDto
 * @property {string} id - Developer ID
 * @property {string} name - Display name
 * @property {string} email - Email
 * @property {string} createdAt - ISO 8601
 * @property {boolean} certificateIssued - Whether cert was issued
 * @property {string} [certificateValidNotAfter] - Cert validity end (optional)
 * @property {string[]} groups - Access groups (admin, secret-manager, developer)
 */

/**
 * Create user request (POST /api/dev/users)
 * @typedef {Object} CreateUserDto
 * @property {string} developerId - Unique developer ID (numeric string)
 * @property {string} name - Display name
 * @property {string} email - Email
 * @property {string[]} [groups] - Default [developer]
 */

/**
 * Update user request (PATCH /api/dev/users/:id). At least one field.
 * @typedef {Object} UpdateUserDto
 * @property {string} [name] - Display name
 * @property {string} [email] - Email
 * @property {string[]} [groups] - Access groups
 */

/**
 * Create PIN response (POST /api/dev/users/:id/pin)
 * @typedef {Object} CreatePinResponseDto
 * @property {string} pin - One-time PIN
 * @property {string} expiresAt - ISO 8601
 */

/**
 * Add SSH key request (POST /api/dev/users/:id/ssh-keys)
 * @typedef {Object} AddSshKeyDto
 * @property {string} publicKey - SSH public key line
 * @property {string} [label] - Optional label
 */

/**
 * SSH key item (list/add response)
 * @typedef {Object} SshKeyItemDto
 * @property {string} fingerprint - Key fingerprint
 * @property {string} [label] - Optional label
 * @property {string} [createdAt] - ISO 8601
 */

/**
 * Deleted response (DELETE endpoints)
 * @typedef {Object} DeletedResponseDto
 * @property {string} deleted - ID or key of deleted resource
 */

/**
 * Secret item (GET /api/dev/secrets)
 * @typedef {Object} SecretItemDto
 * @property {string} name - Secret key
 * @property {string} value - Decrypted value
 */

/**
 * Add secret request (POST /api/dev/secrets)
 * @typedef {Object} AddSecretDto
 * @property {string} key - Secret key
 * @property {string} value - Secret value
 */

/**
 * Add secret response
 * @typedef {Object} AddSecretResponseDto
 * @property {string} key - Key that was added/updated
 */

/**
 * Delete secret response
 * @typedef {Object} DeleteSecretResponseDto
 * @property {string} deleted - Key that was removed
 */

/**
 * Health response (GET /health)
 * @typedef {Object} HealthResponseDto
 * @property {string} status - Overall status, e.g. "ok"
 * @property {Object} checks - Per-component health checks
 * @property {string} checks.dataDir - Data directory check ("ok" or error)
 * @property {string} checks.encryptionKey - Encryption key check ("ok" or error)
 * @property {string} checks.ca - CA certificate check ("ok" or error)
 * @property {string} checks.users - Users store check ("ok" or error)
 * @property {string} checks.tokens - Tokens store check ("ok" or error)
 */

/**
 * Error response (all error responses)
 * @typedef {Object} ErrorResponseDto
 * @property {number} statusCode - HTTP status
 * @property {string} error - Short error type
 * @property {string} message - Human-readable message
 * @property {string} [code] - Optional machine-readable code
 */
