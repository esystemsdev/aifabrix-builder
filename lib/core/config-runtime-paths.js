/**
 * Resolves config.yaml directory/file on each access (aligned with paths.getConfigDirForPaths).
 * Split from config.js for max-lines compliance.
 *
 * @fileoverview Dynamic CONFIG_DIR / CONFIG_FILE for lib/core/config.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const { getAifabrixRuntimeConfigDir } = require('../utils/aifabrix-runtime-config-dir');

/**
 * @returns {string}
 */
function getRuntimeConfigDir() {
  return getAifabrixRuntimeConfigDir();
}

/**
 * @returns {string}
 */
function getRuntimeConfigFile() {
  return path.join(getRuntimeConfigDir(), 'config.yaml');
}

module.exports = { getRuntimeConfigDir, getRuntimeConfigFile };
