/**
 * @fileoverview Normalize dataplane Records Search client responses
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * Unwrap ApiClient `{ success, data: { data, meta, links } }` to a flat search result.
 * @param {Object} response - Raw client.post result
 * @returns {{ success: boolean, data: Array, meta: Object, links?: Object, status?: number, error?: string, formattedError?: string }}
 */
function normalizeRecordsSearchClientResponse(response) {
  if (!response || response.success !== true) {
    return response || { success: false, data: [], meta: {} };
  }

  const body = response.data;
  if (body && typeof body === 'object' && Array.isArray(body.data)) {
    return {
      success: true,
      data: body.data,
      meta: body.meta && typeof body.meta === 'object' ? body.meta : {},
      links: body.links,
      status: response.status
    };
  }

  if (Array.isArray(body)) {
    return {
      success: true,
      data: body,
      meta: response.meta && typeof response.meta === 'object' ? response.meta : {},
      status: response.status
    };
  }

  return {
    success: true,
    data: [],
    meta: body && typeof body === 'object' && body.meta ? body.meta : {},
    status: response.status
  };
}

module.exports = {
  normalizeRecordsSearchClientResponse
};
