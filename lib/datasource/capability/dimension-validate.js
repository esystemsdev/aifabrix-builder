/**
 * Semantic validation for `datasource capability dimension`.
 *
 * Pure validation module: no CLI/auth logic.
 *
 * @fileoverview dimension binding semantic validator
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

function _asObject(x) {
  return x && typeof x === 'object' && !Array.isArray(x) ? x : null;
}

function _getMetadataProp(doc, fieldName) {
  const props = doc?.metadataSchema?.properties;
  if (!props || typeof props !== 'object') return null;
  const node = props[fieldName];
  return _asObject(node);
}

function _collectForeignKeyNameSet(doc) {
  const fks = Array.isArray(doc?.foreignKeys) ? doc.foreignKeys : [];
  const out = new Set();
  for (const fk of fks) {
    const name = typeof fk?.name === 'string' ? fk.name.trim() : '';
    if (name) out.add(name);
  }
  return out;
}

function _findForeignKeyRow(doc, name) {
  const fks = Array.isArray(doc?.foreignKeys) ? doc.foreignKeys : [];
  return fks.find((fk) => fk && fk.name === name) || null;
}

/**
 * @typedef {Object} DimensionVia
 * @property {string} fk
 * @property {string} dimension
 */

/**
 * @typedef {Object} DimensionLocalContext
 * @property {any} sourceDoc
 * @property {string} dimensionKey
 * @property {'local'|'fk'} type
 * @property {string|undefined} field
 * @property {DimensionVia[]|undefined} via
 */

/**
 * @typedef {Object} DimensionValidationInput
 * @property {DimensionLocalContext} localContext
 * @property {Record<string, any>|null} remoteTargetsByKey - map: datasourceKey -> datasource config
 * @property {Set<string>|null} catalogDimensionKeys - dimension catalog keys when available
 */

/**
 * @typedef {Object} DimensionValidationResult
 * @property {boolean} ok
 * @property {string[]} errors
 * @property {string[]} warnings
 * @property {{ targetDatasourceKeys: string[] }} resolved
 */

/**
 * @param {DimensionValidationInput} input
 * @returns {DimensionValidationResult}
 */
function validateDimensionSemantics(input) {
  const errors = [];
  const warnings = [];
  const ctx = _normalizeInputOrReport(input, errors);
  if (!ctx) return { ok: false, errors, warnings, resolved: { targetDatasourceKeys: [] } };

  _validateCatalogKey({ input, dimensionKey: ctx.dimensionKey, errors });

  if (ctx.type === 'local') {
    _validateLocalBinding({ source: ctx.sourceDoc, field: ctx.field, errors });
    return { ok: errors.length === 0, errors, warnings, resolved: { targetDatasourceKeys: [] } };
  }

  const { targetDatasourceKeys } = _validateFkBinding({
    source: ctx.sourceDoc,
    via: ctx.via,
    remoteTargetsByKey: input?.remoteTargetsByKey,
    errors,
    warnings
  });
  return { ok: errors.length === 0, errors, warnings, resolved: { targetDatasourceKeys } };
}

function _normalizeInputOrReport(input, errors) {
  const local = input?.localContext;
  const sourceDoc = local?.sourceDoc;
  if (!_asObject(sourceDoc)) {
    errors.push('Local validation failed: sourceDoc missing or invalid.');
    return null;
  }
  const dimensionKey = String(local?.dimensionKey || '').trim();
  if (!dimensionKey) {
    errors.push('Local validation failed: dimensionKey missing or invalid.');
    return null;
  }
  const type = local?.type;
  if (type !== 'local' && type !== 'fk') {
    errors.push('Local validation failed: type must be "local" or "fk".');
    return null;
  }
  return {
    sourceDoc,
    dimensionKey,
    type,
    field: local?.field,
    via: local?.via
  };
}

function _validateCatalogKey({ input, dimensionKey, errors }) {
  if (input?.catalogDimensionKeys instanceof Set) {
    if (!input.catalogDimensionKeys.has(dimensionKey)) {
      errors.push(`Unknown dimension key (not found in dimension catalog): ${dimensionKey}`);
    }
  }
}

function _validateLocalBinding({ source, field, errors }) {
  const f = String(field || '').trim();
  if (!f) {
    errors.push('Local validation failed: --field is required for type=local.');
    return;
  }
  const node = _getMetadataProp(source, f);
  if (!node) {
    errors.push(`Source field not found in metadataSchema.properties: ${f}`);
  }
}

function _validateFkBinding({ source, via, remoteTargetsByKey, errors, warnings }) {
  const hops = Array.isArray(via) ? via : [];
  if (hops.length === 0) {
    errors.push('Local validation failed: at least one via entry is required for type=fk.');
    return { targetDatasourceKeys: [] };
  }

  const fkNameSet = _collectForeignKeyNameSet(source);
  const targets = _asObject(remoteTargetsByKey) ? remoteTargetsByKey : {};
  const targetDatasourceKeys = [];

  hops.forEach((hop) => {
    const resolved = _validateViaHop({
      source,
      fkNameSet,
      hop,
      errors,
      warnings
    });
    if (!resolved) return;
    targetDatasourceKeys.push(resolved.targetDatasource);
    _validateTargetDimensionIfAvailable({
      targets,
      targetDatasource: resolved.targetDatasource,
      targetDimKey: resolved.targetDimKey,
      errors
    });
  });

  return { targetDatasourceKeys };
}

function _validateViaHop({ source, fkNameSet, hop, errors, warnings }) {
  const fkName = String(hop?.fk || '').trim();
  const targetDimKey = String(hop?.dimension || '').trim();
  if (!fkName) {
    errors.push('via[].fk must be a non-empty string.');
    return null;
  }
  if (!targetDimKey) {
    errors.push('via[].dimension must be a non-empty string.');
    return null;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(targetDimKey)) {
    errors.push(`via[].dimension "${targetDimKey}" must match ^[a-zA-Z0-9_]+$`);
  }
  if (!fkNameSet.has(fkName)) {
    errors.push(`Foreign key not found in foreignKeys[].name: ${fkName}`);
    return null;
  }
  const targetDatasource = _resolveTargetDatasourceFromFk(source, fkName);
  if (!targetDatasource) {
    warnings.push(`Foreign key "${fkName}" has no targetDatasource; remote validation skipped for this hop.`);
    return null;
  }
  return { targetDatasource, targetDimKey };
}

function _resolveTargetDatasourceFromFk(source, fkName) {
  const fkRow = _findForeignKeyRow(source, fkName);
  const targetDatasource = typeof fkRow?.targetDatasource === 'string' ? fkRow.targetDatasource.trim() : '';
  return targetDatasource || '';
}

function _validateTargetDimensionIfAvailable({ targets, targetDatasource, targetDimKey, errors }) {
  const targetCfg = targets[targetDatasource];
  if (!targetCfg) return;
  const dims = targetCfg?.dimensions;
  const okDims = dims && typeof dims === 'object' && !Array.isArray(dims);
  if (!okDims || !(targetDimKey in dims)) {
    errors.push(`Target dimension not found: ${targetDatasource}.dimensions.${targetDimKey}`);
  }
}

module.exports = {
  validateDimensionSemantics
};

