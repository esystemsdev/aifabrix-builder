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
 * @property {boolean} [isRequired]
 * @property {Array<{ value: string, displayName?: string, description?: string }>} [values]
 */

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
  return parsed;
}

module.exports = {
  readDimensionCreateFile
};

