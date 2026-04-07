/**
 * Resolves the directory that contains `config.yaml` for CLI runtime.
 * Shared by `paths.getConfigDirForPaths` and `config.getConfigDir` (no circular imports).
 *
 * When `AIFABRIX_HOME` is set to the POSIX home (builder-server pattern) but the real
 * config file is under `~/.aifabrix/config.yaml`, use that nested directory so
 * `secrets.local.yaml` and auth config stay beside `config.yaml`.
 *
 * @fileoverview AIFABRIX_CONFIG / AIFABRIX_HOME → config directory
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const nodeFsLib = require('../internal/node-fs');
const path = require('path');
const os = require('os');

/**
 * @returns {string} Absolute directory containing `config.yaml`
 */
function getAifabrixRuntimeConfigDir() {
  const configFile = process.env.AIFABRIX_CONFIG && typeof process.env.AIFABRIX_CONFIG === 'string';
  if (configFile) {
    return path.dirname(path.resolve(process.env.AIFABRIX_CONFIG.trim()));
  }
  if (process.env.AIFABRIX_HOME && typeof process.env.AIFABRIX_HOME === 'string') {
    const homeDir = path.resolve(process.env.AIFABRIX_HOME.trim());
    const directConfig = path.join(homeDir, 'config.yaml');
    if (nodeFsLib.nodeFs().existsSync(directConfig)) {
      return homeDir;
    }
    const nestedConfig = path.join(homeDir, '.aifabrix', 'config.yaml');
    if (nodeFsLib.nodeFs().existsSync(nestedConfig)) {
      return path.join(homeDir, '.aifabrix');
    }
    return homeDir;
  }
  return path.join(os.homedir(), '.aifabrix');
}

module.exports = { getAifabrixRuntimeConfigDir };
