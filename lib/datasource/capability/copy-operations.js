/**
 * Clone a capability within one datasource JSON document.
 *
 * @fileoverview capability copy / collision / profile sync
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { rewriteCapabilityReferences } = require('./reference-rewrite');
const { jsonPointerPath } = require('./json-pointer');
const { buildBasicExposureProfileArray } = require('./basic-exposure');
const {
  resolveProfileKeyForLogical,
  capabilityLogicalExists,
  resolveOpsKeysForCapability,
  resolveSourceCapabilityForCopy,
  findMatchingOpsKeys
} = require('./capability-resolve');
const { copyTestPayloadScenarios } = require('./copy-test-payload');
const { storageOpsKey } = require('./capability-storage-keys');

/**
 * @param {object} doc - Datasource object
 * @param {string} name - Capability key
 * @returns {boolean}
 */
function capabilityExists(doc, name) {
  return capabilityLogicalExists(doc, name);
}

/**
 * @param {object} doc - Mutated datasource
 * @param {string} logicalKey - Logical capability name (matches capabilities[] casing when listed)
 * @returns {void}
 */
function removeCapability(doc, logicalKey) {
  const oo = doc.openapi?.operations;
  const co = doc.execution?.cip?.operations;
  const openapiKeys = findMatchingOpsKeys(oo, logicalKey);
  const cipKeys = findMatchingOpsKeys(co, logicalKey);
  if (openapiKeys.length > 1) {
    throw new Error(
      `Ambiguous openapi.operations keys for "${logicalKey}": ${openapiKeys.join(', ')}`
    );
  }
  if (cipKeys.length > 1) {
    throw new Error(
      `Ambiguous execution.cip.operations keys for "${logicalKey}": ${cipKeys.join(', ')}`
    );
  }
  const openapiKey = openapiKeys[0];
  const cipKey = cipKeys[0];
  const profileKey = resolveProfileKeyForLogical(doc, logicalKey);

  if (Array.isArray(doc.capabilities)) {
    doc.capabilities = doc.capabilities.filter(
      (c) => String(c).toLowerCase() !== String(logicalKey).toLowerCase()
    );
  }
  if (openapiKey && oo) {
    delete oo[openapiKey];
  }
  if (cipKey && co) {
    delete co[cipKey];
  }
  if (profileKey && doc.exposed?.profiles) {
    delete doc.exposed.profiles[profileKey];
  }
}

/**
 * @param {object} doc
 * @param {string} to - Desired target key
 * @param {boolean} overwrite
 * @returns {string} Same as `to` when free or when overwriting
 * @throws {Error} When target exists and overwrite is false
 */
function resolveTargetKey(doc, to, overwrite) {
  if (overwrite) {
    return to;
  }
  if (!capabilityExists(doc, to)) {
    return to;
  }
  throw new Error(
    `Capability "${to}" already exists (check capabilities[], openapi.operations, execution.cip.operations). ` +
      'Use --overwrite to replace it, or choose another --as name.'
  );
}

/**
 * @param {unknown} o
 * @returns {unknown}
 */
function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

/**
 * When opts.basicExposure is true, refuse to clobber an existing profile row unless overwriting.
 *
 * @param {object} doc
 * @param {string} resolvedAs
 * @param {boolean} overwrite
 * @param {boolean} basicExposure
 * @returns {void}
 * @throws {Error}
 */
function assertBasicExposureSlot(doc, resolvedAs, overwrite, basicExposure) {
  if (!basicExposure || overwrite) {
    return;
  }
  if (doc.exposed?.profiles?.[resolvedAs]) {
    throw new Error(
      `exposed.profiles.${resolvedAs} already exists. Use --overwrite or choose another --as name.`
    );
  }
}

/**
 * Copy exposed.profiles[from] → exposed.profiles[resolvedAs], or synthesize basic profile at resolvedAs.
 *
 * @param {object} doc
 * @param {object} opts
 * @param {string} from - Source capability key (matches profiles[from])
 * @param {string} resolvedAs - Target capability key (matches profiles[resolvedAs])
 * @param {object[]} patchOperations
 * @param {string[]} updatedSections
 * @returns {void}
 */
function copyExposedProfile(doc, opts, logicalFrom, resolvedAs, patchOperations, updatedSections) {
  if (!doc.exposed) {
    doc.exposed = {};
  }
  if (!doc.exposed.profiles) {
    doc.exposed.profiles = {};
  }

  if (opts.basicExposure) {
    const value = buildBasicExposureProfileArray(doc);
    doc.exposed.profiles[resolvedAs] = value;
    patchOperations.push({
      op: 'add',
      path: jsonPointerPath('exposed', 'profiles', resolvedAs),
      value
    });
    updatedSections.push(`exposed.profiles.${resolvedAs} (basic from metadataSchema)`);
    return;
  }

  const profileFrom = resolveProfileKeyForLogical(doc, logicalFrom);
  if (profileFrom !== null && doc.exposed.profiles[profileFrom] !== undefined) {
    doc.exposed.profiles[resolvedAs] = deepClone(doc.exposed.profiles[profileFrom]);
    patchOperations.push({
      op: 'add',
      path: jsonPointerPath('exposed', 'profiles', resolvedAs),
      value: doc.exposed.profiles[resolvedAs]
    });
    updatedSections.push(`exposed.profiles.${resolvedAs}`);
  }
}

/**
 * @param {object} doc
 * @param {string} from
 * @param {string} resolvedAs
 * @param {object[]} patchOperations
 * @param {string[]} updatedSections
 * @returns {void}
 */
function installClonedOperations(doc, fromKeys, resolvedAs, patchOperations, updatedSections) {
  const { openapiKey, cipKey, logicalFrom } = fromKeys;
  const targetOpsKey = storageOpsKey(resolvedAs);

  const openapiClone = deepClone(doc.openapi.operations[openapiKey]);
  rewriteCapabilityReferences(openapiClone, openapiKey, targetOpsKey);
  if (logicalFrom !== openapiKey) {
    rewriteCapabilityReferences(openapiClone, logicalFrom, targetOpsKey);
  }
  const cipClone = deepClone(doc.execution.cip.operations[cipKey]);
  rewriteCapabilityReferences(cipClone, cipKey, targetOpsKey);
  if (logicalFrom !== cipKey) {
    rewriteCapabilityReferences(cipClone, logicalFrom, targetOpsKey);
  }

  if (!doc.openapi.operations) {
    doc.openapi.operations = {};
  }
  if (!doc.execution.cip.operations) {
    doc.execution.cip.operations = {};
  }

  doc.openapi.operations[targetOpsKey] = openapiClone;
  patchOperations.push({
    op: 'add',
    path: jsonPointerPath('openapi', 'operations', targetOpsKey),
    value: openapiClone
  });
  updatedSections.push(`openapi.operations.${targetOpsKey} (logical ${resolvedAs})`);

  doc.execution.cip.operations[targetOpsKey] = cipClone;
  patchOperations.push({
    op: 'add',
    path: jsonPointerPath('execution', 'cip', 'operations', targetOpsKey),
    value: cipClone
  });
  updatedSections.push(`execution.cip.operations.${targetOpsKey} (logical ${resolvedAs})`);
}

/**
 * Install already-cloned openapi + CIP slices under storage key (no source read).
 *
 * @param {object} doc
 * @param {string} resolvedAs - Logical capability name (capabilities[])
 * @param {{ targetOpsKey: string, openapiClone: object, cipClone: object }} slices
 * @param {object[]} patchOperations
 * @param {string[]} updatedSections
 * @returns {void}
 */
function installPreparedSlices(doc, resolvedAs, slices, patchOperations, updatedSections) {
  const { targetOpsKey, openapiClone, cipClone } = slices;
  if (!doc.openapi.operations) {
    doc.openapi.operations = {};
  }
  if (!doc.execution.cip.operations) {
    doc.execution.cip.operations = {};
  }

  doc.openapi.operations[targetOpsKey] = openapiClone;
  patchOperations.push({
    op: 'add',
    path: jsonPointerPath('openapi', 'operations', targetOpsKey),
    value: openapiClone
  });
  updatedSections.push(`openapi.operations.${targetOpsKey} (logical ${resolvedAs})`);

  doc.execution.cip.operations[targetOpsKey] = cipClone;
  patchOperations.push({
    op: 'add',
    path: jsonPointerPath('execution', 'cip', 'operations', targetOpsKey),
    value: cipClone
  });
  updatedSections.push(`execution.cip.operations.${targetOpsKey} (logical ${resolvedAs})`);
}

/**
 * @param {object} doc
 * @param {string} resolvedAs
 * @param {object[]} patchOperations
 * @param {string[]} updatedSections
 * @returns {void}
 */
function appendCapabilityList(doc, resolvedAs, patchOperations, updatedSections) {
  if (!Array.isArray(doc.capabilities)) {
    doc.capabilities = [];
  }
  if (doc.capabilities.includes(resolvedAs)) {
    return;
  }
  doc.capabilities.push(resolvedAs);
  patchOperations.push({
    op: 'add',
    path: '/capabilities/-',
    value: resolvedAs
  });
  updatedSections.push(`capabilities[]: ${resolvedAs}`);
}

/**
 * Apply capability copy on a deep clone of the document.
 *
 * @param {object} originalDoc - Parsed datasource JSON
 * @param {object} opts - Options
 * @param {string} opts.from - Source capability key
 * @param {string} opts.to - Desired target key
 * @param {boolean} [opts.overwrite=false]
 * @param {boolean} [opts.basicExposure=false] - Build minimal profile from metadataSchema at exposed.profiles[to]
 * @param {boolean} [opts.includeTestPayload=false] - Clone matching testPayload.scenarios rows to target operation
 * @returns {{
 *   doc: object,
 *   resolvedAs: string,
 *   patchOperations: object[],
 *   updatedSections: string[]
 * }}
 */
function applyCapabilityCopy(originalDoc, opts) {
  const doc = deepClone(originalDoc);
  const logicalFrom = resolveSourceCapabilityForCopy(doc, opts.from);
  const { openapiKey, cipKey } = resolveOpsKeysForCapability(doc, logicalFrom);

  const openapiFrom = doc.openapi?.operations?.[openapiKey];
  const cipFrom = doc.execution?.cip?.operations?.[cipKey];

  if (!openapiFrom) {
    throw new Error(`Missing openapi.operations.${openapiKey}`);
  }
  if (!cipFrom) {
    throw new Error(`Missing execution.cip.operations.${cipKey}`);
  }

  const resolvedAs = resolveTargetKey(doc, opts.to, Boolean(opts.overwrite));
  assertBasicExposureSlot(doc, resolvedAs, Boolean(opts.overwrite), Boolean(opts.basicExposure));

  const patchOperations = [];
  const updatedSections = [];

  if (opts.overwrite && capabilityLogicalExists(doc, resolvedAs)) {
    removeCapability(doc, resolvedAs);
  }

  installClonedOperations(
    doc,
    { openapiKey, cipKey, logicalFrom },
    resolvedAs,
    patchOperations,
    updatedSections
  );
  appendCapabilityList(doc, resolvedAs, patchOperations, updatedSections);
  copyExposedProfile(doc, opts, logicalFrom, resolvedAs, patchOperations, updatedSections);
  copyTestPayloadScenarios(
    doc,
    opts,
    { openapiKey, cipKey, logicalFrom },
    resolvedAs,
    patchOperations,
    updatedSections
  );

  return {
    doc,
    resolvedAs,
    patchOperations,
    updatedSections
  };
}

module.exports = {
  applyCapabilityCopy,
  capabilityExists,
  capabilityLogicalExists,
  resolveTargetKey,
  deepClone,
  removeCapability,
  installPreparedSlices,
  appendCapabilityList,
  copyExposedProfile,
  assertBasicExposureSlot
};
