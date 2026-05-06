/**
 * @fileoverview Integration clients API type definitions (Controller camelCase)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Integration client create request body (builder → controller)
 * @typedef {Object} IntegrationClientCreateRequest
 * @property {string} key - Stable key (lowercase alphanumeric + hyphens)
 * @property {string} displayName - Human-readable name
 * @property {string[]} redirectUris - Allowed redirect URIs for OAuth2 (min 1)
 * @property {string[]} [groupNames] - Optional group names (RBAC); omit or empty for OAuth-only clients
 * @property {string} [description] - Optional description
 * @property {string} [keycloakClientId] - Optional fixed Keycloak client id
 */

/**
 * Create response (clientSecret is one-time-only)
 * @typedef {Object} IntegrationClientCreateResponseData
 * @property {Object} [integrationClient] - Created record
 * @property {string} [integrationClient.id] - Integration client id
 * @property {string} [integrationClient.key] - Key
 * @property {string} [integrationClient.displayName] - Display name
 * @property {string} [integrationClient.keycloakClientId] - OAuth client id in Keycloak
 * @property {string} [integrationClient.status] - Status
 * @property {string} [clientSecret] - One-time secret
 */

/**
 * Single integration client in list response
 * @typedef {Object} ListIntegrationClientItem
 * @property {string} id - Integration client id
 * @property {string} [key] - Key
 * @property {string} [displayName] - Display name
 * @property {string} [keycloakClientId] - OAuth client id
 * @property {string} [status] - Status (e.g. active)
 */

/**
 * Regenerate secret response
 * @typedef {Object} RegenerateIntegrationClientSecretResponse
 * @property {Object} [data] - Nested data
 * @property {string} [data.clientSecret] - New secret (one-time)
 */
