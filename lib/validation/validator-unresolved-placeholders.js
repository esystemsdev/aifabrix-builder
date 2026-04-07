/**
 * Scan deployment/config objects for unresolved ${VAR} placeholders (validator helper).
 *
 * @fileoverview Extracted from validator.js for ESLint max-lines
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/** Pattern matching ${VAR} style unresolved variables in strings */
const UNRESOLVED_VAR_REGEX = /\$\{[^}]+\}/g;

/** Allowed manifest placeholders in frontDoorRouting.host (expanded at run/resolve time; plan 122). */
const FRONT_DOOR_HOST_ALLOWED = /\$\{DEV_USERNAME\}|\$\{REMOTE_HOST\}/g;

/**
 * First ${...} still present after stripping allowed DEV_USERNAME / REMOTE_HOST segments, or null.
 * @param {string} str
 * @returns {string|null}
 */
function getFrontDoorHostFirstForbiddenPlaceholder(str) {
  let t = String(str).trim();
  t = t.replace(FRONT_DOOR_HOST_ALLOWED, '');
  t = t.replace(/^\.+|\.+$/g, '').trim();
  const m = t.match(UNRESOLVED_VAR_REGEX);
  return m ? m[0] : null;
}

/**
 * @param {string} obj
 * @param {string} prefix
 * @returns {string[]}
 */
function collectStringUnresolved(obj, prefix) {
  if (prefix === 'frontDoorRouting.host') {
    const bad = getFrontDoorHostFirstForbiddenPlaceholder(obj);
    return bad ? [`${prefix}: ${bad}`] : [];
  }
  const matches = obj.match(UNRESOLVED_VAR_REGEX);
  if (matches && matches.length > 0) {
    const pathLabel = prefix || 'value';
    return [`${pathLabel}: ${matches[0]}`];
  }
  return [];
}

/**
 * Recursively finds all string values in obj that contain ${...} placeholders.
 *
 * @param {Object} obj - Object to scan (e.g. deployment manifest)
 * @param {string} [prefix=''] - Path prefix for error reporting
 * @returns {string[]} List of paths with example placeholder (e.g. "port: ${PORT}")
 */
function findUnresolvedVariablesInObject(obj, prefix = '') {
  const found = [];
  if (obj === null || obj === undefined) {
    return found;
  }
  if (typeof obj === 'string') {
    return collectStringUnresolved(obj, prefix);
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      found.push(...findUnresolvedVariablesInObject(item, `${prefix}[${i}]`));
    });
    return found;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      found.push(...findUnresolvedVariablesInObject(value, path));
    }
    return found;
  }
  return found;
}

/**
 * Validates that deployment manifest contains no unresolved ${...} variables.
 * @param {Object} deployment - Deployment manifest object
 * @throws {Error} If any ${...} placeholders are found
 */
function validateNoUnresolvedVariablesInDeployment(deployment) {
  const unresolved = findUnresolvedVariablesInObject(deployment);
  if (unresolved.length > 0) {
    const examples = [...new Set(unresolved)].slice(0, 5).join(', ');
    throw new Error(
      `Deployment manifest contains unresolved variables (e.g. ${examples}). ` +
        'Use secret variables (kv://) in env.template for sensitive values, and set the application port as a number in application.yaml.'
    );
  }
}

module.exports = {
  findUnresolvedVariablesInObject,
  validateNoUnresolvedVariablesInDeployment
};
