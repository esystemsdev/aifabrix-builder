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
const { detectAppType } = require('../utils/paths');
const { resolveApplicationConfigPath, resolveRbacPath } = require('../utils/app-config-resolver');
const { loadConfigFile, writeConfigFile, isYamlPath } = require('../utils/config-format');
const logger = require('../utils/logger');
const { repairEnvTemplate, normalizeSystemFileAuthAndConfig } = require('./repair-env-template');
const { repairDatasourceFile } = require('./repair-datasource');
const { mergeRbacFromDatasources, extractRbacFromSystem, migrateSystemRbacIntoRbacFile } = require('./repair-rbac');
const { discoverIntegrationFiles, buildEffectiveDatasourceFiles } = require('./repair-internal');
const { normalizeDatasourceKeysAndFilenames } = require('./repair-datasource-keys');
const { backupIntegrationFile } = require('../utils/integration-file-backup');
const { maybeSyncOpenApiFilesForMcp } = require('./repair-openapi-sync');
const {
  alignAppKeyWithSystem,
  alignDatasourceSystemKeys,
  alignSystemFileDataSources,
  ensureExternalIntegrationBlock,
  removeAuthVarsFromConfiguration,
  resolveSystemContext
} = require('./repair-system-alignment');
const { persistChangesAndRegenerate, regenerateReadmeIfRequested } = require('./repair-persist');

/** Allowed authentication methods for repair --auth (matches external-system schema) */
const ALLOWED_AUTH = ['oauth2', 'aad', 'apikey', 'basic', 'queryParam', 'oidc', 'hmac', 'none'];

function createRbacFromSystemIfNeeded(opts) {
  const { appPath, systemFilePath, systemParsed, dryRun, changes, format, backupCtx } = opts;
  if (resolveRbacPath(appPath)) return false;
  const rbacFromSystem = extractRbacFromSystem(systemParsed);
  if (!rbacFromSystem) return false;
  if (!dryRun) {
    const rbacFormat = format === 'json' ? 'json' : 'yaml';
    const defaultRbacPath = path.join(appPath, rbacFormat === 'json' ? 'rbac.json' : 'rbac.yaml');
    writeConfigFile(defaultRbacPath, rbacFromSystem, rbacFormat);
    delete systemParsed.roles;
    delete systemParsed.permissions;
    backupIntegrationFile(systemFilePath, backupCtx);
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
          backupIntegrationFile(filePath, options.backupCtx);
          writeConfigFile(filePath, parsed);
        }
      }
    } catch (err) {
      logger.log(chalk.yellow(`⚠ Could not repair datasource ${fileName}: ${err.message}`));
    }
  }
  return updated;
}

function maybeRepairRbac(appPath, systemFilePath, systemParsed, datasourceFiles, options) {
  if (!options.rbac) return { rbacMigratedFromSystem: false, rbacMergeUpdated: false };
  const { dryRun, changes, backupCtx, rbacFmt } = options;
  const rbacMigratedFromSystem = migrateSystemRbacIntoRbacFile(appPath, systemFilePath, systemParsed, { dryRun, changes, backupCtx });
  const rbacMergeUpdated = mergeRbacFromDatasources(appPath, systemParsed, datasourceFiles, extractRbacFromSystem, {
    format: rbacFmt,
    dryRun,
    changes,
    backupCtx
  });
  return { rbacMigratedFromSystem, rbacMergeUpdated };
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
  const existingVars =
    existingAuth.variables && typeof existingAuth.variables === 'object'
      ? existingAuth.variables
      : {};
  // When switching auth method, keep only connectivity fields from the wizard draft.
  // Do not let OAuth-era variables (tokenUrl, scope, headerName, …) override the new method.
  const mergedVariables = { ...newAuth.variables };
  for (const key of ['baseUrl', 'testEndpoint']) {
    if (existingVars[key] !== undefined && existingVars[key] !== null) {
      mergedVariables[key] = existingVars[key];
    }
  }
  ctx.systemParsed.authentication = {
    ...newAuth,
    variables: mergedVariables
  };
  if (existingAuth.displayName !== undefined) {
    ctx.systemParsed.authentication.displayName = existingAuth.displayName;
  }
  ctx.changes.push(`Set authentication method to ${method}`);
  return true;
}

/**
 * Runs all repair steps (integration block, system dataSources, auth/config, app key, datasource keys, rbac, env.template).
 * @param {Object} ctx - Context with appPath, configPath, variables, systemFilePath, systemParsed, systemKey, systemFiles, datasourceFiles, dryRun, changes, auth?, backupCtx?
 * @returns {{ updated: boolean, appKeyFixed: boolean, datasourceKeysFixed: boolean, rbacFileCreated: boolean, envTemplateRepaired: boolean }}
 */
function runRepairSteps(ctx) {
  const bc = ctx.backupCtx;
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
  const systemFileUpdated =
    authReplaced || systemAuthConfigNormalized || systemDataSourcesAligned || authVarsRemoved;
  if (systemFileUpdated && !ctx.dryRun) {
    backupIntegrationFile(ctx.systemFilePath, bc);
    writeConfigFile(ctx.systemFilePath, ctx.systemParsed);
  }
  updated = updated || systemFileUpdated;
  const appKeyFixed = alignAppKeyWithSystem(
    ctx.variables, ctx.systemKey, ctx.systemParsed, ctx.changes
  );
  const datasourceKeysFixed = alignDatasourceSystemKeys(
    ctx.appPath, ctx.datasourceFiles, ctx.systemKey, ctx.dryRun, ctx.changes, bc
  );
  const rbacFileCreated = createRbacFromSystemIfNeeded({
    appPath: ctx.appPath,
    systemFilePath: ctx.systemFilePath,
    systemParsed: ctx.systemParsed,
    dryRun: ctx.dryRun,
    changes: ctx.changes,
    format: ctx.format,
    backupCtx: bc
  });
  const envTemplateRepaired = repairEnvTemplate(
    ctx.appPath, ctx.systemParsed, ctx.systemKey, ctx.dryRun, ctx.changes, bc
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
    {
      updated: anyUpdated,
      actionsPerformed: ctx.actionsPerformed === true,
      changes: ctx.changes,
      systemFiles: ctx.systemFiles,
      datasourceFiles: ctx.datasourceFiles,
      backupPaths: ctx.backupPaths || []
    },
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

/**
 * @param {Object} options - CLI options (noBackup, backup)
 * @param {boolean} dryRun
 * @returns {{ backupPaths: string[], backupCtx: Object }}
 */
function createRepairBackupContext(options, dryRun) {
  const noBackup = options.noBackup === true || options.backup === false;
  const backupPaths = [];
  const backedUpFiles = new Set();
  const backupCtx = { dryRun, noBackup, backupPaths, backedUpFiles };
  return { backupPaths, backupCtx };
}

async function maybeRunOpenApiSyncForMcp({ options, dryRun, appPath, systemKey, datasourceFiles, changes }) {
  if (!options.api) return false;
  try {
    const openapiLines = await maybeSyncOpenApiFilesForMcp({
      enabled: true,
      dryRun,
      appPath,
      systemKey,
      datasourceFiles
    });
    openapiLines.forEach((l) => changes.push(l));
    return openapiLines.length > 0;
  } catch (err) {
    changes.push(`OpenAPI upload for MCP failed: ${err.message}`);
    return false;
  }
}

async function repairExternalIntegration(appName, options = {}) {
  const { appPath, configPath, dryRun, authOption } = await validateAndResolveRepairPaths(appName, options);
  const { backupPaths, backupCtx } = createRepairBackupContext(options, dryRun);
  const { variables, originalYamlContent, systemFiles, datasourceFiles: initialDatasourceFiles } = loadConfigAndDiscover(appPath, configPath);
  const changes = [];
  const { systemFilePath, systemParsed, systemKey } = resolveSystemContext(appPath, systemFiles);
  const rbacFmt = options.format === 'json' ? 'json' : 'yaml';
  const { updated: keysNormalized, datasourceFiles } = normalizeDatasourceKeysAndFilenames(appPath, initialDatasourceFiles, systemKey, { variables, dryRun, changes, backupCtx });
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
    format: rbacFmt,
    backupCtx
  });
  const datasourceRepairUpdated = runDatasourceRepairs(appPath, datasourceFiles, {
    expose: Boolean(options.expose),
    sync: Boolean(options.sync),
    test: Boolean(options.test),
    backupCtx
  }, dryRun, changes);
  const openapiActionsPerformed = await maybeRunOpenApiSyncForMcp({
    options,
    dryRun,
    appPath,
    systemKey,
    datasourceFiles,
    changes
  });
  const { rbacMigratedFromSystem, rbacMergeUpdated } = maybeRepairRbac(
    appPath,
    systemFilePath,
    systemParsed,
    datasourceFiles,
    { rbac: Boolean(options.rbac), rbacFmt, dryRun, changes, backupCtx }
  );
  const anyLocalUpdated = keysNormalized || steps.updated || datasourceRepairUpdated || rbacMigratedFromSystem || rbacMergeUpdated;
  const manifestRegenerated = (anyLocalUpdated && !dryRun) ? await persistChangesAndRegenerate(
    { configPath, variables, appName, appPath, changes, originalYamlContent, backupCtx }
  ) : false;
  const readmeRegenerated = await regenerateReadmeIfRequested(appName, appPath, { ...options, backupCtx }, changes);
  return buildRepairResult(steps, anyLocalUpdated, manifestRegenerated, readmeRegenerated, {
    actionsPerformed: openapiActionsPerformed,
    changes,
    systemFiles,
    datasourceFiles,
    backupPaths
  });
}

module.exports = {
  repairExternalIntegration,
  discoverIntegrationFiles
};
