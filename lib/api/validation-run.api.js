/**
 * @fileoverview Unified dataplane validation API — POST /api/v1/validation/run and poll GET.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

const POST_PATH = '/api/v1/validation/run';

function buildClientCredentialHeaders(authConfig) {
  if (!authConfig || typeof authConfig !== 'object') return null;
  if (authConfig.type !== 'client-credentials') return null;
  if (!authConfig.clientId || !authConfig.clientSecret) return null;
  return {
    'x-client-id': String(authConfig.clientId),
    'x-client-secret': String(authConfig.clientSecret)
  };
}

/**
 * Normalize auth for dataplane: Bearer user token, x-client-token app token, or API key as Bearer.
 * @param {Object} authConfig - Auth configuration
 * @returns {Object} Auth for ApiClient
 */
function normalizeDataplaneAuth(authConfig) {
  if (!authConfig || typeof authConfig !== 'object') {
    throw new Error('authConfig is required');
  }
  if (authConfig.token) {
    return authConfig;
  }
  if (authConfig.apiKey) {
    return { ...authConfig, token: authConfig.apiKey, type: authConfig.type || 'bearer' };
  }
  throw new Error(
    'Validation run requires Bearer token or API key. Run \'aifabrix login\' or configure API key.'
  );
}

/**
 * @requiresPermission {Dataplane} external-system:read
 * @async
 * @function postValidationRun
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication (token or apiKey)
 * @param {import('./types/validation-run.types').ValidationRunRequestBody} body - Request JSON body
 * @returns {Promise<Object>} ApiClient result: { success, data, status, ... }
 */
async function postValidationRun(dataplaneUrl, authConfig, body) {
  const hdrs = buildClientCredentialHeaders(authConfig);
  const clientAuth = hdrs ? {} : normalizeDataplaneAuth(authConfig);
  const client = new ApiClient(dataplaneUrl, clientAuth);
  return client.post(POST_PATH, { body, headers: hdrs || undefined });
}

/**
 * @requiresPermission {Dataplane} external-system:read
 * @async
 * @function getValidationRun
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication
 * @param {string} testRunId - Poll id from 202 / envelope
 * @returns {Promise<Object>} ApiClient result
 */
async function getValidationRun(dataplaneUrl, authConfig, testRunId) {
  if (!testRunId || typeof testRunId !== 'string') {
    throw new Error('testRunId is required for validation run poll');
  }
  const hdrs = buildClientCredentialHeaders(authConfig);
  const clientAuth = hdrs ? {} : normalizeDataplaneAuth(authConfig);
  const client = new ApiClient(dataplaneUrl, clientAuth);
  const path = `${POST_PATH}/${encodeURIComponent(testRunId)}`;
  return client.get(path, { headers: hdrs || undefined });
}

/**
 * Extract async poll id from POST 202 body or partial DatasourceTestRun.
 * @param {Object} data - Parsed JSON body
 * @returns {string|null}
 */
function extractTestRunId(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.testRunId === 'string' && data.testRunId.trim()) return data.testRunId.trim();
  if (data.testRunId && typeof data.testRunId === 'object') {
    const id = data.testRunId.id || data.testRunId.key;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

module.exports = {
  postValidationRun,
  getValidationRun,
  extractTestRunId,
  normalizeDataplaneAuth,
  buildClientCredentialHeaders,
  POST_PATH
};
