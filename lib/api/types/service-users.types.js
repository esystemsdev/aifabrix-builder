/**
 * @fileoverview Service users API type definitions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Service user create request body (builder sends this to controller)
 * @typedef {Object} ServiceUserCreateRequest
 * @property {string} username - Username (1–100 chars, e.g. api-client-001)
 * @property {string} email - Email address
 * @property {string[]} redirectUris - Allowed redirect URIs for OAuth2 (min 1)
 * @property {string[]} groupNames - Group names to assign (e.g. AI-Fabrix-Developers)
 * @property {string} [description] - Optional description (max 500 chars)
 */

/**
 * Service user create response (clientSecret is one-time-only; store at creation time)
 * @typedef {Object} ServiceUserCreateResponse
 * @property {string} clientId - Stable identifier for the service user
 * @property {string} clientSecret - One-time-only secret; not returned by any other endpoint
 * @property {boolean} [success] - Optional wrapper flag
 * @property {string} [createdAt] - Optional creation timestamp (ISO 8601)
 */

/**
 * Single service user item in list response
 * @typedef {Object} ListServiceUserItem
 * @property {string} id - Service user ID (UUID)
 * @property {string} [username] - Username
 * @property {string} [email] - Email
 * @property {string} [clientId] - OAuth2 client ID
 * @property {boolean} [active] - Whether the service user is active
 */

/**
 * List service users response (Controller GET /api/v1/service-users)
 * @typedef {Object} ListServiceUsersResponse
 * @property {ListServiceUserItem[]} data - Array of service users
 * @property {Object} [meta] - Pagination metadata (e.g. total, page, pageSize)
 * @property {Object} [links] - Pagination links
 */

/**
 * Regenerate secret response (Controller POST .../regenerate-secret). clientSecret is one-time-only.
 * @typedef {Object} RegenerateSecretServiceUserResponse
 * @property {Object} data - Response data
 * @property {string} data.clientSecret - New client secret (shown once only)
 */

/**
 * Update groups response (Controller PUT .../groups)
 * @typedef {Object} UpdateGroupsServiceUserResponse
 * @property {Object} data - Response data
 * @property {string} data.id - Service user ID
 * @property {string[]} data.groupNames - Updated group names
 */

/**
 * Update redirect URIs response (Controller PUT .../redirect-uris)
 * @typedef {Object} UpdateRedirectUrisServiceUserResponse
 * @property {Object} data - Response data
 * @property {string} data.id - Service user ID
 * @property {string[]} data.redirectUris - Updated redirect URIs
 */
