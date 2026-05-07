/**
 * Shared datasource resolver utilities.
 *
 * Intentionally CLI-agnostic (no commander/options), so it can be reused by commands and tests.
 *
 * @fileoverview Datasource path + JSON loading helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const { resolveValidateInputPath, resolvePathFromIntegrationDatasourceKey } = require('../datasource/validate');

/**
 * @param {string} fileOrKey
 * @returns {string} Absolute path to datasource JSON file
 */
function resolveDatasourceJsonPath(fileOrKey) {
  return resolveValidateInputPath(String(fileOrKey || '').trim());
}

/**
 * Attempt to resolve a datasource key under integration/<app>/ without throwing.
 *
 * @param {string} datasourceKey
 * @returns {{ ok: true, path: string } | { ok: false, error: string }}
 */
function tryResolveDatasourceKeyToLocalPath(datasourceKey) {
  try {
    const p = resolvePathFromIntegrationDatasourceKey(String(datasourceKey || '').trim());
    return { ok: true, path: p };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * @param {string} jsonPath
 * @returns {any}
 */
function readJsonFile(jsonPath) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  return JSON.parse(raw);
}

module.exports = {
  resolveDatasourceJsonPath,
  tryResolveDatasourceKeyToLocalPath,
  readJsonFile
};

