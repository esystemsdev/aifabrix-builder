/**
 * Dataplane health (public) — read dataplane `version` and optional
 * `minBuilderCliVersion` for the Builder CLI compatibility gate (plan 142.0).
 *
 * Reads `GET /api/v1/health` first (canonical, plan 403.0) and falls back to
 * `GET /health` for older dataplanes during rollout. The endpoint is public
 * (`security: []`); no auth header is sent.
 *
 * @fileoverview Read dataplane health JSON without authentication
 * @author AI Fabrix Team
 * @version 2.0.0
 * @requiresPermission none — public dataplane health endpoint (security: [])
 */

'use strict';

require('./types/dataplane-health.types');
const { ApiClient } = require('./index');

const PRIMARY_ENDPOINT = '/api/v1/health';
const FALLBACK_ENDPOINT = '/health';

/**
 * Extract the inner JSON body from the harmonized ApiClient response shape.
 * @private
 * @param {Object} response
 * @returns {Object|null}
 */
function unwrapBody(response) {
  if (!response || response.success === false || response.data === null || response.data === undefined) {
    return null;
  }
  const outer = response.data;
  if (!outer || typeof outer !== 'object') {
    return null;
  }
  // Some dataplane shapes return `{ data: { ... } }`; the general health route
  // returns the payload directly. Accept both.
  const inner = outer.data !== undefined && outer.data !== null && typeof outer.data === 'object'
    ? outer.data
    : outer;
  if (!inner || typeof inner !== 'object') {
    return null;
  }
  return inner;
}

/**
 * Parse a raw ApiClient response into a normalized health snapshot.
 *
 * @param {Object} response - ApiClient.get response (`{ success, data, ... }`)
 * @param {string} [endpoint] - Endpoint that produced the response (recorded on snapshot)
 * @returns {import('./types/dataplane-health.types').DataplaneHealthSnapshot|null}
 *          Snapshot, or null when the response is not parseable
 */
function parseGeneralHealthResponse(response, endpoint) {
  const body = unwrapBody(response);
  if (!body) return null;

  const status = typeof body.status === 'string' ? body.status : 'unknown';
  const version = typeof body.version === 'string' && body.version.trim()
    ? body.version.trim()
    : undefined;

  let minBuilderCliVersion;
  if (typeof body.minBuilderCliVersion === 'string') {
    const trimmed = body.minBuilderCliVersion.trim();
    if (trimmed) minBuilderCliVersion = trimmed;
  }

  return {
    status,
    version,
    minBuilderCliVersion,
    endpoint: endpoint || null
  };
}

/**
 * Fetch dataplane general health (public endpoint, no auth).
 *
 * Tries `/api/v1/health` first; on failure falls back to `/health` (compatibility
 * with older dataplanes that did not expose the v1 health route during rollout).
 *
 * @async
 * @param {string} dataplaneUrl - Dataplane base URL (e.g. `http://localhost:3201`)
 * @param {Object} [options]
 * @param {number} [options.timeoutMs] - Optional timeout in milliseconds
 * @returns {Promise<import('./types/dataplane-health.types').DataplaneHealthSnapshot|null>}
 *          Snapshot, or null when both endpoints fail
 * @throws {Error} When dataplaneUrl is missing or not a string
 */
async function fetchDataplaneGeneralHealth(dataplaneUrl, options = {}) {
  if (!dataplaneUrl || typeof dataplaneUrl !== 'string') {
    throw new Error('dataplaneUrl is required and must be a string');
  }
  const client = new ApiClient(dataplaneUrl);
  const requestOpts = {};
  if (options.timeoutMs !== undefined && options.timeoutMs !== null) {
    requestOpts.timeoutMs = options.timeoutMs;
  }

  const primary = await safeGet(client, PRIMARY_ENDPOINT, requestOpts);
  const primarySnapshot = parseGeneralHealthResponse(primary, PRIMARY_ENDPOINT);
  if (primarySnapshot) return primarySnapshot;

  const fallback = await safeGet(client, FALLBACK_ENDPOINT, requestOpts);
  const fallbackSnapshot = parseGeneralHealthResponse(fallback, FALLBACK_ENDPOINT);
  if (fallbackSnapshot) return fallbackSnapshot;

  return null;
}

/**
 * GET that swallows transport errors (timeouts / DNS / ECONNREFUSED) so callers
 * can attempt a fallback endpoint without try/catch noise.
 * @private
 * @async
 * @param {ApiClient} client
 * @param {string} endpoint
 * @param {Object} options
 * @returns {Promise<Object|null>}
 */
async function safeGet(client, endpoint, options) {
  try {
    return await client.get(endpoint, options);
  } catch (_error) {
    return null;
  }
}

module.exports = {
  fetchDataplaneGeneralHealth,
  parseGeneralHealthResponse,
  PRIMARY_ENDPOINT,
  FALLBACK_ENDPOINT
};
