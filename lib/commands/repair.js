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
const { systemKeyToKvPrefix, securityKeyToVar } = require('../utils/credential-secrets-env');
const logger = require('../utils/logger');
const generator = require('../generator');
const { repairEnvTemplate } = require('./repair-env-template');
const { normalizeSystemFileAuthAndConfig } = require('./repair-auth-config');

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

/**
 * Derives a datasource key from filename when the file has no key (e.g. hubspot-datasource-company.json → hubspot-company).
 * @param {string} fileName - Datasource file name
 * @param {string} _systemKey - System key (unused; for API consistency)
 * @returns {string}
 */
function deriveDatasourceKeyFromFileName(fileName, _systemKey) {
  const base = path.basename(fileName, path.extname(fileName));
  return base.replace(/-datasource-/, '-');
}

/**
 * Aligns system file dataSources array to match datasource keys from discovered files.
 * Loads each datasource file to read key (or derives from filename). Updates systemParsed.dataSources; caller writes system file once if needed.
 *
 * @param {string} appPath - Application directory path
 * @param {Object} systemParsed - Parsed system config (mutated)
 * @param {string[]} datasourceFiles - Datasource file names
 * @param {string} systemKey - System key for deriving key when missing
 * @param {boolean} dryRun - If true, report changes but do not write
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if dataSources was updated (or would be in dry-run)
 */
function alignSystemFileDataSources(appPath, systemParsed, datasourceFiles, systemKey, dryRun, changes) {
  const keys = [];
  for (const fileName of datasourceFiles) {
    const filePath = path.join(appPath, fileName);
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = loadConfigFile(filePath);
      const key = parsed && typeof parsed.key === 'string' && parsed.key.trim()
        ? parsed.key.trim()
        : deriveDatasourceKeyFromFileName(fileName, systemKey);
      keys.push(key);
    } catch (err) {
      logger.log(chalk.yellow(`⚠ Could not load datasource file ${fileName}: ${err.message}; using derived key`));
      keys.push(deriveDatasourceKeyFromFileName(fileName, systemKey));
    }
  }
  keys.sort();
  const prev = Array.isArray(systemParsed.dataSources) ? [...systemParsed.dataSources].sort() : [];
  if (JSON.stringify(prev) === JSON.stringify(keys)) return false;
  systemParsed.dataSources = keys;
  changes.push(`dataSources: [${prev.join(', ') || '(none)'}] → [${keys.join(', ')}]`);
  return true;
}

/**
 * Builds the set of auth variable names (UPPERCASE, no underscores) from authentication.variables and authentication.security.
 * Used to detect configuration entries that belong only in the authentication section.
 * Canonical keys per method are in lib/schema/external-system.schema.json $defs.authenticationVariablesByMethod
 * (e.g. oauth2: variables baseUrl, tokenUrl, scope; security clientId, clientSecret).
 *
 * @param {Object} systemParsed - Parsed system config
 * @param {string} _systemKey - System key (unused; for API consistency)
 * @returns {Set<string>}
 */
function buildAuthVarNames(systemParsed, _systemKey) {
  const names = new Set();
  const auth = systemParsed.authentication;
  if (auth && typeof auth.variables === 'object') {
    for (const k of Object.keys(auth.variables)) {
      names.add(String(k).toUpperCase().replace(/_/g, ''));
    }
  }
  if (auth && typeof auth.security === 'object') {
    for (const k of Object.keys(auth.security)) {
      names.add(securityKeyToVar(k));
    }
  }
  return names;
}

/**
 * Removes from system configuration any entry that represents standard auth variables
 * (BASEURL, CLIENTID, CLIENTSECRET, TOKENURL, APIKEY, USERNAME, PASSWORD, etc.).
 * These are supplied from the selected credential at runtime; the configuration array
 * should contain only custom variables. Removes both plain and keyvault auth entries.
 *
 * @param {Object} systemParsed - Parsed system config (mutated)
 * @param {string} systemKey - System key for naming consistency
 * @param {boolean} dryRun - If true, report changes but do not write
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any entry was removed
 */
/**
 * Derives the normalized auth variable part from a config entry name (for matching against authNames).
 * E.g. KV_HUBSPOT_CLIENTID → CLIENTID, BASEURL → BASEURL.
 * @param {string} name - Entry name
 * @param {string} systemKey - System key for KV_ prefix
 * @returns {string}
 */
function normalizedAuthPartFromConfigName(name, systemKey) {
  const n = String(name).trim();
  if (!n) return '';
  const prefix = systemKeyToKvPrefix(systemKey);
  const kvPrefix = `KV_${prefix}_`;
  if (n.toUpperCase().startsWith(kvPrefix)) {
    const rest = n.slice(kvPrefix.length);
    return rest.toUpperCase().replace(/_/g, '');
  }
  return n.toUpperCase().replace(/_/g, '');
}

function removeAuthVarsFromConfiguration(systemParsed, systemKey, dryRun, changes) {
  const config = systemParsed.configuration;
  if (!Array.isArray(config)) return false;
  const authNames = buildAuthVarNames(systemParsed, systemKey);
  if (authNames.size === 0) return false;
  const removed = [];
  const filtered = config.filter((entry) => {
    if (!entry || !entry.name) return true;
    const authPart = normalizedAuthPartFromConfigName(entry.name, systemKey);
    if (authNames.has(authPart)) {
      removed.push(entry.name);
      return false;
    }
    return true;
  });
  if (removed.length === 0) return false;
  systemParsed.configuration = filtered;
  changes.push(`Removed authentication variable(s) from configuration: ${removed.join(', ')}`);
  return true;
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
 * Runs all repair steps (integration block, system dataSources, auth/config, app key, datasource keys, rbac, env.template).
 * @param {Object} ctx - Context with appPath, configPath, variables, systemFilePath, systemParsed, systemKey, systemFiles, datasourceFiles, dryRun, changes
 * @returns {{ updated: boolean, appKeyFixed: boolean, datasourceKeysFixed: boolean, rbacFileCreated: boolean, envTemplateRepaired: boolean }}
 */
function runRepairSteps(ctx) {
  let updated = ensureExternalIntegrationBlock(
    ctx.variables, ctx.systemFiles, ctx.datasourceFiles, ctx.changes
  );
  const systemAuthConfigNormalized = normalizeSystemFileAuthAndConfig(
    ctx.systemParsed, ctx.systemKey, ctx.changes
  );
  const systemDataSourcesAligned = alignSystemFileDataSources(
    ctx.appPath, ctx.systemParsed, ctx.datasourceFiles, ctx.systemKey, ctx.dryRun, ctx.changes
  );
  const authVarsRemoved = removeAuthVarsFromConfiguration(
    ctx.systemParsed, ctx.systemKey, ctx.dryRun, ctx.changes
  );
  if ((systemAuthConfigNormalized || systemDataSourcesAligned || authVarsRemoved) && !ctx.dryRun) {
    writeConfigFile(ctx.systemFilePath, ctx.systemParsed);
  }
  updated = updated || systemAuthConfigNormalized || systemDataSourcesAligned || authVarsRemoved;
  const appKeyFixed = alignAppKeyWithSystem(
    ctx.variables, ctx.systemKey, ctx.systemParsed, ctx.changes
  );
  const datasourceKeysFixed = alignDatasourceSystemKeys(
    ctx.appPath, ctx.datasourceFiles, ctx.systemKey, ctx.dryRun, ctx.changes
  );
  const rbacFileCreated = createRbacFromSystemIfNeeded(
    ctx.appPath, ctx.systemFilePath, ctx.systemParsed, ctx.dryRun, ctx.changes
  );
  const envTemplateRepaired = repairEnvTemplate(
    ctx.appPath, ctx.systemParsed, ctx.systemKey, ctx.dryRun, ctx.changes
  );
  updated = updated || appKeyFixed || datasourceKeysFixed || rbacFileCreated || envTemplateRepaired;
  return {
    updated,
    appKeyFixed,
    datasourceKeysFixed,
    rbacFileCreated,
    envTemplateRepaired
  };
}

/**
 * Repairs external integration config: syncs files, aligns keys, creates rbac, regenerates manifest
 * @async
 * @param {string} appName - Application/integration name
 * @param {Object} [options] - Options
 * @param {boolean} [options.dryRun] - If true, only report changes; do not write
 * @returns {Promise<{ updated: boolean, changes: string[], systemFiles: string[], datasourceFiles: string[], appKeyFixed?: boolean, datasourceKeysFixed?: boolean, rbacFileCreated?: boolean, envTemplateRepaired?: boolean, manifestRegenerated?: boolean }>}
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
  const { systemFilePath, systemParsed, systemKey } = resolveSystemContext(appPath, systemFiles);
  const steps = runRepairSteps({
    appPath,
    configPath,
    variables,
    systemFilePath,
    systemParsed,
    systemKey,
    systemFiles,
    datasourceFiles,
    dryRun,
    changes
  });

  const manifestRegenerated = (steps.updated && !dryRun)
    ? await persistChangesAndRegenerate(configPath, variables, appName, appPath, changes)
    : false;

  return {
    updated: steps.updated,
    changes,
    systemFiles,
    datasourceFiles,
    appKeyFixed: steps.appKeyFixed,
    datasourceKeysFixed: steps.datasourceKeysFixed,
    rbacFileCreated: steps.rbacFileCreated,
    envTemplateRepaired: steps.envTemplateRepaired,
    manifestRegenerated
  };
}

module.exports = {
  repairExternalIntegration,
  discoverIntegrationFiles
};
