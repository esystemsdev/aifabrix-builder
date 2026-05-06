/**
 * Optional capability-key checks after schema validation.
 *
 * @fileoverview capability validate command helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { normalizeCapabilityKey } = require('./capability-key');

/**
 * Lists structural locations where a capability key should appear.
 *
 * @param {object} parsed - Datasource JSON
 * @param {string} rawKey - Capability key
 * @returns {{ key: string, missing: string[] }}
 */
function checkCapabilitySlices(parsed, rawKey) {
  const key = normalizeCapabilityKey(rawKey, 'capability');
  const missing = [];
  if (!Array.isArray(parsed.capabilities) || !parsed.capabilities.includes(key)) {
    missing.push(`capabilities[] (missing "${key}")`);
  }
  if (!parsed.openapi?.operations?.[key]) {
    missing.push(`openapi.operations.${key}`);
  }
  if (!parsed.execution?.cip?.operations?.[key]) {
    missing.push(`execution.cip.operations.${key}`);
  }
  return { key, missing };
}

module.exports = {
  checkCapabilitySlices
};
