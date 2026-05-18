/**
 * @fileoverview Agent metadata validation API (dataplane 404.5)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

const { createDataplaneApiClient } = require('./index');

/**
 * Run agent metadata validation for a datasource.
 * POST /api/v1/external/{sourceIdOrKey}/agent-metadata-validation
 * @requiresPermission {Dataplane} external-data-source:update
 * @async
 * @function runAgentMetadataValidation
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sourceIdOrKey - Datasource key or ID
 * @param {Object} authConfig - Authentication configuration
 * @param {import('./types/agent-metadata-validation.types').AgentMetadataValidationRunRequest} [body]
 * @returns {Promise<import('./types/agent-metadata-validation.types').AgentMetadataValidationRunResponse>}
 */
async function runAgentMetadataValidation(
  dataplaneUrl,
  sourceIdOrKey,
  authConfig,
  body = {},
  opts = {}
) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const requestOpts = { body };
  if (opts.timeoutMs !== undefined && opts.timeoutMs !== null) {
    requestOpts.timeoutMs = opts.timeoutMs;
  }
  return await client.post(
    `/api/v1/external/${encodeURIComponent(sourceIdOrKey)}/agent-metadata-validation`,
    requestOpts
  );
}

/**
 * Get latest agent metadata validation result.
 * GET /api/v1/external/{sourceIdOrKey}/agent-validation
 * @requiresPermission {Dataplane} external-data-source:read
 * @async
 * @function getLatestAgentMetadataValidation
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sourceIdOrKey - Datasource key or ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<import('./types/agent-metadata-validation.types').AgentMetadataValidationResult>}
 */
async function getLatestAgentMetadataValidation(
  dataplaneUrl,
  sourceIdOrKey,
  authConfig,
  opts = {}
) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const requestOpts = {};
  if (opts.timeoutMs !== undefined && opts.timeoutMs !== null) {
    requestOpts.timeoutMs = opts.timeoutMs;
  }
  return await client.get(
    `/api/v1/external/${encodeURIComponent(sourceIdOrKey)}/agent-validation`,
    requestOpts
  );
}

/**
 * List agent metadata validation history.
 * GET /api/v1/external/{sourceIdOrKey}/agent-validation/history
 * @requiresPermission {Dataplane} external-data-source:read
 * @async
 * @function listAgentMetadataValidationHistory
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {string} sourceIdOrKey - Datasource key or ID
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<import('./types/agent-metadata-validation.types').AgentMetadataValidationHistoryItem[]>}
 */
async function listAgentMetadataValidationHistory(
  dataplaneUrl,
  sourceIdOrKey,
  authConfig
) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  return await client.get(
    `/api/v1/external/${encodeURIComponent(sourceIdOrKey)}/agent-validation/history`
  );
}

module.exports = {
  runAgentMetadataValidation,
  getLatestAgentMetadataValidation,
  listAgentMetadataValidationHistory
};
