/**
 * External integration repair orchestration (local file updates, manifest, README).
 *
 * @fileoverview Repair external integration run pipeline
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { normalizeDatasourceKeysAndFilenames } = require('./repair-datasource-keys');
const { resolveSystemContext } = require('./repair-system-alignment');
const { persistChangesAndRegenerate, regenerateReadmeIfRequested } = require('./repair-persist');
const { runRepairSteps } = require('./repair-steps');
const { runDatasourceRepairs } = require('./repair-datasource-run');
const { maybeRepairRbac } = require('./repair-rbac');
const { maybeRunOpenApiSyncForMcp } = require('./repair-openapi-sync');

/**
 * @param {Object} steps
 * @param {boolean} anyUpdated
 * @param {boolean} manifestRegenerated
 * @param {boolean} readmeRegenerated
 * @param {Object} ctx
 * @returns {Object}
 */
function buildRepairResult(steps, anyUpdated, manifestRegenerated, readmeRegenerated, ctx) {
  return Object.assign(
    {
      updated: anyUpdated,
      actionsPerformed: ctx.actionsPerformed === true,
      changes: ctx.changes,
      warnings: ctx.warnings || [],
      changedFiles: ctx.changedFiles || [],
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
 * @param {Object} params
 * @returns {Object}
 */
function prepareRepairWorkspace(params) {
  const {
    options,
    appPath,
    configPath,
    dryRun,
    authOption,
    backupCtx,
    variables,
    systemFiles,
    datasourceFiles: initialDatasourceFiles
  } = params;
  const changes = [];
  const warnings = [];
  const { systemFilePath, systemParsed, systemKey } = resolveSystemContext(appPath, systemFiles);
  const rbacFmt = options.format === 'json' ? 'json' : 'yaml';
  const { updated: keysNormalized, datasourceFiles } = normalizeDatasourceKeysAndFilenames(
    appPath,
    initialDatasourceFiles,
    systemKey,
    { variables, dryRun, changes, backupCtx }
  );
  return {
    options,
    appPath,
    configPath,
    dryRun,
    authOption,
    backupCtx,
    variables,
    systemFiles,
    changes,
    warnings,
    systemFilePath,
    systemParsed,
    systemKey,
    rbacFmt,
    keysNormalized,
    datasourceFiles
  };
}

/**
 * @param {Object} ws
 * @returns {Promise<Object>}
 */
async function runRepairIntegrationFileSteps(ws) {
  const steps = runRepairSteps({
    appPath: ws.appPath,
    configPath: ws.configPath,
    variables: ws.variables,
    systemFilePath: ws.systemFilePath,
    systemParsed: ws.systemParsed,
    systemKey: ws.systemKey,
    systemFiles: ws.systemFiles,
    datasourceFiles: ws.datasourceFiles,
    dryRun: ws.dryRun,
    changes: ws.changes,
    warnings: ws.warnings,
    auth: ws.authOption,
    format: ws.rbacFmt,
    backupCtx: ws.backupCtx
  });
  const datasourceRepairUpdated = runDatasourceRepairs(
    ws.appPath,
    ws.datasourceFiles,
    {
      expose: Boolean(ws.options.expose),
      sync: Boolean(ws.options.sync),
      test: Boolean(ws.options.test),
      backupCtx: ws.backupCtx
    },
    ws.dryRun,
    ws.changes
  );
  const openapiActionsPerformed = await maybeRunOpenApiSyncForMcp({
    options: ws.options,
    dryRun: ws.dryRun,
    appPath: ws.appPath,
    systemKey: ws.systemKey,
    datasourceFiles: ws.datasourceFiles,
    changes: ws.changes
  });
  const { rbacMigratedFromSystem, rbacMergeUpdated } = maybeRepairRbac(
    ws.appPath,
    ws.systemFilePath,
    ws.systemParsed,
    ws.datasourceFiles,
    { rbac: Boolean(ws.options.rbac), rbacFmt: ws.rbacFmt, dryRun: ws.dryRun, changes: ws.changes, backupCtx: ws.backupCtx }
  );
  const anyLocalUpdated =
    ws.keysNormalized || steps.updated || datasourceRepairUpdated || rbacMigratedFromSystem || rbacMergeUpdated;
  return {
    steps,
    anyLocalUpdated,
    changes: ws.changes,
    warnings: ws.warnings,
    openapiActionsPerformed,
    systemFiles: ws.systemFiles,
    datasourceFiles: ws.datasourceFiles
  };
}

/**
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function runRepairLocalUpdates(params) {
  const ws = prepareRepairWorkspace(params);
  return runRepairIntegrationFileSteps(ws);
}

/**
 * @param {Object} params
 * @param {Object} local
 * @returns {Promise<Object>}
 */
async function finalizeRepairIntegration(params, local) {
  const { appName, options, appPath, configPath, dryRun, backupPaths, backupCtx, variables, originalYamlContent } =
    params;
  const { steps, anyLocalUpdated, changes, warnings, openapiActionsPerformed, systemFiles, datasourceFiles } = local;
  let manifestRegenerated = false;
  if (anyLocalUpdated && !dryRun) {
    manifestRegenerated = await persistChangesAndRegenerate({
      configPath,
      variables,
      appName,
      appPath,
      changes,
      originalYamlContent,
      backupCtx
    });
  }
  const readmeRegenerated = await regenerateReadmeIfRequested(
    appName,
    appPath,
    { ...options, backupCtx },
    changes
  );
  const changedFiles = dryRun ? backupCtx.wouldChangeFiles : backupCtx.changedFiles;
  return buildRepairResult(steps, anyLocalUpdated, manifestRegenerated, readmeRegenerated, {
    actionsPerformed: openapiActionsPerformed,
    changes,
    warnings,
    changedFiles,
    systemFiles,
    datasourceFiles,
    backupPaths
  });
}

/**
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function runRepairExternalIntegration(params) {
  const local = await runRepairLocalUpdates(params);
  return finalizeRepairIntegration(params, local);
}

module.exports = {
  runRepairExternalIntegration
};
