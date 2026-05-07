/**
 * @fileoverview Dimensions API (Controller /api/v1/dimensions)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { ApiClient } = require('./index');

const BASE = '/api/v1/dimensions';

/**
 * List dimensions (paginated)
 * @requiresPermission {Controller} dimensions:read
 * @async
 * @function listDimensions
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} [options]
 * @param {number} [options.page]
 * @param {number} [options.pageSize]
 * @param {string} [options.sort]
 * @param {string} [options.filter]
 * @param {string} [options.search]
 * @returns {Promise<Object>}
 */
async function listDimensions(controllerUrl, authConfig, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(BASE, { params: options });
}

/**
 * Get a dimension by id or key
 * @requiresPermission {Controller} dimensions:read
 * @async
 * @function getDimension
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} dimensionIdOrKey
 * @param {Object} [options]
 * @param {boolean} [options.includeValues]
 * @returns {Promise<Object>}
 */
async function getDimension(controllerUrl, authConfig, dimensionIdOrKey, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  const params = {};
  if (options.includeValues !== undefined && options.includeValues !== null) {
    params.includeValues = options.includeValues;
  }
  return await client.get(`${BASE}/${encodeURIComponent(dimensionIdOrKey)}`, { params });
}

/**
 * Create a dimension
 * @requiresPermission {Controller} dimensions:create
 * @async
 * @function createDimension
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} body
 * @returns {Promise<Object>}
 */
async function createDimension(controllerUrl, authConfig, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  const payload = {
    key: body.key,
    displayName: body.displayName,
    dataType: body.dataType
  };
  if (body.description !== undefined && body.description !== null && body.description !== '') {
    payload.description = body.description;
  }
  if (body.isRequired !== undefined && body.isRequired !== null) {
    payload.isRequired = Boolean(body.isRequired);
  }
  return await client.post(BASE, { body: payload });
}

/**
 * Create-if-missing (idempotent by default): if a dimension already exists for the key, return it as success.
 * @requiresPermission {Controller} dimensions:read + dimensions:create
 * @async
 * @function createDimensionIdempotent
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {Object} body
 * @returns {Promise<{ created: boolean, response: Object }>}
 */
async function createDimensionIdempotent(controllerUrl, authConfig, body) {
  const key = String(body?.key || '').trim();
  if (!key) {
    throw new Error('Dimension key is required');
  }
  const getRes = await getDimension(controllerUrl, authConfig, key);
  if (getRes && getRes.success === true) {
    return { created: false, response: getRes };
  }
  // Not found or other read failure; attempt create and let errors surface.
  const createRes = await createDimension(controllerUrl, authConfig, body);
  if (createRes && createRes.success === true) {
    return { created: true, response: createRes };
  }
  const msg = createRes?.error || createRes?.formattedError || 'Failed to create dimension';
  throw new Error(msg);
}

module.exports = {
  listDimensions,
  getDimension,
  createDimension,
  createDimensionIdempotent
};

