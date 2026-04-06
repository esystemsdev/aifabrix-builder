/**
 * Env-scoped kv:// resolution helpers (prefixed keys + in-memory aliases).
 *
 * @fileoverview Split from secrets-helpers for file size limits
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {Function} getValueByPath - From secrets-helpers
 * @returns {{ getValueByPathWithEnvScope: Function, mergeSecretsWithPrefixedCopies: Function }}
 */
function createScopedKvHelpers(getValueByPath) {
  /**
   * @param {Object} secrets
   * @param {string} pathStr
   * @param {string|null|undefined} envKey
   * @param {boolean} effective
   * @returns {*}
   */
  function getValueByPathWithEnvScope(secrets, pathStr, envKey, effective) {
    if (!effective || !envKey) {
      return getValueByPath(secrets, pathStr);
    }
    const prefix = `${String(envKey).toLowerCase()}-`;
    const prefixedPath = prefix + pathStr;
    const fromPrefixed = getValueByPath(secrets, prefixedPath);
    if (fromPrefixed !== undefined && fromPrefixed !== null) {
      return fromPrefixed;
    }
    return getValueByPath(secrets, pathStr);
  }

  /**
   * @param {Object} secrets
   * @param {string} envKey
   * @returns {Object}
   */
  function mergeSecretsWithPrefixedCopies(secrets, envKey) {
    if (!secrets || typeof secrets !== 'object' || !envKey) {
      return secrets;
    }
    const prefix = `${String(envKey).toLowerCase()}-`;
    const merged = { ...secrets };
    for (const [k, v] of Object.entries(secrets)) {
      if (typeof k !== 'string' || !k || k.startsWith(prefix)) continue;
      const pk = prefix + k;
      if (merged[pk] === undefined && v !== undefined && v !== null) {
        merged[pk] = v;
      }
    }
    return merged;
  }

  return { getValueByPathWithEnvScope, mergeSecretsWithPrefixedCopies };
}

module.exports = { createScopedKvHelpers };
