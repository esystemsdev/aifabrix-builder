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
/* eslint-disable max-lines -- Repair flow with auth, normalization, and steps */

'use strict';
const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { detectAppType, getDeployJsonPath } = require('../utils/paths');
const { resolveApplicationConfigPath, resolveRbacPath } = require('../utils/app-config-resolver');
const { loadConfigFile, writeConfigFile, writeYamlPreservingComments, isYamlPath } = require('../utils/config-format');
const { systemKeyToKvPrefix, securityKeyToVar } = require('../utils/credential-secrets-env');
const logger = require('../utils/logger');
const generator = require('../generator');
const { repairEnvTemplate, normalizeSystemFileAuthAndConfig } = require('./repair-env-template');
const { generateReadmeFromDeployJson } = require('../generator/split-readme');
const { repairDatasourceFile } = require('./repair-datasource');
const { mergeRbacFromDatasources } = require('./repair-rbac');
const { discoverIntegrationFiles, buildEffectiveDatasourceFiles } = require('./repair-internal');
const { normalizeDatasourceKeysAndFilenames } = require('./repair-datasource-keys');

/** Allowed authentication methods for repair --auth (matches external-system schema) */
const ALLOWED_AUTH = ['oauth2', 'aad', 'apikey', 'basic', 'queryParam', 'oidc', 'hmac', 'none'];

/**
 * README "Files" section should match integration config format on disk (YAML vs JSON).
 * @param {string} appPath - Integration directory
 * @returns {string} '.yaml' or '.json'
 */
function inferExternalReadmeFileExt(appPath) {
  try {
    const configPath = resolveApplicationConfigPath(appPath);
    const ext = path.extname(configPath).toLowerCase();
    if (ext === '.yaml' || ext === '.yml') return '.yaml';
  } catch {
    /* use default */
  }
  return '.json';
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
 * Derives a datasource key from filename when the file has no key.
 * - hubspot-datasource-company.json → hubspot-company
 * - datasource-companies.json → {systemKey}-companies (e.g. test-hubspot-companies)
 *
 * @param {string} fileName - Datasource file name
 * @param {string} systemKey - System key (e.g. test-hubspot), used for datasource-*.json style names
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

/**
 * Aligns system file dataSources array to match datasource keys from discovered files.
 * The system file holds logical keys (not filenames): each key comes from that datasource
 * file's "key" property, or is derived from the filename when missing (e.g. datasource-companies.json → {systemKey}-companies).
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
  const prev = Array.isArray(systemParsed.dataSources) ? [...systemParsed.dataSources] : [];
  if (JSON.stringify(prev) === JSON.stringify(keys)) return false;
  systemParsed.dataSources = keys;
  changes.push(`dataSources: [${prev.join(', ') || '(none)'}] → [${keys.join(', ')}] (keys from each datasource file's "key" or filename)`);
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
  // Old-style or other KV_* names: treat last segment as var (e.g. KV_HUBSPOT_CLIENTID → CLIENTID)
  if (n.toUpperCase().startsWith('KV_')) {
    const parts = n.split('_').filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1].toUpperCase();
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

function createRbacFromSystemIfNeeded(appPath, systemFilePath, systemParsed, dryRun, changes, format) {
  if (resolveRbacPath(appPath)) return false;
  const rbacFromSystem = extractRbacFromSystem(systemParsed);
  if (!rbacFromSystem) return false;
  if (!dryRun) {
    const rbacFormat = format === 'json' ? 'json' : 'yaml';
    const defaultRbacPath = path.join(appPath, rbacFormat === 'json' ? 'rbac.json' : 'rbac.yaml');
    writeConfigFile(defaultRbacPath, rbacFromSystem, rbacFormat);
    delete systemParsed.roles;
    delete systemParsed.permissions;
    writeConfigFile(systemFilePath, systemParsed);
  }
  changes.push('Created rbac.yaml from system roles/permissions');
  changes.push('Removed roles/permissions from system file (now in rbac file)');
  return true;
}

/**
 * Runs datasource repair for each file (v2.4 root dimensions, metadataSchema; optional expose/sync/test).
 * @param {string} appPath - Application path
 * @param {string[]} datasourceFiles - Datasource file names
 * @param {Object} options - { expose?: boolean, sync?: boolean, test?: boolean }
 * @param {boolean} dryRun - If true, do not write
 * @param {string[]} changes - Array to append change descriptions to
 * @returns {boolean} True if any datasource was updated
 */
function runDatasourceRepairs(appPath, datasourceFiles, options, dryRun, changes) {
  if (!datasourceFiles || datasourceFiles.length === 0) return false;
  let updated = false;
  for (const fileName of datasourceFiles) {
    const filePath = path.join(appPath, fileName);
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = loadConfigFile(filePath);
      const { updated: fileUpdated, changes: fileChanges } = repairDatasourceFile(parsed, {
        expose: options.expose,
        sync: options.sync,
        test: options.test
      });
      if (fileUpdated) {
        updated = true;
        fileChanges.forEach(c => changes.push(`${fileName}: ${c}`));
        if (!dryRun) {
          writeConfigFile(filePath, parsed);
        }
      }
    } catch (err) {
      logger.log(chalk.yellow(`⚠ Could not repair datasource ${fileName}: ${err.message}`));
    }
  }
  return updated;
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

/**
 * Regenerates README.md from deployment manifest when options.doc is set.
 * @param {string} appName - Application name
 * @param {string} appPath - Application path
 * @param {Object} options - Options (doc, dryRun)
 * @param {string[]} changes - Array to append change messages to
 * @returns {Promise<boolean>} True if README was regenerated
 */
async function regenerateReadmeIfRequested(appName, appPath, options, changes) {
  if (!options.doc) return false;
  const deployJsonPath = getDeployJsonPath(appName, 'external', true);
  if (!fs.existsSync(deployJsonPath) && !options.dryRun) {
    await regenerateManifest(appName, appPath, changes);
  }
  if (!fs.existsSync(deployJsonPath)) return false;
  try {
    const deployment = JSON.parse(fs.readFileSync(deployJsonPath, 'utf8'));
    const fileExt = inferExternalReadmeFileExt(appPath);
    const readmeContent = generateReadmeFromDeployJson(deployment, { fileExt });
    const readmePath = path.join(appPath, 'README.md');
    if (!options.dryRun) {
      fs.writeFileSync(readmePath, readmeContent, { mode: 0o644, encoding: 'utf8' });
    }
    changes.push('Regenerated README.md from deployment manifest');
    return true;
  } catch (err) {
    logger.log(chalk.yellow(`⚠ Could not regenerate README: ${err.message}`));
    return false;
  }
}

function persistChangesAndRegenerate(configPath, variables, appName, appPath, changes, originalYamlContent) {
  if (originalYamlContent !== null && originalYamlContent !== undefined && typeof originalYamlContent === 'string' && isYamlPath(configPath)) {
    writeYamlPreservingComments(configPath, originalYamlContent, variables);
  } else {
    writeConfigFile(configPath, variables);
  }
  logger.log(formatSuccessLine(`Updated ${path.basename(configPath)}`));
  changes.forEach(c => logger.log(chalk.gray(`  ${c}`)));
  return regenerateManifest(appName, appPath, changes);
}

/**
 * Apply --auth: replace system file authentication with canonical block for the given method.
 * Preserves existing authentication.variables (e.g. baseUrl, tokenUrl) from the current system file.
 * @param {Object} ctx - Context with systemParsed, systemKey, auth, dryRun, changes
 * @returns {boolean} True if auth was replaced
 */
function applyAuthMethod(ctx) {
  if (!ctx.auth || typeof ctx.auth !== 'string') return false;
  const method = ctx.auth.trim().toLowerCase();
  if (!ALLOWED_AUTH.includes(method)) {
    throw new Error(
      `Invalid --auth "${ctx.auth}". Allowed methods: ${ALLOWED_AUTH.join(', ')}`
    );
  }
  const existingAuth = ctx.systemParsed.authentication || ctx.systemParsed.auth || {};
  const { buildAuthenticationFromMethod } = require('../external-system/generator');
  const newAuth = buildAuthenticationFromMethod(ctx.systemKey, method);
  const existingVars = existingAuth.variables && typeof existingAuth.variables === 'object' ? existingAuth.variables : {};
  const mergedVariables = { ...newAuth.variables, ...existingVars };
  ctx.systemParsed.authentication = {
    ...newAuth,
    variables: Object.keys(mergedVariables).length ? mergedVariables : newAuth.variables
  };
  if (existingAuth.displayName !== undefined) {
    ctx.systemParsed.authentication.displayName = existingAuth.displayName;
  }
  ctx.changes.push(`Set authentication method to ${method}`);
  return true;
}

/**
 * Runs all repair steps (integration block, system dataSources, auth/config, app key, datasource keys, rbac, env.template).
 * @param {Object} ctx - Context with appPath, configPath, variables, systemFilePath, systemParsed, systemKey, systemFiles, datasourceFiles, dryRun, changes, auth?
 * @returns {{ updated: boolean, appKeyFixed: boolean, datasourceKeysFixed: boolean, rbacFileCreated: boolean, envTemplateRepaired: boolean }}
 */
function runRepairSteps(ctx) {
  let updated = ensureExternalIntegrationBlock(
    ctx.variables, ctx.systemFiles, ctx.datasourceFiles, ctx.changes
  );
  const authReplaced = applyAuthMethod(ctx);
  updated = updated || authReplaced;
  const systemAuthConfigNormalized = normalizeSystemFileAuthAndConfig(
    ctx.systemParsed, ctx.systemKey, ctx.changes
  );
  const systemDataSourcesAligned = alignSystemFileDataSources(
    ctx.appPath, ctx.systemParsed, ctx.datasourceFiles, ctx.systemKey, ctx.dryRun, ctx.changes
  );
  const authVarsRemoved = removeAuthVarsFromConfiguration(
    ctx.systemParsed, ctx.systemKey, ctx.dryRun, ctx.changes
  );
  if ((authReplaced || systemAuthConfigNormalized || systemDataSourcesAligned || authVarsRemoved) && !ctx.dryRun) {
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
    ctx.appPath, ctx.systemFilePath, ctx.systemParsed, ctx.dryRun, ctx.changes, ctx.format
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
 * @param {boolean} [options.doc] - If true, regenerate README.md from deployment manifest
 * @returns {Promise<{ updated: boolean, changes: string[], systemFiles: string[], datasourceFiles: string[], appKeyFixed?: boolean, datasourceKeysFixed?: boolean, rbacFileCreated?: boolean, envTemplateRepaired?: boolean, manifestRegenerated?: boolean, readmeRegenerated?: boolean }>}
 */
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
  if (systemFiles.length === 0) {
    throw new Error(`No system file found in ${appPath}. Expected *-system.yaml or *-system.json`);
  }
  const datasourceFiles = buildEffectiveDatasourceFiles(appPath, discoveredDatasourceFiles, variables.externalIntegration?.dataSources);
  return { variables, originalYamlContent, systemFiles, datasourceFiles };
}

/**
 * Builds the repair result object from steps and flags.
 * @param {Object} steps - Result of runRepairSteps
 * @param {boolean} anyUpdated - Whether any repair made changes
 * @param {boolean} manifestRegenerated - Whether manifest was regenerated
 * @param {boolean} readmeRegenerated - Whether README was regenerated
 * @param {{ changes: string[], systemFiles: string[], datasourceFiles: string[] }} ctx - changes and file lists
 * @returns {Object} Combined result object
 */
function buildRepairResult(steps, anyUpdated, manifestRegenerated, readmeRegenerated, ctx) {
  return Object.assign(
    { updated: anyUpdated, changes: ctx.changes, systemFiles: ctx.systemFiles, datasourceFiles: ctx.datasourceFiles },
    {
      appKeyFixed: steps.appKeyFixed,
      datasourceKeysFixed: steps.datasourceKeysFixed,
      rbacFileCreated: steps.rbacFileCreated,
      envTemplateRepaired: steps.envTemplateRepaired,
      manifestRegenerated,
      readmeRegenerated
    }
  );
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

async function repairExternalIntegration(appName, options = {}) {
  const { appPath, configPath, dryRun, authOption } = await validateAndResolveRepairPaths(appName, options);

  const { variables, originalYamlContent, systemFiles, datasourceFiles: initialDatasourceFiles } = loadConfigAndDiscover(appPath, configPath);
  const changes = [];
  const { systemFilePath, systemParsed, systemKey } = resolveSystemContext(appPath, systemFiles);
  const { updated: keysNormalized, datasourceFiles } = normalizeDatasourceKeysAndFilenames(
    appPath,
    initialDatasourceFiles,
    systemKey,
    variables,
    dryRun,
    changes
  );
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
    changes,
    auth: authOption,
    format: options.format === 'json' ? 'json' : 'yaml'
  });
  const datasourceRepairUpdated = runDatasourceRepairs(appPath, datasourceFiles, {
    expose: Boolean(options.expose),
    sync: Boolean(options.sync),
    test: Boolean(options.test)
  }, dryRun, changes);
  const rbacMergeUpdated = options.rbac
    ? mergeRbacFromDatasources(appPath, systemParsed, datasourceFiles, extractRbacFromSystem, {
      format: options.format === 'json' ? 'json' : 'yaml',
      dryRun,
      changes
    })
    : false;
  const anyUpdated = keysNormalized || steps.updated || datasourceRepairUpdated || rbacMergeUpdated;
  const manifestRegenerated = (anyUpdated && !dryRun)
    ? await persistChangesAndRegenerate(configPath, variables, appName, appPath, changes, originalYamlContent)
    : false;
  const readmeRegenerated = await regenerateReadmeIfRequested(appName, appPath, options, changes);
  return buildRepairResult(steps, anyUpdated, manifestRegenerated, readmeRegenerated, { changes, systemFiles, datasourceFiles });
}

module.exports = {
  repairExternalIntegration,
  discoverIntegrationFiles
};
