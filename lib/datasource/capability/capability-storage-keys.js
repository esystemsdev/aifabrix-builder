/**
 * Storage naming: openapi/CIP operation map keys and testPayload.scenarios.operation use lowercase.
 * capabilities[] and exposed.profiles use logical camelCase names (--as).
 *
 * @fileoverview capability storage key normalization for copy pipeline
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Lowercase key for openapi.operations / execution.cip.operations / scenario.operation.
 *
 * @param {string} logicalCapabilityKey - Normalized --as / capabilities[] name (e.g. updateCountry)
 * @returns {string}
 */
function storageOpsKey(logicalCapabilityKey) {
  return String(logicalCapabilityKey ?? '').trim().toLowerCase();
}

module.exports = {
  storageOpsKey
};
