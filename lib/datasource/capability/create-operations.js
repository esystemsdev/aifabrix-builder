/**
 * Create capability without --from: OpenAPI operationId match or JSON template.
 *
 * @fileoverview Plan 132 Phase 3 — template / openapi-operation create
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const {
  applyCapabilityCopy,
  deepClone,
  removeCapability,
  installPreparedSlices,
  appendCapabilityList,
  copyExposedProfile,
  assertBasicExposureSlot,
  resolveTargetKey
} = require('./copy-operations');
const { rewriteCapabilityReferences } = require('./reference-rewrite');
const { storageOpsKey } = require('./capability-storage-keys');
const { capabilityLogicalExists } = require('./capability-resolve');

/**
 * @param {string} targetOpsKey
 * @returns {object}
 */
function buildMinimalCip(targetOpsKey) {
  return {
    enabled: true,
    steps: [{ fetch: { source: 'openapi', openapiRef: targetOpsKey } }]
  };
}

/**
 * @param {object} originalDoc
 * @param {object} opts
 * @returns {{ doc: object, resolvedAs: string, targetOpsKey: string }}
 */
function prepareDocForNewCapability(originalDoc, opts) {
  const doc = deepClone(originalDoc);
  const resolvedAs = resolveTargetKey(doc, opts.to, Boolean(opts.overwrite));
  assertBasicExposureSlot(doc, resolvedAs, Boolean(opts.overwrite), Boolean(opts.basicExposure));
  const targetOpsKey = storageOpsKey(resolvedAs);
  if (opts.overwrite && capabilityLogicalExists(doc, resolvedAs)) {
    removeCapability(doc, resolvedAs);
  }
  return { doc, resolvedAs, targetOpsKey };
}

/**
 * @param {object} doc
 * @param {string} resolvedAs
 * @param {{ targetOpsKey: string, openapiClone: object, cipClone: object }} slices
 * @param {object} opts
 * @param {object[]} patchOperations
 * @param {string[]} updatedSections
 * @returns {void}
 */
function finalizeNewCapabilitySlices(doc, resolvedAs, slices, opts, patchOperations, updatedSections) {
  installPreparedSlices(doc, resolvedAs, slices, patchOperations, updatedSections);
  appendCapabilityList(doc, resolvedAs, patchOperations, updatedSections);
  copyExposedProfile(
    doc,
    { basicExposure: Boolean(opts.basicExposure), includeTestPayload: false },
    resolvedAs,
    resolvedAs,
    patchOperations,
    updatedSections
  );
}

/**
 * @param {object} doc
 * @param {string} operationId
 * @returns {string[]}
 */
function findOpenapiKeysByOperationId(doc, operationId) {
  const ops = doc.openapi?.operations;
  if (!ops || typeof ops !== 'object') {
    return [];
  }
  const want = String(operationId).trim().toLowerCase();
  const keys = [];
  for (const k of Object.keys(ops)) {
    const oid = ops[k]?.operationId;
    if (oid !== undefined && String(oid).trim().toLowerCase() === want) {
      keys.push(k);
    }
  }
  return keys;
}

/**
 * @param {object} originalDoc
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.openApiOperationId
 * @param {boolean} [opts.overwrite]
 * @param {boolean} [opts.basicExposure]
 * @returns {object}
 */
function applyCreateFromOpenApiOperation(originalDoc, opts) {
  const operationId = String(opts.openApiOperationId).trim();
  const keys = findOpenapiKeysByOperationId(originalDoc, operationId);
  if (keys.length === 0) {
    throw new Error(`No openapi.operations entry with operationId "${operationId}"`);
  }
  if (keys.length > 1) {
    throw new Error(
      `Ambiguous operationId "${operationId}": openapi.operations keys ${keys.join(', ')}`
    );
  }
  const sourceOpenapiKey = keys[0];
  const { doc, resolvedAs, targetOpsKey } = prepareDocForNewCapability(originalDoc, opts);

  const openapiClone = deepClone(doc.openapi.operations[sourceOpenapiKey]);
  rewriteCapabilityReferences(openapiClone, sourceOpenapiKey, targetOpsKey);

  const patchOperations = [];
  const updatedSections = [];
  finalizeNewCapabilitySlices(
    doc,
    resolvedAs,
    { targetOpsKey, openapiClone, cipClone: buildMinimalCip(targetOpsKey) },
    opts,
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

/**
 * @param {object} originalDoc
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.template
 * @param {boolean} [opts.overwrite]
 * @param {boolean} [opts.basicExposure]
 * @returns {object}
 */
function applyCreateFromTemplate(originalDoc, opts) {
  const name = String(opts.template).trim();
  const templatePath = path.join(__dirname, 'templates', `${name}.json`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Unknown template "${name}" (not found next to capability templates)`);
  }
  const template = _readCapabilityTemplateOrThrow(templatePath, name);
  if (!template.openapiOperation || !template.cipOperation) {
    throw new Error('Template must include top-level openapiOperation and cipOperation objects');
  }

  const { doc, resolvedAs, targetOpsKey } = prepareDocForNewCapability(originalDoc, opts);
  const openapiClone = deepClone(template.openapiOperation);
  const cipJson = JSON.stringify(template.cipOperation).replace(/__STORAGE_KEY__/g, targetOpsKey);
  const cipClone = JSON.parse(cipJson);

  const patchOperations = [];
  const updatedSections = [];
  finalizeNewCapabilitySlices(
    doc,
    resolvedAs,
    { targetOpsKey, openapiClone, cipClone },
    opts,
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

function _readCapabilityTemplateOrThrow(templatePath, name) {
  let templateRaw;
  try {
    templateRaw = fs.readFileSync(templatePath, 'utf8');
  } catch (e) {
    // Jest suites may partially mock fs.existsSync; treat missing files as unknown template.
    if (e && e.code === 'ENOENT') {
      throw new Error(`Unknown template "${name}" (not found next to capability templates)`);
    }
    throw e;
  }
  return JSON.parse(templateRaw);
}

/**
 * Exactly one of: opts.from, opts.openApiOperationId, opts.template.
 *
 * @param {object} originalDoc
 * @param {object} opts
 * @returns {object}
 */
function applyCapabilityCreate(originalDoc, opts) {
  const hasFrom = opts.from !== undefined && opts.from !== null && String(opts.from).trim() !== '';
  const hasOid =
    opts.openApiOperationId !== undefined &&
    opts.openApiOperationId !== null &&
    String(opts.openApiOperationId).trim() !== '';
  const hasTpl =
    opts.template !== undefined && opts.template !== null && String(opts.template).trim() !== '';

  const count = [hasFrom, hasOid, hasTpl].filter(Boolean).length;
  if (count !== 1) {
    throw new Error(
      'Specify exactly one of: --from <key>, --template <name>, --openapi-operation <operationId>'
    );
  }

  if (hasFrom) {
    return applyCapabilityCopy(originalDoc, opts);
  }
  if (hasOid) {
    return applyCreateFromOpenApiOperation(originalDoc, opts);
  }
  return applyCreateFromTemplate(originalDoc, opts);
}

module.exports = {
  applyCapabilityCreate,
  applyCreateFromOpenApiOperation,
  applyCreateFromTemplate,
  findOpenapiKeysByOperationId
};
