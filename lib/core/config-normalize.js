/**
 * URL and developer-id normalization for runtime config.
 *
 * @fileoverview Shared normalizers used by lib/core/config.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/**
 * Normalize controller URL for consistent storage and lookup
 * @param {string} url - Controller URL to normalize
 * @returns {string|undefined|null} Normalized URL or original falsy
 */
function normalizeControllerUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  let normalized = url.trim().replace(/\/+$/, '');
  if (!normalized.match(/^https?:\/\//)) {
    normalized = `http://${normalized}`;
  }
  return normalized;
}

/**
 * Validate and normalize developer ID
 * @param {*} developerId - Developer ID value (can be string, number, undefined, or null)
 * @returns {string} Normalized developer ID as string
 * @throws {Error} If developer ID is invalid
 */
function validateAndNormalizeDeveloperId(developerId) {
  const DEV_ID_DIGITS_REGEX = /^[0-9]+$/;

  if (typeof developerId === 'undefined' || developerId === null) {
    return '0';
  }

  if (typeof developerId === 'number') {
    if (developerId < 0 || !Number.isFinite(developerId)) {
      throw new Error('Developer ID must be a non-negative digit string or number');
    }
    return String(developerId);
  }

  if (typeof developerId === 'string') {
    if (!DEV_ID_DIGITS_REGEX.test(developerId)) {
      throw new Error('Developer ID must be a non-negative digit string or number');
    }
    return developerId;
  }

  throw new Error('Developer ID must be a non-negative digit string or number');
}

module.exports = {
  normalizeControllerUrl,
  validateAndNormalizeDeveloperId
};
