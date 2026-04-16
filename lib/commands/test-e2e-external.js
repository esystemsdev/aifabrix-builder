/**
 * Run E2E tests for all datasources of an external system.
 *
 * @fileoverview test-e2e <external system> – run E2E for every datasource
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';
const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getIntegrationPath } = require('../utils/paths');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile } = require('../utils/config-format');
const { discoverIntegrationFiles, buildEffectiveDatasourceFiles } = require('./repair-internal');
const { runDatasourceTestE2E } = require('../datasource/test-e2e');

/**
 * Derives datasource key from filename when file has no key (same logic as repair).
 * @param {string} fileName - Datasource file name
 * @param {string} systemKey - System key
 * @returns {string}
 */
function deriveDatasourceKeyFromFileName(fileName, systemKey) {
  const base = path.basename(fileName, path.extname(fileName));
  if (/^datasource-/.test(base)) {
    const suffix = base.slice('datasource-'.length);
    return systemKey && typeof systemKey === 'string' ? `${systemKey}-${suffix}` : base;
  }
  return base.replace(/-datasource-/, '-');
}

/* eslint-disable max-statements -- Key resolution from system or files */
/**
 * Resolves the list of datasource keys for an external system (from system file or discovered files).
 * @param {string} appPath - Integration app path
 * @param {string} configPath - Application config path
 * @param {Object} variables - Loaded application variables (externalIntegration.dataSources = filenames)
 * @param {string} systemKey - System key from system file
 * @param {Object} systemParsed - Parsed system config (may have dataSources array of keys)
 * @param {string[]} datasourceFiles - Discovered datasource filenames
 * @returns {string[]} Sorted list of datasource keys
 */
function getDatasourceKeys(appPath, configPath, variables, systemKey, systemParsed, datasourceFiles) {
  const fromSystem = Array.isArray(systemParsed.dataSources) && systemParsed.dataSources.length > 0
    ? systemParsed.dataSources
    : null;
  const keys = [];
  const seen = new Set();
  if (fromSystem) {
    fromSystem.forEach(k => {
      if (k && typeof k === 'string' && !seen.has(k)) {
        keys.push(k.trim());
        seen.add(k.trim());
      }
    });
    keys.sort();
    return keys;
  }
  for (const fileName of datasourceFiles) {
    const filePath = path.join(appPath, fileName);
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = loadConfigFile(filePath);
      const key = parsed && typeof parsed.key === 'string' && parsed.key.trim()
        ? parsed.key.trim()
        : deriveDatasourceKeyFromFileName(fileName, systemKey);
      if (key && !seen.has(key)) {
        keys.push(key);
        seen.add(key);
      }
    } catch {
      const key = deriveDatasourceKeyFromFileName(fileName, systemKey);
      if (key && !seen.has(key)) {
        keys.push(key);
        seen.add(key);
      }
    }
  }
  keys.sort();
  return keys;
}

/**
 * Full upload to dataplane when --sync (same path as `aifabrix upload <systemKey>`).
 * @param {string} systemKey
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function syncLocalIfRequested(systemKey, options) {
  if (options.sync !== true) return;
  logger.log(chalk.cyan('Syncing local config to dataplane…'));
  const { uploadExternalSystem } = require('./upload');
  await uploadExternalSystem(systemKey, {
    verbose: !!options.verbose,
    minimal: true
  });
  logger.log(formatSuccessLine('Sync complete'));
}

/* eslint-disable max-lines-per-function, max-statements -- Load context, then loop over keys */
/**
 * Runs E2E for all datasources of an external system. Uses each datasource's payloadTemplate (no extra params required).
 *
 * @async
 * @param {string} externalSystem - System key (e.g. hubspot-demo)
 * @param {Object} options - Options passed to each runDatasourceTestE2E
 * @param {string} [options.env] - Environment (dev, tst, pro)
 * @param {boolean} [options.debug] - Include debug, write log
 * @param {boolean} [options.verbose] - Verbose output
 * @param {boolean} [options.async] - If false, sync mode (default true)
 * @param {boolean} [options.sync] - When true, run full upload (`uploadExternalSystem`) before per-datasource E2E
 * @returns {Promise<{ success: boolean, results: Array<{ key: string, success: boolean, error?: string }> }>}
 */
async function runTestE2EForExternalSystem(externalSystem, options = {}) {
  if (!externalSystem || typeof externalSystem !== 'string') {
    throw new Error('External system name is required');
  }
  const appPath = getIntegrationPath(externalSystem);
  if (!fs.existsSync(appPath)) {
    throw new Error(`Integration path not found: ${appPath}`);
  }
  const configPath = resolveApplicationConfigPath(appPath);
  let variables = {};
  if (fs.existsSync(configPath)) {
    variables = loadConfigFile(configPath);
  }
  const { systemFiles, datasourceFiles: discovered } = discoverIntegrationFiles(appPath);
  if (systemFiles.length === 0) {
    throw new Error(`No system file found in ${appPath}. Expected *-system.yaml or *-system.json`);
  }
  const datasourceFiles = buildEffectiveDatasourceFiles(
    appPath,
    discovered,
    variables.externalIntegration?.dataSources
  );
  const systemPath = path.join(appPath, systemFiles[0]);
  const systemParsed = loadConfigFile(systemPath);
  const systemKey = systemParsed.key ||
    path.basename(systemFiles[0], path.extname(systemFiles[0])).replace(/-system$/, '');

  const keys = getDatasourceKeys(
    appPath,
    configPath,
    variables,
    systemKey,
    systemParsed,
    datasourceFiles
  );
  if (keys.length === 0) {
    logger.log(chalk.yellow(`No datasources found for ${externalSystem}. Add datasource files and run aifabrix repair.`));
    return { success: true, results: [] };
  }

  await syncLocalIfRequested(systemKey, options);

  const results = [];
  const opts = {
    app: externalSystem,
    environment: options.env,
    debug: options.debug,
    verbose: options.verbose,
    async: options.async !== false
  };
  for (const key of keys) {
    try {
      const data = await runDatasourceTestE2E(key, opts);
      const steps = data.steps || data.completedActions || [];
      const failed = data.success === false || steps.some(s => s.success === false || s.error);
      results.push({
        key,
        success: !failed,
        error: failed ? (data.error || 'E2E step failed') : undefined,
        datasourceTestRun: data.datasourceTestRun
      });
    } catch (err) {
      results.push({ key, success: false, error: err.message });
    }
  }
  const success = results.every(r => r.success);
  return { success, results };
}

module.exports = {
  runTestE2EForExternalSystem,
  getDatasourceKeys
};
