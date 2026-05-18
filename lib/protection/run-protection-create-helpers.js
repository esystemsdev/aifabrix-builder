/**
 * @fileoverview Helpers for `runProtectionCreate` (auth, path checks, YAML).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { resolveControllerUrl } = require('../utils/controller-url');
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
  return `${yaml.dump(manifest, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false }).trim()}\n`;
}

/**
 * @param {string} dsKey
 * @param {boolean} force
 * @returns {string}
 */
function resolveOutputPathOrThrow(dsKey, force) {
  const root = getProtectionRoot();
  assertNoDuplicateDatasourceKeys(root);
  const outputPath = path.join(root, `${dsKey}.yaml`);
  assertNoOtherFileClaimsDatasource(root, dsKey, outputPath);
  if (fs.existsSync(outputPath) && !force) {
    throw new Error(
      `File already exists: ${outputPath}. Use --force to overwrite, or remove the file.`
    );
  }
  return outputPath;
}

/**
 * @param {string} outputPath
 * @param {string} yamlBody
 */
function writeProtectionYaml(outputPath, yamlBody) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, yamlBody, 'utf8');
}

module.exports = {
  resolveControllerAuthForDimensions,
  assertNoOtherFileClaimsDatasource,
  protectionManifestToYaml,
  resolveOutputPathOrThrow,
  writeProtectionYaml
};
