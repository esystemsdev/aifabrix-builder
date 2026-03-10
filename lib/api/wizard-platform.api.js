/**
 * @fileoverview Wizard platform API - getPlatformDetails, discoverEntities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { ApiClient } = require('./index');

/**
 * Get platform details including available datasources
 * GET /api/v1/wizard/platforms/{platformKey}
 * @requiresPermission {Dataplane} external-system:read
 * @async
 * @function getPlatformDetails
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {string} platformKey - Platform key (e.g. 'hubspot')
 * @returns {Promise<Object>} Platform details including datasources: [{ key, displayName, entity }]
 * @throws {Error} If request fails or platform not found (404)
 */
async function getPlatformDetails(dataplaneUrl, authConfig, platformKey) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  const response = await client.get(`/api/v1/wizard/platforms/${encodeURIComponent(platformKey)}`);
  if (!response.success) {
    const msg = response.status === 404
      ? `Platform '${platformKey}' not found`
      : response.formattedError || response.error || 'Failed to get platform details';
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }
  return response;
}

/**
 * Discover entities from OpenAPI spec (for multi-entity flows)
 * POST /api/v1/wizard/discover-entities
 * @requiresPermission {Dataplane} external-system:create
 * @async
 * @function discoverEntities
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} openapiSpec - OpenAPI specification object
 * @returns {Promise<Object>} Response with entities: [{ name, pathCount, schemaMatch }]
 * @throws {Error} If request fails
 */
async function discoverEntities(dataplaneUrl, authConfig, openapiSpec) {
  const client = new ApiClient(dataplaneUrl, authConfig);
  const response = await client.post('/api/v1/wizard/discover-entities', {
    body: { openapiSpec }
  });
  if (!response.success) {
    const msg = response.formattedError || response.error || 'Failed to discover entities';
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }
  return response;
}

module.exports = { getPlatformDetails, discoverEntities };
