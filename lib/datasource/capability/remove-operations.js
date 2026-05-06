/**
 * Remove a capability from one datasource JSON document (including profile + testPayload cleanup).
 *
 * @fileoverview capability remove — inverse of copy
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { jsonPointerPath } = require('./json-pointer');
const {
  capabilityExists,
  removeCapability,
  deepClone
} = require('./copy-operations');
const {
  resolveLogicalNameForRemove,
  findMatchingOpsKeys,
  resolveProfileKeyForLogical
} = require('./capability-resolve');

/**
 * @param {unknown} capabilities
 * @param {string} logicalName
 * @returns {number} Index or -1
 */
function findCapabilityIndex(capabilities, logicalName) {
  if (!Array.isArray(capabilities)) {
    return -1;
  }
  return capabilities.findIndex(
    (c) => String(c).toLowerCase() === String(logicalName).toLowerCase()
  );
}

/**
 * Planned RFC 6902 remove ops against `originalDoc` (before mutation). Paths use actual
 * openapi/CIP object keys and scenario array indices (descending order for stability).
 *
 * @param {object} originalDoc
 * @param {string} logicalName
 * @param {string|undefined} openapiKey
 * @param {string|undefined} cipKey
 * @param {string|null} profileKey
 * @returns {object[]}
 */
function buildRemovePatchOperations(originalDoc, logicalName, openapiKey, cipKey, profileKey) {
  const ops = [];

  const capIdx = findCapabilityIndex(originalDoc.capabilities, logicalName);
  if (capIdx >= 0) {
    ops.push({ op: 'remove', path: `/capabilities/${capIdx}` });
  }

  const ooPath = openapiKey ?? logicalName;
  if (originalDoc.openapi?.operations?.[ooPath] !== undefined) {
    ops.push({ op: 'remove', path: jsonPointerPath('openapi', 'operations', ooPath) });
  }

  const cipPath = cipKey ?? logicalName;
  if (originalDoc.execution?.cip?.operations?.[cipPath] !== undefined) {
    ops.push({ op: 'remove', path: jsonPointerPath('execution', 'cip', 'operations', cipPath) });
  }

  if (
    profileKey !== null &&
    profileKey !== undefined &&
    originalDoc.exposed?.profiles?.[profileKey] !== undefined
  ) {
    ops.push({ op: 'remove', path: jsonPointerPath('exposed', 'profiles', profileKey) });
  }

  const aliases = new Set(
    [logicalName, openapiKey, cipKey].filter((x) => x !== undefined && x !== null && x !== '')
  );
  pushScenarioRemovePatches(originalDoc, aliases, ops);

  return ops;
}

/**
 * @param {object} originalDoc
 * @param {Set<string>} aliases
 * @param {object[]} ops
 * @returns {void}
 */
function pushScenarioRemovePatches(originalDoc, aliases, ops) {
  const scenarios = originalDoc.testPayload?.scenarios;
  if (!Array.isArray(scenarios)) {
    return;
  }
  const idxs = [];
  scenarios.forEach((s, i) => {
    if (s && aliases.has(s.operation)) {
      idxs.push(i);
    }
  });
  idxs.sort((a, b) => b - a);
  for (const i of idxs) {
    ops.push({ op: 'remove', path: jsonPointerPath('testPayload', 'scenarios', String(i)) });
  }
}

/**
 * Drop testPayload.scenarios entries whose `operation` matches any alias (logical + openapi/cip keys).
 *
 * @param {object} doc - Mutated datasource
 * @param {string} logicalKey - Canonical capability name
 * @param {string|undefined} openapiKey - openapi.operations key removed
 * @param {string|undefined} cipKey - cip.operations key removed
 * @returns {boolean} True if the scenarios array changed
 */
function pruneTestPayloadScenarios(doc, logicalKey, openapiKey, cipKey) {
  const scenarios = doc.testPayload?.scenarios;
  if (!Array.isArray(scenarios)) {
    return false;
  }
  const aliases = new Set(
    [logicalKey, openapiKey, cipKey].filter((x) => x !== undefined && x !== null && x !== '')
  );
  const next = scenarios.filter((s) => !s || !aliases.has(s.operation));
  if (next.length === scenarios.length) {
    return false;
  }
  doc.testPayload.scenarios = next;
  return true;
}

/**
 * Drop empty `testPayload.scenarios`, then remove `testPayload` when it becomes `{}`.
 *
 * @param {object} doc - Mutated datasource
 * @returns {boolean} True if something was deleted from the tree
 */
function finalizeTestPayloadShape(doc) {
  let changed = false;
  const tp = doc.testPayload;
  if (!tp || typeof tp !== 'object') {
    return false;
  }
  if (Array.isArray(tp.scenarios) && tp.scenarios.length === 0) {
    delete tp.scenarios;
    changed = true;
  }
  if (Object.keys(tp).length === 0) {
    delete doc.testPayload;
    changed = true;
  }
  return changed;
}

/**
 * Remove `exposed.profiles` when it is an empty object after profile deletion.
 *
 * @param {object} doc - Mutated datasource
 * @returns {boolean} True if `exposed.profiles` was removed
 */
function finalizeEmptyExposedProfiles(doc) {
  if (!doc.exposed || typeof doc.exposed !== 'object') {
    return false;
  }
  const prof = doc.exposed.profiles;
  if (!prof || typeof prof !== 'object' || Object.keys(prof).length > 0) {
    return false;
  }
  delete doc.exposed.profiles;
  return true;
}

/**
 * Mutate doc after capability slices removed: scenarios, empty containers, summary lines.
 *
 * @param {object} doc - Cloned datasource (mutated)
 * @param {object} originalDoc - Original parsed JSON (for testPayload diff only)
 * @param {string} logicalName
 * @param {{ openapiKey?: string, cipKey?: string }} removedKeys - Actual openapi/CIP object keys removed
 * @param {string[]} updatedSections - Human-readable sections changed
 * @returns {void}
 */
function applyCapabilityRemoveSideEffects(
  doc,
  originalDoc,
  logicalName,
  removedKeys,
  updatedSections
) {
  const openapiKey = removedKeys?.openapiKey;
  const cipKey = removedKeys?.cipKey;
  const testPayloadBeforeJson = JSON.stringify(originalDoc.testPayload);
  pruneTestPayloadScenarios(doc, logicalName, openapiKey, cipKey);
  finalizeTestPayloadShape(doc);

  const ooPath = openapiKey ?? logicalName;
  const cipPath = cipKey ?? logicalName;
  updatedSections.push(
    'removed: capabilities / openapi.operations.' +
      ooPath +
      ' / execution.cip.operations.' +
      cipPath,
    'exposed.profiles / testPayload.scenarios (see JSON Patch paths)'
  );

  if (finalizeEmptyExposedProfiles(doc)) {
    updatedSections.push('exposed.profiles (removed empty object)');
  }

  if (testPayloadBeforeJson !== JSON.stringify(doc.testPayload)) {
    updatedSections.push('testPayload');
  }
}

/**
 * Apply capability removal on a deep clone of the document.
 *
 * @param {object} originalDoc - Parsed datasource JSON
 * @param {object} opts - Options
 * @param {string} opts.capability - Capability key to remove
 * @param {boolean} [opts.force=false] - If true and capability absent, return unchanged doc
 * @returns {{
 *   doc: object,
 *   removed: boolean,
 *   patchOperations: object[],
 *   updatedSections: string[]
 * }}
 */
function applyCapabilityRemove(originalDoc, opts) {
  const doc = deepClone(originalDoc);
  const name = opts.capability;
  const updatedSections = [];

  if (!capabilityExists(doc, name)) {
    if (!opts.force) {
      throw new Error(
        `Capability "${name}" not found in capabilities[], openapi.operations, or execution.cip.operations. ` +
          'Use --force to succeed when the capability is already absent.'
      );
    }
    return {
      doc,
      removed: false,
      patchOperations: [],
      updatedSections: ['capability already absent (--force)']
    };
  }

  const logicalName = resolveLogicalNameForRemove(doc, name);
  const openapiKey = findMatchingOpsKeys(originalDoc.openapi?.operations, logicalName)[0];
  const cipKey = findMatchingOpsKeys(originalDoc.execution?.cip?.operations, logicalName)[0];
  const profileKey = resolveProfileKeyForLogical(originalDoc, logicalName);

  const patchOperations = buildRemovePatchOperations(
    originalDoc,
    logicalName,
    openapiKey,
    cipKey,
    profileKey
  );

  removeCapability(doc, logicalName);
  applyCapabilityRemoveSideEffects(doc, originalDoc, logicalName, { openapiKey, cipKey }, updatedSections);

  return {
    doc,
    removed: true,
    patchOperations,
    updatedSections
  };
}

module.exports = {
  applyCapabilityRemove,
  buildRemovePatchOperations,
  pruneTestPayloadScenarios,
  finalizeTestPayloadShape,
  finalizeEmptyExposedProfiles
};
