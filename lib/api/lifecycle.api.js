/**
 * @fileoverview Dataplane Enterprise AI Certification lifecycle API client (419.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { createDataplaneApiClient } = require('./index');
const { unwrapApiData } = require('../utils/external-system-readiness-core');

/**
 * GET /api/v1/external/systems/{systemKey}/lifecycle
 * @requiresPermission {Dataplane} external-system:read
 * @async
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {string} systemKey
 * @param {{ details?: boolean, summary?: boolean }} [opts]
 * @returns {Promise<Object>}
 */
async function getSystemLifecycleReport(dataplaneUrl, authConfig, systemKey, opts = {}) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const params = {};
  if (opts.details === true) params.details = true;
  if (opts.summary === true) params.summary = true;
  const res = await client.get(`/api/v1/external/systems/${encodeURIComponent(systemKey)}/lifecycle`, {
    params
  });
  if (res && res.success === false) {
    const msg =
      (res.error && (res.error.formattedError || res.error.error || res.error.message)) ||
      res.formattedError ||
      'Lifecycle report request failed';
    throw new Error(msg);
  }
  const unwrapped = unwrapApiData(res);
  if (!unwrapped || !unwrapped.systemKey) {
    throw new Error('Lifecycle report returned an unexpected response shape');
  }
  return unwrapped;
}

/**
 * POST /api/v1/external/systems/{systemKey}/lifecycle/run
 * @requiresPermission {Dataplane} external-system:update
 * @async
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {string} systemKey
 * @param {Object} [body]
 * @returns {Promise<Object>}
 */
async function runSystemLifecycle(dataplaneUrl, authConfig, systemKey, body = {}) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.post(
    `/api/v1/external/systems/${encodeURIComponent(systemKey)}/lifecycle/run`,
    { body }
  );
  if (res && res.success === false) {
    const msg =
      (res.error && (res.error.formattedError || res.error.error || res.error.message)) ||
      res.formattedError ||
      'Lifecycle run request failed';
    throw new Error(msg);
  }
  const unwrapped = unwrapApiData(res);
  if (!unwrapped || !unwrapped.report) {
    throw new Error('Lifecycle run returned an unexpected response shape');
  }
  return unwrapped;
}

module.exports = {
  getSystemLifecycleReport,
  runSystemLifecycle
};
