/**
 * Repair external integration config: fix drift between config and files on disk.
 *
 * Aligns application.yaml with actual system/datasource files, fixes system key mismatch,
 * creates missing externalIntegration block, extracts rbac.yaml from system when needed,
 * and regenerates the deployment manifest.
 *
 * @fileoverview Repair external integration drift
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const { detectAppType } = require('../utils/paths');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile, isYamlPath } = require('../utils/config-format');
const { discoverIntegrationFiles, buildEffectiveDatasourceFiles } = require('./repair-internal');
const { runRepairExternalIntegration } = require('./repair-external-run');

/**
 * Loads application config and discovers integration files; validates at least one system file exists.
 * @param {string} appPath - Application path
 * @param {string} configPath - Path to application config
 * @returns {{ variables: Object, originalYamlContent: string|null, systemFiles: string[], datasourceFiles: string[] }}
 */
function loadConfigAndDiscover(appPath, configPath) {
  const variables = loadConfigFile(configPath);
  let originalYamlContent = null;
  if (isYamlPath(configPath)) {
    originalYamlContent = fs.readFileSync(configPath, 'utf8');
  }
  const { systemFiles, datasourceFiles: discoveredDatasourceFiles } = discoverIntegrationFiles(appPath);
  if (!systemFiles || systemFiles.length === 0) {
    throw new Error(`No system file found in ${appPath}. Expected *-system.yaml or *-system.json`);
  }
  const datasourceFiles = buildEffectiveDatasourceFiles(appPath, discoveredDatasourceFiles, variables.externalIntegration?.dataSources);
  return { variables, originalYamlContent, systemFiles, datasourceFiles };
}

/**
 * Validates repair inputs and resolves app path and config path.
 * @param {string} appName - Application name
 * @param {Object} options - Command options (auth)
 * @returns {Promise<{ appPath: string, configPath: string, dryRun: boolean, authOption: string|undefined }>}
 */
async function validateAndResolveRepairPaths(appName, options) {
  if (!appName || typeof appName !== 'string') throw new Error('App name is required');
  const { dryRun = false, auth: authOption } = options;
  if (authOption !== undefined && authOption !== null && typeof authOption !== 'string') {
    throw new Error('Option --auth must be a string');
  }
  const { appPath, isExternal } = await detectAppType(appName);
  if (!isExternal) throw new Error(`App '${appName}' is not an external integration`);
  const configPath = resolveApplicationConfigPath(appPath);
  if (!fs.existsSync(configPath)) throw new Error(`Application config not found: ${configPath}`);
  return { appPath, configPath, dryRun, authOption };
}

/**
 * @param {Object} options - CLI options (noBackup, backup)
 * @param {boolean} dryRun
 * @returns {{ backupPaths: string[], backupCtx: Object }}
 */
function createRepairBackupContext(options, dryRun) {
  const noBackup = options.noBackup === true || options.backup === false;
  const backupPaths = [];
  const backedUpFiles = new Set();
  const backupCtx = {
    dryRun,
    noBackup,
    backupPaths,
    backedUpFiles,
    changedFiles: [],
    wouldChangeFiles: []
  };
  return { backupPaths, backupCtx };
}

/**
 * Repairs external integration config: syncs files, aligns keys, creates rbac, regenerates manifest
 * @async
 * @param {string} appName - Application/integration name
 * @param {Object} [options] - Options
 * @param {boolean} [options.dryRun] - If true, only report changes; do not write
 * @param {boolean} [options.doc] - If true, regenerate README.md from deployment manifest
 * @returns {Promise<Object>}
 */
async function repairExternalIntegration(appName, options = {}) {
  const { appPath, configPath, dryRun, authOption } = await validateAndResolveRepairPaths(appName, options);
  const { backupPaths, backupCtx } = createRepairBackupContext(options, dryRun);
  const loaded = loadConfigAndDiscover(appPath, configPath);
  return runRepairExternalIntegration({
    appName,
    options,
    appPath,
    configPath,
    dryRun,
    authOption,
    backupPaths,
    backupCtx,
    ...loaded
  });
}

module.exports = {
  repairExternalIntegration,
  discoverIntegrationFiles
};
