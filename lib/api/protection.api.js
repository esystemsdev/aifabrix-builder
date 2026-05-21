/**
 * @fileoverview Protection manifest API (dataplane /api/v1/protection/*).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { createDataplaneApiClient } = require('./index');
const { unwrapApiData } = require('../utils/external-system-readiness-core');

const BASE = '/api/v1/protection';

/**
 * @param {*} res
 * @returns {*}
 */
function unwrapBody(res) {
  return unwrapApiData(res) ?? res;
}

/**
 * POST /api/v1/protection/validate
 * @requiresPermission {Dataplane} external-system:read
 */
async function validateProtection(dataplaneUrl, authConfig, manifest, opts = {}) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const params = {};
  if (opts.strict === true) params.strict = true;
  if (opts.explain === true) params.explain = true;
  const res = await client.post(`${BASE}/validate`, {
    body: { manifest },
    params
  });
  return unwrapBody(res);
}

/**
 * POST /api/v1/protection/simulate
 * @requiresPermission {Dataplane} external-system:read
 */
async function simulateProtection(dataplaneUrl, authConfig, manifest, opts = {}) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const params = {};
  if (opts.strict === true) params.strict = true;
  if (opts.explain === true) params.explain = true;
  if (opts.sampleSize !== undefined && opts.sampleSize !== null) {
    params.sampleSize = opts.sampleSize;
  }
  const res = await client.post(`${BASE}/simulate`, {
    body: { manifest },
    params
  });
  return unwrapBody(res);
}

/**
 * POST /api/v1/protection/upload
 * @requiresPermission {Dataplane} external-system:publish
 */
async function uploadProtection(dataplaneUrl, authConfig, manifest) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.post(`${BASE}/upload`, { body: { manifest } });
  return unwrapBody(res);
}

/**
 * GET /api/v1/protection/{key}
 * @requiresPermission {Dataplane} external-system:read
 */
async function getProtection(dataplaneUrl, authConfig, key) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(`${BASE}/${encodeURIComponent(key)}`);
  return unwrapBody(res);
}

/**
 * GET /api/v1/protection/{key}/status
 * @requiresPermission {Dataplane} external-system:read
 */
async function getProtectionStatus(dataplaneUrl, authConfig, key) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(`${BASE}/${encodeURIComponent(key)}/status`);
  return unwrapBody(res);
}

/**
 * @param {*} body
 * @returns {Object[]}
 */
function extractProtectionListItems(body) {
  if (!body || typeof body !== 'object') {
    return [];
  }
  if (Array.isArray(body.data)) {
    return body.data;
  }
  if (Array.isArray(body.items)) {
    return body.items;
  }
  if (Array.isArray(body)) {
    return body;
  }
  return [];
}

/**
 * GET /api/v1/protection
 * @requiresPermission {Dataplane} external-system:read
 * @returns {Promise<{ items: Object[], meta: Object|null, raw: * }>}
 */
async function listProtectionManifests(dataplaneUrl, authConfig, options = {}) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(BASE, { params: options });
  const body = unwrapBody(res);
  return {
    items: extractProtectionListItems(body),
    meta: body && typeof body === 'object' && body.meta ? body.meta : null,
    raw: body
  };
}

/**
 * DELETE /api/v1/protection/{key}
 * @requiresPermission {Dataplane} external-system:delete
 */
async function deleteProtection(dataplaneUrl, authConfig, key) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  return await client.delete(`${BASE}/${encodeURIComponent(key)}`);
}

/**
 * Find deployed protection key by datasource key (client-side scan).
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {string} datasourceKey
 * @returns {Promise<string|null>}
 */
async function findProtectionKeyByDatasource(dataplaneUrl, authConfig, datasourceKey) {
  const { items } = await listProtectionManifests(dataplaneUrl, authConfig, {
    page: 1,
    pageSize: 100
  });
  const match = items.find((row) => String(row?.datasourceKey || '').trim() === datasourceKey);
  return match?.key ? String(match.key) : null;
}

module.exports = {
  validateProtection,
  simulateProtection,
  uploadProtection,
  getProtection,
  getProtectionStatus,
  listProtectionManifests,
  deleteProtection,
  findProtectionKeyByDatasource
};
