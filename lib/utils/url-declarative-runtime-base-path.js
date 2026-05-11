/**
 * Runtime base path helpers for declarative url:// resolution.
 *
 * @fileoverview Keeps path-aware internal URLs out of the main resolver file.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * Runtime base path is derived from the existing frontDoorRouting path only
 * when that path is active for the target app.
 * @param {string|null|undefined} patternPath
 * @param {Object} r
 * @returns {string}
 */
function normalizeRuntimeBasePath(patternPath, r) {
  if (!r.frontDoorIngressActive) {
    return '';
  }
  const value = String(patternPath || '').trim();
  if (!value || value === '/') {
    return '';
  }
  const pathValue = value.startsWith('/') ? value : `/${value}`;
  return pathValue.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
}

module.exports = {
  normalizeRuntimeBasePath
};
