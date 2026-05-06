/**
 * Normalize and validate external datasource capability keys.
 *
 * @fileoverview Capability key helpers for datasource capability CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/** Pattern aligned with external-datasource.schema.json capabilities[].items */
const CAPABILITY_KEY_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;

/**
 * @param {string} raw - Raw CLI input
 * @param {string} label - Option label for errors
 * @returns {string} Normalized key
 * @throws {Error} If empty or invalid
 */
function normalizeCapabilityKey(raw, label = 'capability') {
  const s = String(raw || '').trim();
  if (!s) {
    throw new Error(`${label} key is required`);
  }
  if (!CAPABILITY_KEY_PATTERN.test(s)) {
    throw new Error(
      `${label} key "${s}" is invalid: must match ${CAPABILITY_KEY_PATTERN}`
    );
  }
  return s;
}

module.exports = {
  normalizeCapabilityKey,
  CAPABILITY_KEY_PATTERN
};
