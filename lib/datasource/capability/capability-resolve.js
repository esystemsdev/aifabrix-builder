/**
 * Map logical capability names (capabilities[] / profiles) to openapi + CIP operation object keys.
 *
 * @fileoverview capabilities-first resolution when OpenAPI uses different casing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * @param {object|undefined} operations
 * @param {string} logicalKey
 * @returns {string[]}
 */
function findMatchingOpsKeys(operations, logicalKey) {
  if (!operations || typeof operations !== 'object') {
    return [];
  }
  if (operations[logicalKey] !== undefined) {
    return [logicalKey];
  }
  const lower = String(logicalKey).toLowerCase();
  return Object.keys(operations).filter((k) => k.toLowerCase() === lower);
}

/**
 * @param {object|undefined} operations
 * @param {string} logicalKey
 * @param {string} label - For error messages
 * @returns {string|null} Single match, or null
 * @throws {Error} When multiple keys differ only by case
 */
function resolveSingleOpsKey(operations, logicalKey, label) {
  const matches = findMatchingOpsKeys(operations, logicalKey);
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length === 0) {
    return null;
  }
  throw new Error(
    `Ambiguous ${label} operations keys for "${logicalKey}": ${matches.join(', ')}`
  );
}

/**
 * For --from on copy: when capabilities[] is non-empty, the name must appear there (case-insensitive).
 *
 * @param {object} doc
 * @param {string} userKey
 * @returns {string} Canonical string from capabilities[] or userKey when no list
 * @throws {Error} When capabilities is non-empty and no entry matches
 */
function resolveSourceCapabilityForCopy(doc, userKey) {
  const u = String(userKey).trim();
  const caps = doc.capabilities;
  if (Array.isArray(caps) && caps.length > 0) {
    const hit = caps.find((c) => String(c).toLowerCase() === u.toLowerCase());
    if (hit === undefined) {
      throw new Error(
        `Source capability "${userKey}" not found in capabilities[]. ` +
          'Use a name that appears in capabilities[] (case-insensitive match is allowed).'
      );
    }
    return String(hit);
  }
  return u;
}

/**
 * For remove: prefer canonical name from capabilities when present; otherwise use the user key.
 *
 * @param {object} doc
 * @param {string} userKey
 * @returns {string}
 */
function resolveLogicalNameForRemove(doc, userKey) {
  const u = String(userKey).trim();
  const caps = doc.capabilities;
  if (Array.isArray(caps) && caps.length > 0) {
    const hit = caps.find((c) => String(c).toLowerCase() === u.toLowerCase());
    if (hit !== undefined) {
      return String(hit);
    }
  }
  return u;
}

/**
 * Openapi + CIP object keys for a logical capability (exact or single case-insensitive match per section).
 *
 * @param {object} doc
 * @param {string} logicalKey
 * @returns {{ openapiKey: string, cipKey: string }}
 * @throws {Error} If a section is missing the operation
 */
function resolveOpsKeysForCapability(doc, logicalKey) {
  const openapiKey = resolveSingleOpsKey(doc.openapi?.operations, logicalKey, 'openapi');
  const cipKey = resolveSingleOpsKey(doc.execution?.cip?.operations, logicalKey, 'cip');
  if (!openapiKey) {
    throw new Error(
      `Missing openapi.operations entry for capability "${logicalKey}" ` +
        '(no exact or case-insensitive key match).'
    );
  }
  if (!cipKey) {
    throw new Error(
      `Missing execution.cip.operations entry for capability "${logicalKey}" ` +
        '(no exact or case-insensitive key match).'
    );
  }
  return { openapiKey, cipKey };
}

/**
 * @param {object} doc
 * @param {string} logicalKey
 * @returns {string|null} profiles key to use, or null
 * @throws {Error} On ambiguous profile keys
 */
function resolveProfileKeyForLogical(doc, logicalKey) {
  const prof = doc.exposed?.profiles;
  if (!prof || typeof prof !== 'object') {
    return null;
  }
  if (prof[logicalKey] !== undefined) {
    return logicalKey;
  }
  const lower = String(logicalKey).toLowerCase();
  const keys = Object.keys(prof).filter((k) => k.toLowerCase() === lower);
  if (keys.length === 1) {
    return keys[0];
  }
  if (keys.length > 1) {
    throw new Error(
      `Ambiguous exposed.profiles keys for "${logicalKey}": ${keys.join(', ')}`
    );
  }
  return null;
}

/**
 * True if the name appears in capabilities (case-insensitive) or in openapi or CIP operations (case-insensitive).
 *
 * @param {object} doc
 * @param {string} name
 * @returns {boolean}
 */
function capabilityLogicalExists(doc, name) {
  if (
    Array.isArray(doc.capabilities) &&
    doc.capabilities.some((c) => String(c).toLowerCase() === String(name).toLowerCase())
  ) {
    return true;
  }
  if (findMatchingOpsKeys(doc.openapi?.operations, name).length > 0) {
    return true;
  }
  if (findMatchingOpsKeys(doc.execution?.cip?.operations, name).length > 0) {
    return true;
  }
  return false;
}

module.exports = {
  findMatchingOpsKeys,
  resolveSingleOpsKey,
  resolveSourceCapabilityForCopy,
  resolveLogicalNameForRemove,
  resolveOpsKeysForCapability,
  resolveProfileKeyForLogical,
  capabilityLogicalExists
};
