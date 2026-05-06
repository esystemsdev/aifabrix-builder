/**
 * Extract a comparable subtree for `capability diff`.
 *
 * @fileoverview capability slice extraction for diff
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { deepClone } = require('./copy-operations');

/**
 * @param {object} doc - Parsed datasource JSON
 * @param {string} capabilityKey - Normalized capability key
 * @param {string} [profileKey] - Optional exposed.profiles key
 * @returns {object} Stable-shape slice for compareObjects
 */
function extractCapabilitySliceForDiff(doc, capabilityKey, profileKey) {
  const cap = capabilityKey;
  const listed =
    Boolean(Array.isArray(doc.capabilities) && doc.capabilities.includes(cap));
  const openapiOp = doc.openapi?.operations?.[cap];
  const cipOp = doc.execution?.cip?.operations?.[cap];
  let exposedProfile;
  if (profileKey && String(profileKey).trim()) {
    const pk = String(profileKey).trim();
    const raw = doc.exposed?.profiles?.[pk];
    exposedProfile = raw !== undefined ? deepClone(raw) : undefined;
  }

  return {
    capabilityKey: cap,
    listedInCapabilities: listed,
    openapiOperation: openapiOp !== undefined ? deepClone(openapiOp) : undefined,
    cipOperation: cipOp !== undefined ? deepClone(cipOp) : undefined,
    exposedProfile
  };
}

module.exports = {
  extractCapabilitySliceForDiff
};
