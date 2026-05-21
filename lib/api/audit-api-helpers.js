/**
 * @fileoverview Shared helpers for dataplane audit API responses
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { unwrapApiData } = require('../utils/external-system-readiness-core');

/**
 * @param {*} res
 * @throws {Error}
 */
function assertAuditApiSuccess(res) {
  if (!res || typeof res !== 'object') {
    throw new Error('Audit API returned an empty response');
  }
  if (res.success === false) {
    const msg =
      (res.error && (res.error.formattedError || res.error.error || res.error.message)) ||
      res.formattedError ||
      'Audit API request failed';
    const err = new Error(msg);
    if (res.status) err.status = res.status;
    throw err;
  }
}

/**
 * @param {*} res
 * @returns {{ data: Array, meta: Object|null, raw: Object|null }}
 */
function unwrapPaginatedAuditList(res) {
  assertAuditApiSuccess(res);
  const body = unwrapApiData(res);
  if (!body || typeof body !== 'object') {
    return { data: [], meta: null, raw: null };
  }
  const data = Array.isArray(body.data)
    ? body.data
    : Array.isArray(body.items)
      ? body.items
      : [];
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : null;
  return { data, meta, raw: body };
}

/**
 * Unwrap execution sub-resource envelope `{ root: T }`.
 * @param {*} res
 * @returns {*|null}
 */
function unwrapExecutionSubresource(res) {
  assertAuditApiSuccess(res);
  const body = unwrapApiData(res);
  if (body === null || body === undefined) return null;
  if (typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'root')) {
    return body.root;
  }
  return body;
}

module.exports = {
  assertAuditApiSuccess,
  unwrapPaginatedAuditList,
  unwrapExecutionSubresource
};
