/**
 * @fileoverview Dataplane Trust API — integration certificates (active, list, verify).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');
const { normalizeDataplaneAuth } = require('./validation-run.api');

/**
 * @param {Object} authConfig
 * @returns {Object}
 */
function dataplaneAuthForBearerGet(authConfig) {
  if (!authConfig || typeof authConfig !== 'object') {
    return authConfig;
  }
  if (authConfig.token || authConfig.clientId) {
    return authConfig;
  }
  if (authConfig.apiKey) {
    return { ...authConfig, token: authConfig.apiKey, type: authConfig.type || 'bearer' };
  }
  return normalizeDataplaneAuth(authConfig);
}

/**
 * Get active trusted integration certificate for a datasource.
 * GET /api/v1/systems/{systemKey}/datasources/{datasourceKey}/certificates/active
 * @requiresPermission {Dataplane} external-system:read
 * @async
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Auth (Bearer)
 * @param {string} systemKey - External system key
 * @param {string} datasourceKey - Datasource key
 * @returns {Promise<Object>} API envelope `{ success, data?, status, ... }`
 */
async function getActiveIntegrationCertificate(dataplaneUrl, authConfig, systemKey, datasourceKey) {
  const client = new ApiClient(dataplaneUrl, dataplaneAuthForBearerGet(authConfig));
  const path = `/api/v1/systems/${encodeURIComponent(systemKey)}/datasources/${encodeURIComponent(
    datasourceKey
  )}/certificates/active`;
  return await client.get(path);
}

/**
 * List integration certificates (optional filters).
 * GET /api/v1/certificates
 * @requiresPermission {Dataplane} external-system:read
 * @async
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Auth
 * @param {Object} [params] - Query: datasourceKey, systemIdOrKey, page, pageSize
 * @returns {Promise<Object>}
 */
async function listIntegrationCertificates(dataplaneUrl, authConfig, params = {}) {
  const client = new ApiClient(dataplaneUrl, dataplaneAuthForBearerGet(authConfig));
  return await client.get('/api/v1/certificates', { params });
}

/**
 * Verify a stored integration certificate (signature and optional hash).
 * POST /api/v1/certificates/verify
 * @requiresPermission {Dataplane} external-system:read
 * @async
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Auth
 * @param {import('./types/certificates.types').CertificateVerifyRequest} body - Verify request
 * @returns {Promise<Object>}
 */
async function verifyIntegrationCertificate(dataplaneUrl, authConfig, body) {
  const client = new ApiClient(dataplaneUrl, dataplaneAuthForBearerGet(authConfig));
  return await client.post('/api/v1/certificates/verify', { body: body || {} });
}

module.exports = {
  getActiveIntegrationCertificate,
  listIntegrationCertificates,
  verifyIntegrationCertificate
};
