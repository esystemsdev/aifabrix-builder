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
