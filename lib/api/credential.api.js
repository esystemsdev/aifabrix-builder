/**
 * @fileoverview Credential API functions (Dataplane secret store)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

const CREDENTIAL_SECRET_ENDPOINT = '/api/v1/credential/secret';

/**
 * Store credential secrets in the dataplane secret store.
 * Values are encrypted at rest by the dataplane; send plain values only (no kv:// as value).
 *
 * POST /api/v1/credential/secret
 * @requiresPermission {Dataplane} credential:create
 * @async
 * @function storeCredentialSecrets
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration (Bearer token required)
 * @param {Array<{ key: string, value: string }>} items - Secret items (key = kv path, value = plain)
 * @returns {Promise<{ stored?: number, success?: boolean, error?: string }>} Secret store response
 * @throws {Error} If request fails (non-2xx) and caller may handle 403/401 as warning
 */
async function storeCredentialSecrets(dataplaneUrl, authConfig, items) {
  if (!dataplaneUrl || typeof dataplaneUrl !== 'string') {
    throw new Error('dataplaneUrl is required and must be a string');
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { stored: 0 };
  }
  const client = new ApiClient(dataplaneUrl, authConfig);
  return await client.post(CREDENTIAL_SECRET_ENDPOINT, {
    body: items
  });
}

module.exports = {
  storeCredentialSecrets
};
