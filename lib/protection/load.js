/**
 * @fileoverview Load protection manifest YAML files (v1).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadConfigFile } = require('../utils/config-format');

/**
 * @param {string} manifestPath - Absolute path to `.yaml` manifest
 * @returns {Object} Parsed manifest object
 */
function loadProtectionManifest(manifestPath) {
  const p = path.resolve(String(manifestPath || '').trim());
  if (!p) {
    throw new Error('Protection manifest path is required');
  }
  if (!fs.existsSync(p)) {
    throw new Error(`Protection manifest not found: ${p}`);
  }
  const ext = path.extname(p).toLowerCase();
  if (ext !== '.yaml' && ext !== '.yml') {
    throw new Error(
      `Protection commands support .yaml only (got ${ext}). Run: aifabrix convert .protection --format yaml`
    );
  }
  return loadConfigFile(p);
}

module.exports = {
  loadProtectionManifest
};
