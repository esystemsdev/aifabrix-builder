/**
 * Semantic validation for `datasource capability relate`.
 *
 * Pure validation module: no CLI/auth logic.
 *
 * @fileoverview relate semantic validator
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/**
 * @typedef {Object} RelateLocalContext
 * @property {any} sourceDoc
 * @property {any|null} targetDocLocal
 * @property {string} targetDatasourceKey
 * @property {string[]} fields
 * @property {string[]|undefined} targetFields
 */

/**
 * @typedef {Object} RelateValidationInput
 * @property {RelateLocalContext} localContext
 * @property {any|null} remoteManifest - remote target datasource config (or null)
 */

/**
 * @typedef {Object} RelateValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {string[]} warnings
 * @property {{ targetDoc: any|null, resolvedTargetFields: string[] }} resolved
 */

function _asObject(x) {
  return x && typeof x === 'object' ? x : null;
}

function _getMetadataProp(doc, fieldName) {
  const props = doc?.metadataSchema?.properties;
  if (!props || typeof props !== 'object') return null;
  const node = props[fieldName];
  return _asObject(node);
}

function _getFieldMappingsAttributes(doc) {
  const attrs = doc?.fieldMappings?.attributes;
  return attrs && typeof attrs === 'object' ? attrs : null;
}

function _normalizeType(node) {
  const t = node?.type;
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) {
    // common JSONSchema pattern: ["string","null"]
    const nonNull = t.filter((x) => x && x !== 'null');
    if (nonNull.length === 1 && typeof nonNull[0] === 'string') return nonNull[0];
  }
  return null;
}

function _isNullable(node) {
  // dataplane uses `nullable: true` convention in config metadataSchema
  return node?.nullable === true;
}

/**
 * @param {RelateValidationInput} input
 * @returns {RelateValidationResult}
 */
function validateRelateSemantics(input) {
  const errors = [];
  const warnings = [];
  const local = input?.localContext;
  const source = local?.sourceDoc;
  const targetDatasourceKey = String(local?.targetDatasourceKey || '').trim();
  const fields = Array.isArray(local?.fields) ? local.fields : [];
  const resolvedTargetFields = _resolveTargetFields(local?.targetFields);

  if (!_asObject(source)) {
    errors.push('Local validation failed: sourceDoc missing or invalid.');
    return { ok: false, errors, warnings, resolved: { targetDoc: null, resolvedTargetFields } };
  }

  const sourceAttrs = _getFieldMappingsAttributes(source);
  const localFieldMeta = _validateSourceSide({ source, sourceAttrs, fields, errors });

  const targetDoc = _resolveTargetDoc(local?.targetDocLocal, input?.remoteManifest);
  if (!targetDoc) {
    errors.push(
      `Target datasource not found locally and remote validation did not provide a target config: ${targetDatasourceKey}`
    );
    return { ok: false, errors, warnings, resolved: { targetDoc: null, resolvedTargetFields } };
  }

  _validateJoinSemantics({
    targetDoc,
    targetDatasourceKey,
    fields,
    resolvedTargetFields,
    localFieldMeta,
    errors,
    warnings
  });

  return { ok: errors.length === 0, errors, warnings, resolved: { targetDoc, resolvedTargetFields } };
}

function _resolveTargetFields(targetFieldsRaw) {
  return Array.isArray(targetFieldsRaw) && targetFieldsRaw.length > 0
    ? targetFieldsRaw.map((x) => String(x).trim()).filter(Boolean)
    : ['externalId'];
}

function _resolveTargetDoc(targetDocLocal, remoteManifest) {
  if (_asObject(targetDocLocal)) return targetDocLocal;
  if (_asObject(remoteManifest)) return remoteManifest;
  return null;
}

function _validateSourceSide({ source, sourceAttrs, fields, errors }) {
  if (!fields || fields.length === 0) {
    errors.push('Local validation failed: at least one local field is required.');
    return {};
  }
  if (!sourceAttrs) {
    errors.push('Source must declare fieldMappings.attributes (object).');
  }

  /** @type {Record<string, { type: string|null, nullable: boolean }>} */
  const localFieldMeta = {};
  for (const f of fields) {
    const name = String(f || '').trim();
    if (!name) {
      errors.push('Local field names must be non-empty strings.');
      continue;
    }
    if (sourceAttrs && !(name in sourceAttrs)) {
      errors.push(`Source field not found in fieldMappings.attributes: ${name}`);
    }
    const node = _getMetadataProp(source, name);
    if (!node) {
      errors.push(`Source field not found in metadataSchema.properties: ${name}`);
      continue;
    }
    localFieldMeta[name] = { type: _normalizeType(node), nullable: _isNullable(node) };
  }
  return localFieldMeta;
}

function _validateJoinSemantics({
  targetDoc,
  targetDatasourceKey,
  fields,
  resolvedTargetFields,
  localFieldMeta,
  errors,
  warnings
}) {
  const targetAttrs = _getFieldMappingsAttributes(targetDoc);
  if (!targetAttrs) {
    warnings.push(`Target datasource is missing fieldMappings.attributes: ${targetDatasourceKey}`);
  }

  if (resolvedTargetFields.length !== fields.length) {
    errors.push(
      `Foreign key cardinality mismatch: ${fields.length} local field(s) vs ${resolvedTargetFields.length} target field(s).`
    );
    return;
  }

  for (let i = 0; i < fields.length; i += 1) {
    _validateJoinFieldPair({
      targetDoc,
      targetDatasourceKey,
      localName: String(fields[i] || '').trim(),
      targetName: String(resolvedTargetFields[i] || '').trim(),
      localFieldMeta,
      errors,
      warnings
    });
  }
}

function _validateJoinFieldPair({
  targetDoc,
  targetDatasourceKey,
  localName,
  targetName,
  localFieldMeta,
  errors,
  warnings
}) {
  if (!targetName) {
    errors.push('Target field names must be non-empty strings.');
    return;
  }
  const targetNode = _getMetadataProp(targetDoc, targetName);
  if (!targetNode) {
    errors.push(`Target field not found in metadataSchema.properties: ${targetDatasourceKey}.${targetName}`);
    return;
  }
  const lt = localFieldMeta[localName]?.type || null;
  const tt = _normalizeType(targetNode);
  if (lt && tt && lt !== tt) {
    errors.push(`Type mismatch: ${localName} (${lt}) does not match ${targetDatasourceKey}.${targetName} (${tt}).`);
  }
  const ln = localFieldMeta[localName]?.nullable === true;
  const tn = _isNullable(targetNode);
  if (ln !== tn) {
    warnings.push(`Nullable mismatch: ${localName} nullable=${ln} vs ${targetDatasourceKey}.${targetName} nullable=${tn}.`);
  }
}

module.exports = {
  validateRelateSemantics
};

