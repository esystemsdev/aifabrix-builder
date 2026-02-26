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

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const yaml = require('js-yaml');
const { detectAppType } = require('../utils/paths');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');
const logger = require('../utils/logger');
const generator = require('../generator');

/**
 * Discovers system and datasource files in app directory
 * @param {string} appPath - Application directory path
 * @returns {{ systemFiles: string[], datasourceFiles: string[] }}
 */
function discoverIntegrationFiles(appPath) {
  if (!fs.existsSync(appPath)) {
    return { systemFiles: [], datasourceFiles: [] };
  }
  const entries = fs.readdirSync(appPath);
  const systemFiles = [];
  const datasourceFiles = [];
  for (const name of entries) {
    if (!/^[a-z0-9_-]+\.(yaml|yml|json)$/i.test(name)) continue;
    if (/-system\.(yaml|yml|json)$/i.test(name)) {
      systemFiles.push(name);
    } else if (/-datasource-.+\.(yaml|yml|json)$/i.test(name)) {
      datasourceFiles.push(name);
    }
  }
  systemFiles.sort();
  datasourceFiles.sort();
  return { systemFiles, datasourceFiles };
}

/**
 * Extracts roles and permissions from system object for rbac.yaml
 * @param {Object} system - Parsed system config
 * @returns {Object|null} RBAC object or null
 */
function extractRbacFromSystem(system) {
  if (!system || typeof system !== 'object') return null;
  const hasRoles = system.roles && Array.isArray(system.roles) && system.roles.length > 0;
  const hasPermissions = system.permissions && Array.isArray(system.permissions) && system.permissions.length > 0;
  if (!hasRoles && !hasPermissions) return null;
  const rbac = {};
  if (hasRoles) rbac.roles = system.roles;
  if (hasPermissions) rbac.permissions = system.permissions;
  return rbac;
}

/**
 * Loads first system file and returns parsed object with key
 * @param {string} appPath - Application path
 * @param {string} systemFileName - System file name
 * @returns {Object} Parsed system config
 */
function loadFirstSystemFile(appPath, systemFileName) {
  const systemPath = path.join(appPath, systemFileName);
  if (!fs.existsSync(systemPath)) {
    throw new Error(`System file not found: ${systemPath}`);
  }
  return loadConfigFile(systemPath);
}

function resolveSystemContext(appPath, systemFiles) {
  const systemFilePath = path.join(appPath, systemFiles[0]);
  const systemParsed = loadFirstSystemFile(appPath, systemFiles[0]);
  const systemKey = systemParsed.key ||
    path.basename(systemFiles[0], path.extname(systemFiles[0])).replace(/-system$/, '');
  return { systemFilePath, systemParsed, systemKey };
}

function ensureExternalIntegrationBlock(variables, systemFiles, datasourceFiles, changes) {
  const extInt = variables.externalIntegration;
  let updated = false;
  if (!extInt) {
    variables.externalIntegration = {
      schemaBasePath: './',
      systems: systemFiles,
      dataSources: datasourceFiles,
      autopublish: true,
      version: '1.0.0'
    };
    changes.push('Created externalIntegration block from discovered files');
    updated = true;
  } else {
    const prevSystems = extInt.systems || [];
    const prevDataSources = extInt.dataSources || [];
    if (JSON.stringify(prevSystems) !== JSON.stringify(systemFiles)) {
      changes.push(`systems: [${prevSystems.join(', ')}] → [${systemFiles.join(', ')}]`);
      extInt.systems = systemFiles;
      updated = true;
    }
    if (JSON.stringify(prevDataSources) !== JSON.stringify(datasourceFiles)) {
      changes.push(`dataSources: [${prevDataSources.join(', ')}] → [${datasourceFiles.join(', ')}]`);
      extInt.dataSources = datasourceFiles;
      updated = true;
    }
  }
  return updated;
}

function alignAppKeyWithSystem(variables, systemKey, systemParsed, changes) {
  const appKey = variables.app?.key;
  if (!appKey || appKey === systemKey) return false;
  if (!variables.app) variables.app = {};
  variables.app.key = systemKey;
  changes.push(`app.key: ${appKey} → ${systemKey}`);
  return true;
}

/**
 * Aligns datasource systemKey values to match the system key.
 * Updates each datasource file whose systemKey differs from the system key.
 *
 * @param {string} appPath - Application directory path
 * @param {string[]} datasourceFiles - Datasource file names
 * @param {string} systemKey - Expected system key
 * @param {boolean} dryRun - If true, report changes but do not write
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any file was updated (or would be in dry-run)
 */
function alignDatasourceSystemKeys(appPath, datasourceFiles, systemKey, dryRun, changes) {
  if (!datasourceFiles || datasourceFiles.length === 0) return false;
  let updated = false;
  for (const datasourceFile of datasourceFiles) {
    const datasourcePath = path.join(appPath, datasourceFile);
    if (!fs.existsSync(datasourcePath)) continue;
    const parsed = loadConfigFile(datasourcePath);
    const old = parsed.systemKey;
    if (old !== systemKey) {
      parsed.systemKey = systemKey;
      if (!dryRun) {
        writeConfigFile(datasourcePath, parsed);
      }
      changes.push(`${datasourceFile}: systemKey ${old} → ${systemKey}`);
      updated = true;
    }
  }
  return updated;
}

function createRbacFromSystemIfNeeded(appPath, systemFilePath, systemParsed, dryRun, changes) {
  const rbacPath = path.join(appPath, 'rbac.yaml');
  const rbacYmlPath = path.join(appPath, 'rbac.yml');
  if (fs.existsSync(rbacPath) || fs.existsSync(rbacYmlPath)) return false;
  const rbacFromSystem = extractRbacFromSystem(systemParsed);
  if (!rbacFromSystem) return false;
  if (!dryRun) {
    const rbacYaml = yaml.dump(rbacFromSystem, { indent: 2, lineWidth: -1 });
    fs.writeFileSync(rbacPath, rbacYaml, { mode: 0o644, encoding: 'utf8' });
    delete systemParsed.roles;
    delete systemParsed.permissions;
    writeConfigFile(systemFilePath, systemParsed);
  }
  changes.push('Created rbac.yaml from system roles/permissions');
  changes.push('Removed roles/permissions from system file (now in rbac.yaml)');
  return true;
}

async function regenerateManifest(appName, appPath, changes) {
  try {
    const deployPath = await generator.generateDeployJson(appName, { appPath });
    changes.push(`Regenerated ${path.basename(deployPath)}`);
    return true;
  } catch (err) {
    logger.log(chalk.yellow(`⚠ Manifest regeneration skipped: ${err.message}`));
    return false;
  }
}

function persistChangesAndRegenerate(configPath, variables, appName, appPath, changes) {
  writeConfigFile(configPath, variables);
  logger.log(chalk.green(`✓ Updated ${path.basename(configPath)}`));
  changes.forEach(c => logger.log(chalk.gray(`  ${c}`)));
  return regenerateManifest(appName, appPath, changes);
}

/**
 * Repairs external integration config: syncs files, aligns keys, creates rbac, regenerates manifest
 * @async
 * @param {string} appName - Application/integration name
 * @param {Object} [options] - Options
 * @param {boolean} [options.dryRun] - If true, only report changes; do not write
 * @returns {Promise<{ updated: boolean, changes: string[], systemFiles: string[], datasourceFiles: string[], appKeyFixed?: boolean, datasourceKeysFixed?: boolean, rbacFileCreated?: boolean, manifestRegenerated?: boolean }>}
 */
async function repairExternalIntegration(appName, options = {}) {
  if (!appName || typeof appName !== 'string') throw new Error('App name is required');
  const { dryRun = false } = options;
  const { appPath, isExternal } = await detectAppType(appName);
  if (!isExternal) throw new Error(`App '${appName}' is not an external integration`);
  const configPath = resolveApplicationConfigPath(appPath);
  if (!fs.existsSync(configPath)) throw new Error(`Application config not found: ${configPath}`);

  const variables = loadConfigFile(configPath);
  const { systemFiles, datasourceFiles } = discoverIntegrationFiles(appPath);
  if (systemFiles.length === 0) {
    throw new Error(`No system file found in ${appPath}. Expected *-system.yaml or *-system.json`);
  }

  const changes = [];
  let updated = ensureExternalIntegrationBlock(variables, systemFiles, datasourceFiles, changes);
  const { systemFilePath, systemParsed, systemKey } = resolveSystemContext(appPath, systemFiles);
  const appKeyFixed = alignAppKeyWithSystem(variables, systemKey, systemParsed, changes);
  const datasourceKeysFixed = alignDatasourceSystemKeys(appPath, datasourceFiles, systemKey, dryRun, changes);
  const rbacFileCreated = createRbacFromSystemIfNeeded(appPath, systemFilePath, systemParsed, dryRun, changes);
  updated = updated || appKeyFixed || datasourceKeysFixed || rbacFileCreated;

  const manifestRegenerated = (updated && !dryRun)
    ? await persistChangesAndRegenerate(configPath, variables, appName, appPath, changes)
    : false;

  return {
    updated,
    changes,
    systemFiles,
    datasourceFiles,
    appKeyFixed,
    datasourceKeysFixed,
    rbacFileCreated,
    manifestRegenerated
  };
}

module.exports = {
  repairExternalIntegration,
  discoverIntegrationFiles
};
