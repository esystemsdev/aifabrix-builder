/**
 * @fileoverview Helpers for `runProtectionCreate` (auth, path checks, YAML).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { resolveControllerUrl } = require('../utils/controller-url');
const { getConfig } = require('../core/config');
const { writeConfigFile, jsonToYaml } = require('../utils/config-format');
const { normalizeControllerUrl } = require('../core/config');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { getProtectionRoot } = require('./paths');
const { assertNoDuplicateDatasourceKeys, listProtectionManifestPaths } = require('./resolve');
const { loadProtectionManifest } = require('./load');

/**
 * @returns {Promise<{ controllerUrl: string, authConfig: Object }>}
 */
async function resolveControllerAuthForDimensions() {
  const controllerUrl = await resolveControllerUrl();
  if (!controllerUrl) {
    throw new Error('Controller URL is required. Run "aifabrix login" first.');
  }
  const normalized = normalizeControllerUrl(controllerUrl);
  const deviceToken = await getOrRefreshDeviceToken(normalized);
  if (!deviceToken || !deviceToken.token) {
    throw new Error(
      `Not authenticated for controller: ${controllerUrl}. Run "aifabrix login" and try again.`
    );
  }
  return {
    controllerUrl: deviceToken.controller || normalized,
    authConfig: { type: 'bearer', token: deviceToken.token }
  };
}

/**
 * @param {string} root
 * @param {string} datasourceKey
 * @param {string} outputPath
 */
function assertNoOtherFileClaimsDatasource(root, datasourceKey, outputPath) {
  const key = String(datasourceKey || '').trim();
  const out = path.resolve(outputPath);
  for (const filePath of listProtectionManifestPaths(root)) {
    if (path.resolve(filePath) === out) {
      continue;
    }
    try {
      const m = loadProtectionManifest(filePath);
      if (String(m?.spec?.datasourceKey || '').trim() === key) {
        throw new Error(
          `Another manifest already claims datasource "${key}": ${filePath}. Remove it or use a different key.`
        );
      }
    } catch (e) {
      if (e.message && e.message.includes('Another manifest')) {
        throw e;
      }
    }
  }
}

/**
 * @param {Object} manifest
 * @returns {string}
 */
function protectionManifestToYaml(manifest) {
  return protectionManifestToDisplayText(manifest, 'yaml');
}

/**
 * @returns {Promise<'yaml'|'json'>}
 */
async function resolveProtectionOutputFormat() {
  const config = await getConfig();
  const raw = config && typeof config.format === 'string' ? config.format.trim().toLowerCase() : '';
  return raw === 'json' ? 'json' : 'yaml';
}

/**
 * @param {string} dsKey
 * @param {boolean} force
 * @returns {Promise<{ outputPath: string, format: 'yaml'|'json' }>}
 */
async function resolveOutputPathOrThrow(dsKey, force) {
  const root = getProtectionRoot();
  assertNoDuplicateDatasourceKeys(root);
  const format = await resolveProtectionOutputFormat();
  const ext = format === 'json' ? '.json' : '.yaml';
  const outputPath = path.join(root, `${dsKey}${ext}`);
  assertNoOtherFileClaimsDatasource(root, dsKey, outputPath);
  if (fs.existsSync(outputPath) && !force) {
    throw new Error(
      `File already exists: ${outputPath}. Use --force to overwrite, or remove the file.`
    );
  }
  return { outputPath, format };
}

/**
 * @param {string} outputPath
 * @param {Object} manifest
 * @param {'yaml'|'json'} format
 */
function writeProtectionManifest(outputPath, manifest, format) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  writeConfigFile(outputPath, manifest, format);
}

/**
 * @param {Object} manifest
 * @returns {string}
 */
function protectionManifestToDisplayText(manifest, format = 'yaml') {
  if (format === 'json') {
    return `${JSON.stringify(manifest, null, 2)}\n`;
  }
  return `${jsonToYaml(manifest).trim()}\n`;
}

module.exports = {
  resolveControllerAuthForDimensions,
  assertNoOtherFileClaimsDatasource,
  protectionManifestToYaml,
  protectionManifestToDisplayText,
  resolveProtectionOutputFormat,
  resolveOutputPathOrThrow,
  writeProtectionManifest
};
