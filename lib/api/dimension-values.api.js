/**
 * @fileoverview Dimension values API (Controller)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { ApiClient } = require('./index');

/**
 * List dimension values for a dimension
 * @requiresPermission {Controller} dimensions:read
 * @async
 * @function listDimensionValues
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} dimensionIdOrKey
 * @param {Object} [options]
 * @param {number} [options.page]
 * @param {number} [options.pageSize]
 * @param {string} [options.sort]
 * @param {string} [options.filter]
 * @param {string} [options.search]
 * @returns {Promise<Object>}
 */
async function listDimensionValues(controllerUrl, authConfig, dimensionIdOrKey, options = {}) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.get(`/api/v1/dimensions/${encodeURIComponent(dimensionIdOrKey)}/values`, {
    params: options
  });
}

/**
 * Create a dimension value under a dimension
 * @requiresPermission {Controller} dimensions:create
 * @async
 * @function createDimensionValue
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} dimensionIdOrKey
 * @param {Object} body
 * @param {string} body.value
 * @param {string} [body.displayName]
 * @param {string} [body.description]
 * @returns {Promise<Object>}
 */
async function createDimensionValue(controllerUrl, authConfig, dimensionIdOrKey, body) {
  const client = new ApiClient(controllerUrl, authConfig);
  const payload = { value: body.value };
  if (body.displayName !== undefined && body.displayName !== null && body.displayName !== '') {
    payload.displayName = body.displayName;
  }
  if (body.description !== undefined && body.description !== null && body.description !== '') {
    payload.description = body.description;
  }
  return await client.post(`/api/v1/dimensions/${encodeURIComponent(dimensionIdOrKey)}/values`, {
    body: payload
  });
}

/**
 * Delete a dimension value by id
 * @requiresPermission {Controller} dimensions:delete
 * @async
 * @function deleteDimensionValue
 * @param {string} controllerUrl
 * @param {Object} authConfig
 * @param {string} dimensionValueId
 * @returns {Promise<Object>}
 */
async function deleteDimensionValue(controllerUrl, authConfig, dimensionValueId) {
  const client = new ApiClient(controllerUrl, authConfig);
  return await client.delete(`/api/v1/dimension-values/${encodeURIComponent(dimensionValueId)}`);
}

module.exports = {
  listDimensionValues,
  createDimensionValue,
  deleteDimensionValue
};

