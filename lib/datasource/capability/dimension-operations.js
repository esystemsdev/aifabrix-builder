/**
 * Metadata-only dimension binding updates for datasource JSON.
 *
 * Writes root `dimensions.<dimensionKey>` binding (local or fk) with JSON Patch operations.
 *
 * @fileoverview capability dimension — dimensions{} binding upsert
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { jsonPointerPath } = require('./json-pointer');

/**
 * @param {unknown} o
 * @returns {any}
 */
function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

function _asObject(x) {
  return x && typeof x === 'object' && !Array.isArray(x) ? x : null;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeDimensionKey(raw) {
  const s = String(raw || '').trim();
  if (!s) {
    throw new Error('--dimension <key> is required');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(s)) {
    throw new Error(`--dimension "${s}" must match ^[a-zA-Z0-9_]+$`);
  }
  return s;
}

/**
 * @param {string} raw
 * @returns {'local'|'fk'}
 */
function normalizeDimensionType(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) {
    throw new Error('--type <local|fk> is required');
  }
  if (s !== 'local' && s !== 'fk') {
    throw new Error('--type must be "local" or "fk"');
  }
  return s;
}

/**
 * @param {any} doc
 * @param {string} dimKey
 * @param {boolean} overwrite
 * @returns {boolean} replaced
 */
function assertOverwriteAllowed(doc, dimKey, overwrite) {
  const dims = doc?.dimensions;
  const exists = Boolean(dims && typeof dims === 'object' && !Array.isArray(dims) && dims[dimKey] !== undefined);
  if (exists && !overwrite) {
    throw new Error(`dimensions.${dimKey} already exists; pass --overwrite to replace`);
  }
  return exists;
}

/**
 * @param {object} opts
 * @returns {object} dimensionBinding
 */
function buildDimensionBinding(opts) {
  const type = normalizeDimensionType(opts.type);

  if (type === 'local') {
    const field = String(opts.field || '').trim();
    if (!field) {
      throw new Error('--field <normalizedAttr> is required for --type local');
    }
    return { type: 'local', field };
  }

  const via = Array.isArray(opts.via) ? opts.via : [];
  if (via.length === 0) {
    throw new Error('Provide at least one --via <fkName>:<dimensionKey> for --type fk');
  }

  /** @type {any} */
  const binding = { type: 'fk', via };
  if (opts.actor !== undefined && opts.actor !== null && String(opts.actor).trim()) {
    binding.actor = String(opts.actor).trim();
  }
  if (opts.operator !== undefined && opts.operator !== null && String(opts.operator).trim()) {
    binding.operator = String(opts.operator).trim();
  }
  if (opts.required !== undefined && opts.required !== null) {
    binding.required = Boolean(opts.required);
  }
  return binding;
}

/**
 * @param {any} doc
 * @param {object} opts
 * @returns {{
 *   doc: any,
 *   patchOperations: object[],
 *   updatedSections: string[],
 *   replaced: boolean
 * }}
 */
function applyCapabilityDimension(doc, opts) {
  const dimKey = normalizeDimensionKey(opts.dimension);
  const d = deepClone(doc);

  if (!_asObject(d.dimensions)) {
    d.dimensions = {};
  }

  const replaced = assertOverwriteAllowed(d, dimKey, Boolean(opts.overwrite));
  const binding = buildDimensionBinding(opts);

  /** @type {object[]} */
  const patchOperations = [];
  /** @type {string[]} */
  const updatedSections = [];

  const path = jsonPointerPath('dimensions', dimKey);
  if (replaced) {
    d.dimensions[dimKey] = binding;
    patchOperations.push({ op: 'replace', path, value: binding });
  } else {
    d.dimensions[dimKey] = binding;
    patchOperations.push({ op: 'add', path, value: binding });
  }
  updatedSections.push(`dimensions.${dimKey}`);

  return { doc: d, patchOperations, updatedSections, replaced };
}

module.exports = {
  applyCapabilityDimension,
  normalizeDimensionKey,
  normalizeDimensionType,
  buildDimensionBinding
};

