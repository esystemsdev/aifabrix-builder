/**
 * Core repair step runner (integration block, system alignment, auth, RBAC file, env.template).
 *
 * @fileoverview Repair step orchestration
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { backupIntegrationFile } = require('../utils/integration-file-backup');
const { writeConfigFile } = require('../utils/config-format');
const { trackRepairWrite } = require('./repair-changed-files');
const { repairEnvTemplate, normalizeSystemFileAuthAndConfig } = require('./repair-env-template');
const { createRbacFromSystemIfNeeded } = require('./repair-rbac');
const {
  alignAppKeyWithSystem,
  alignDatasourceSystemKeys,
  alignSystemFileDataSources,
  ensureExternalIntegrationBlock,
  removeAuthVarsFromConfiguration
} = require('./repair-system-alignment');
const {
  isAllowedRepairAuth,
  normalizeRepairAuthOption,
  buildAuthenticationForRepair,
  mergePreservedAuthVariables,
  repairAuthChangeLabel,
  auditRepairAuthenticationWarnings
} = require('./repair-auth-apply');

/**
 * Apply --auth: replace system file authentication with canonical block for the given method.
 * @param {Object} ctx - Context with systemParsed, systemKey, auth, dryRun, changes
 * @returns {boolean} True if auth was replaced
 */
function applyAuthMethod(ctx) {
  if (!ctx.auth || typeof ctx.auth !== 'string') return false;
  const authOption = normalizeRepairAuthOption(ctx.auth);
  if (!isAllowedRepairAuth(authOption)) {
    throw new Error(
      'Invalid --auth "' +
        `${ctx.auth}". Allowed methods: oauth2, aad, apikey, bearerKey, basic, queryParam, oidc, hmac, none`
    );
  }
  const existingAuth = ctx.systemParsed.authentication || ctx.systemParsed.auth || {};
  const newAuth = buildAuthenticationForRepair(ctx.systemKey, authOption);
  const existingVars =
    existingAuth.variables && typeof existingAuth.variables === 'object'
      ? existingAuth.variables
      : {};
  const mergedVariables = { ...newAuth.variables };
  mergePreservedAuthVariables(mergedVariables, existingVars);
  ctx.systemParsed.authentication = {
    ...newAuth,
    variables: mergedVariables
  };
  if (existingAuth.displayName !== undefined) {
    ctx.systemParsed.authentication.displayName = existingAuth.displayName;
  }
  ctx.changes.push(`Set authentication method to ${repairAuthChangeLabel(authOption)}`);
  return true;
}

/**
 * @param {Object} ctx
 * @param {Object} flags
 * @returns {boolean}
 */
function persistSystemFileRepair(ctx, flags) {
  const systemFileUpdated =
    flags.authReplaced ||
    flags.systemAuthConfigNormalized ||
    flags.systemDataSourcesAligned ||
    flags.authVarsRemoved;
  if (!systemFileUpdated) {
    return false;
  }
  trackRepairWrite(ctx.systemFilePath, ctx.backupCtx);
  if (!ctx.dryRun) {
    backupIntegrationFile(ctx.systemFilePath, ctx.backupCtx);
    writeConfigFile(ctx.systemFilePath, ctx.systemParsed);
  }
  return true;
}

/**
 * @param {Object} ctx
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
  const systemFileUpdated = persistSystemFileRepair(ctx, {
    authReplaced,
    systemAuthConfigNormalized,
    systemDataSourcesAligned,
    authVarsRemoved
  });
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
  auditRepairAuthenticationWarnings(ctx.systemParsed, ctx.warnings);
  return {
    updated,
    appKeyFixed,
    datasourceKeysFixed,
    rbacFileCreated,
    envTemplateRepaired
  };
}

module.exports = {
  runRepairSteps
};
