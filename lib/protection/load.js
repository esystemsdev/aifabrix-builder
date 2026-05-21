/**
 * @fileoverview Load protection manifest YAML files (v1).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const { existsSync, readFileSync } = require('../internal/fs-real-sync');
const { yamlToJson } = require('../utils/config-format');

/**
 * @param {string} manifestPath - Absolute path to `.yaml` manifest
 * @returns {Object} Parsed manifest object
 */
function loadProtectionManifest(manifestPath) {
  const p = path.resolve(String(manifestPath || '').trim());
  if (!p) {
    throw new Error('Protection manifest path is required');
  }
  if (!existsSync(p)) {
    throw new Error(`Protection manifest not found: ${p}`);
  }
  const ext = path.extname(p).toLowerCase();
  if (ext !== '.yaml' && ext !== '.yml' && ext !== '.json') {
    throw new Error(
      `Protection manifest must be .yaml, .yml, or .json (got ${ext || '(none)'}).`
    );
  }
  const content = readFileSync(p, 'utf8');
  if (ext === '.json') {
    const parsed = JSON.parse(content);
    return parsed === undefined || parsed === null ? {} : parsed;
  }
  return yamlToJson(content);
}

module.exports = {
  loadProtectionManifest
};
