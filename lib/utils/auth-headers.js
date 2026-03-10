/**
 * AI Fabrix Builder Authentication Headers Utilities
 *
 * Creates authentication headers for API requests
 *
 * @fileoverview Authentication header utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Creates authentication headers using Bearer token
 *
 * @param {string} token - Authentication token
 * @returns {Object} Headers object with authentication
 * @throws {Error} If token is missing
 */
function createBearerTokenHeaders(token) {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Creates authentication headers for the token-issuing endpoint only (e.g. POST /api/v1/auth/token).
 * Do not use for Controller or Dataplane app endpoints—those require Bearer token (use createBearerTokenHeaders).
 *
 * @param {string} clientId - Application client ID
 * @param {string} clientSecret - Application client secret
 * @returns {Object} Headers object with x-client-id and x-client-secret
 * @throws {Error} If credentials are missing
 */
function createClientCredentialsHeaders(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    throw new Error('Client ID and Client Secret are required for authentication');
  }
  return {
    'x-client-id': clientId,
    'x-client-secret': clientSecret
  };
}

/**
 * Creates authentication headers based on auth configuration.
 * For app endpoints use type 'bearer' only. Use 'client-credentials' only when calling the token-issuing endpoint (e.g. /api/v1/auth/token).
 *
 * @param {Object} authConfig - Authentication configuration
 * @param {string} authConfig.type - Auth type: 'bearer' (for app endpoints) or 'client-credentials' (token endpoint only)
 * @param {string} [authConfig.token] - Bearer token (for type 'bearer')
 * @param {string} [authConfig.clientId] - Client ID (for type 'client-credentials', token endpoint only)
 * @param {string} [authConfig.clientSecret] - Client secret (for type 'client-credentials', token endpoint only)
 * @returns {Object} Headers object with authentication
 * @throws {Error} If auth config is invalid
 */
function createAuthHeaders(authConfig) {
  if (!authConfig || !authConfig.type) {
    throw new Error('Authentication configuration is required');
  }

  if (authConfig.type === 'bearer') {
    if (!authConfig.token) {
      throw new Error('Bearer token is required for bearer authentication');
    }
    return createBearerTokenHeaders(authConfig.token);
  }

  if (authConfig.type === 'client-credentials') {
    if (!authConfig.clientId || !authConfig.clientSecret) {
      throw new Error('Client ID and Client Secret are required for client-credentials authentication');
    }
    return createClientCredentialsHeaders(authConfig.clientId, authConfig.clientSecret);
  }

  throw new Error(`Invalid authentication type: ${authConfig.type}. Must be 'bearer' or 'client-credentials'`);
}

module.exports = {
  createBearerTokenHeaders,
  createClientCredentialsHeaders,
  createAuthHeaders
};

