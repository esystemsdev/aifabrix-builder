/**
 * Docker Compose file generation (extracted from compose-generator).
 *
 * @fileoverview Satisfies ESLint max-lines / max-lines-per-function on compose-generator
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fsSync = require('fs');
const path = require('path');
const buildCopy = require('./build-copy');
const paths = require('./paths');
const { getInfraDirName } = require('../infrastructure/helpers');
const { resolveMisoEnvironment } = require('./compose-miso-env');

/**
 * Resolve infra `pgpass` path: prefer system config dir; when home differs, allow legacy layout.
 * @param {string|number} devId - Developer id (infra vs infra-dev{n})
 * @param {{ getAifabrixSystemDir: Function, getAifabrixHome: Function }} pathsUtil - paths module
 * @param {(filePath: string) => boolean} [existsSyncFn] - sync existence check (default: fs.existsSync)
 * @returns {string} Candidate pgpass path (may not exist)
 */
function resolveInfraPgpassPath(devId, pathsUtil, existsSyncFn = fsSync.existsSync) {
  const infraName = getInfraDirName(devId);
  const sysPgpass = path.join(pathsUtil.getAifabrixSystemDir(), infraName, 'pgpass');
  const legPgpass = path.join(pathsUtil.getAifabrixHome(), infraName, 'pgpass');
  return existsSyncFn(sysPgpass) || pathsUtil.getAifabrixHome() === pathsUtil.getAifabrixSystemDir()
    ? sysPgpass
    : existsSyncFn(legPgpass)
      ? legPgpass
      : sysPgpass;
}

/**
 * @param {object} ctx - Template context fields
 * @returns {object} Spread-ready payload for Handlebars template
 */
function buildComposeTemplateContext(ctx) {
  return {
    ...ctx.serviceConfig,
    ...ctx.volumesConfig,
    ...ctx.networksConfig,
    envFile: ctx.envFileAbsolutePath,
    dbInitEnvFile: ctx.dbInitEnvFileAbsolutePath,
    databasePasswords: ctx.databasePasswords,
    devId: ctx.idNum,
    networkName: ctx.networkName,
    containerName: ctx.containerName,
    misoEnvironment: resolveMisoEnvironment(ctx.options),
    devMountPath: ctx.devMountPath,
    reloadStartCommand: ctx.reloadStartCommand,
    infraPgpassPath: ctx.useInfraPgpass ? ctx.infraPgpassPath : null,
    useInfraPgpass: !!ctx.useInfraPgpass
  };
}

/**
 * @param {Object} options - Run options
 * @returns {{ scoped: object|null }}
 */
function resolveScopedComposeOpts(options) {
  const runEnvKey = options.env ? String(options.env).toLowerCase() : 'dev';
  const scopeOpts = {
    effectiveEnvironmentScopedResources: options.effectiveEnvironmentScopedResources === true,
    runEnvKey
  };
  const useScope =
    scopeOpts.effectiveEnvironmentScopedResources && (runEnvKey === 'dev' || runEnvKey === 'tst');
  return { scoped: useScope ? scopeOpts : null };
}

function resolveDevMountPath(options) {
  return options.devMountPath && typeof options.devMountPath === 'string' ? options.devMountPath.trim() : null;
}

function resolveEnvFilePath(options, devDir) {
  const envFilePath =
    options.envFilePath && typeof options.envFilePath === 'string'
      ? path.resolve(options.envFilePath)
      : path.join(devDir, '.env');
  return envFilePath.replace(/\\/g, '/');
}

async function readDatabasePasswordsIfNeeded(readDatabasePasswords, requiresDatabase, databases, envPath, appName) {
  if (requiresDatabase || databases.length > 0) {
    return await readDatabasePasswords(envPath, databases, appName);
  }
  return { map: {}, array: [] };
}

/**
 * @param {object} deps
 * @param {string} appName
 * @param {object} appConfig
 * @param {object} options
 * @returns {Promise<object>}
 */
async function loadComposeHead(deps, appName, appConfig, options) {
  const { loadDockerComposeTemplate, resolveComposeImageOverrideString, getDeveloperIdAndNumeric, getRemoteServerForCompose } = deps;
  const language = appConfig.build?.language || appConfig.language || 'typescript';
  const template = loadDockerComposeTemplate(language);
  const port = options.port || appConfig.port || 3000;
  const imageOverride = resolveComposeImageOverrideString(appName, appConfig, options);
  const { devId, idNum } = await getDeveloperIdAndNumeric();
  const { scoped } = resolveScopedComposeOpts(options);
  let remoteServer = null;
  if (typeof getRemoteServerForCompose === 'function') {
    remoteServer = await getRemoteServerForCompose();
  }
  return { template, port, imageOverride, devId, idNum, scoped, remoteServer };
}

/**
 * @param {object} deps
 * @param {string} appName
 * @param {object} appConfig
 * @param {object} head - From loadComposeHead
 * @returns {object}
 */
function buildComposeLayouts(deps, appName, appConfig, head) {
  const { buildNetworkAndContainerNames, buildServiceConfig, buildVolumesConfig, buildNetworksConfig } = deps;
  const { port, imageOverride, devId, idNum, scoped, remoteServer } = head;
  const { networkName, containerName } = buildNetworkAndContainerNames(appName, devId, idNum, scoped);
  const serviceConfig = buildServiceConfig(appName, appConfig, port, devId, {
    imageOverride,
    scopeOpts: scoped,
    remoteServer
  });
  const volumesConfig = buildVolumesConfig(appName);
  const networksConfig = buildNetworksConfig(appConfig);
  return { networkName, containerName, serviceConfig, volumesConfig, networksConfig };
}

/**
 * @param {object} ctx
 * @param {object} ctx.options - Run options
 * @param {string} ctx.appName
 * @param {string|number} ctx.devId
 * @param {object} ctx.appConfig
 * @param {object} ctx.serviceCf - serviceConfig from layouts
 * @param {object} ctx.networksCf - networksConfig from layouts
 * @param {Function} ctx.readDatabasePasswords
 * @returns {Promise<object>}
 */
async function resolveComposePathsAndSecrets(ctx) {
  const { options, appName, devId, appConfig, serviceCf, networksCf, readDatabasePasswords } = ctx;
  const devDir = buildCopy.getDevDirectory(appName, devId);
  const envFileAbsolutePath = resolveEnvFilePath(options, devDir);
  const dbInitEnvFileAbsolutePath =
    options.dbInitEnvFilePath && typeof options.dbInitEnvFilePath === 'string'
      ? path.resolve(options.dbInitEnvFilePath).replace(/\\/g, '/')
      : null;
  const databasePasswords = await readDatabasePasswordsIfNeeded(
    readDatabasePasswords,
    serviceCf.requiresDatabase || false,
    networksCf.databases || [],
    envFileAbsolutePath,
    appName
  );
  const devMountPath = resolveDevMountPath(options);
  const reloadRaw = appConfig.build?.reloadStart;
  const reloadStartCommand =
    devMountPath && typeof reloadRaw === 'string' && reloadRaw.trim().length > 0 ? reloadRaw.trim() : null;
  const infraPgpassPath = resolveInfraPgpassPath(devId, paths, fsSync.existsSync);
  const useInfraPgpass = serviceCf.requiresDatabase && fsSync.existsSync(infraPgpassPath);
  return {
    envFileAbsolutePath,
    dbInitEnvFileAbsolutePath,
    databasePasswords,
    devMountPath,
    reloadStartCommand,
    infraPgpassPath,
    useInfraPgpass
  };
}

/**
 * @param {object} deps
 * @param {string} appName
 * @param {object} appConfig
 * @param {object} options
 * @returns {Promise<string>}
 */
async function generateDockerComposeImpl(deps, appName, appConfig, options) {
  const head = await loadComposeHead(deps, appName, appConfig, options);
  const layouts = buildComposeLayouts(deps, appName, appConfig, head);
  const side = await resolveComposePathsAndSecrets({
    options,
    appName,
    devId: head.devId,
    appConfig,
    serviceCf: layouts.serviceConfig,
    networksCf: layouts.networksConfig,
    readDatabasePasswords: deps.readDatabasePasswords
  });
  return head.template(
    buildComposeTemplateContext({
      ...layouts,
      ...side,
      idNum: head.idNum,
      options
    })
  );
}

/**
 * @param {object} deps - Functions from compose-generator
 * @returns {Function} async generateDockerCompose(appName, appConfig, options)
 */
function createGenerateDockerCompose(deps) {
  return (appName, appConfig, options) => generateDockerComposeImpl(deps, appName, appConfig, options);
}

module.exports = { createGenerateDockerCompose, resolveInfraPgpassPath };
