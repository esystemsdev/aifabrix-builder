/**
 * Canonical secret name normalization for env keys.
 *
 * @fileoverview Split from secrets.js for module size limits
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * Generates a canonical secret name from an environment variable key.
 * Converts to lowercase, replaces non-alphanumeric characters with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 *
 * @param {string} key - Environment variable key (e.g., JWT_SECRET)
 * @returns {string} Canonical secret name (e.g., jwt-secret)
 */
function getCanonicalSecretName(key) {
  if (!key || typeof key !== 'string') {
    return '';
  }
  const withHyphens = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  const lower = withHyphens.toLowerCase();
  const hyphenated = lower.replace(/[^a-z0-9]/g, '-');
  const collapsed = hyphenated.replace(/-+/g, '-');
  return collapsed.replace(/^-+|-+$/g, '');
}

module.exports = {
  getCanonicalSecretName
};
