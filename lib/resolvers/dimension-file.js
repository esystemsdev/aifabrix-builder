/**
 * Dimension file helpers for `aifabrix dimension create --file`.
 *
 * @fileoverview Dimension file parsing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} DimensionCreateInput
 * @property {string} key
 * @property {string} displayName
 * @property {string} [description]
 * @property {'string'|'number'|'boolean'} dataType
 * @property {'static'|'dynamic'|'both'} [valueType]
 * @property {boolean} [isRequired]
 * @property {Array<{ value: string, displayName?: string, description?: string }>} [values]
 */

const VALUE_TYPES = new Set(['static', 'dynamic', 'both']);

/**
 * @param {*} raw
 * @returns {'static'|'dynamic'|'both'}
 */
function normalizeValueType(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return 'static';
  }
  const vt = String(raw).trim();
  if (!VALUE_TYPES.has(vt)) {
    throw new Error('valueType must be one of: static, dynamic, both');
  }
  return /** @type {'static'|'dynamic'|'both'} */ (vt);
}

/**
 * @param {string} filePath
 * @returns {DimensionCreateInput}
 */
function readDimensionCreateFile(filePath) {
  const p = path.resolve(String(filePath || '').trim());
  if (!p) {
    throw new Error('--file is required');
  }
  if (!fs.existsSync(p)) {
    throw new Error(`File not found: ${p}`);
  }
  const raw = fs.readFileSync(p, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${p}: ${e.message}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Dimension file must be a JSON object: ${p}`);
  }
  if (parsed.valueType !== undefined) {
    parsed.valueType = normalizeValueType(parsed.valueType);
  } else {
    parsed.valueType = 'static';
  }
  return parsed;
}

module.exports = {
  readDimensionCreateFile,
  normalizeValueType,
  VALUE_TYPES
};

