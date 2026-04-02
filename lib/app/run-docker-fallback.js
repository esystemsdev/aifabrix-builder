/**
 * Fallback `docker run` when Docker Compose CLI is missing — narrow case only.
 *
 * @fileoverview Apps that declare no Postgres/Redis in application.yaml can start
 *   with plain Docker; same eligibility as skipping local infra health.
 */

'use strict';

const { promisify } = require('util');
const { exec } = require('child_process');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getContainerPort } = require('../utils/port-resolver');
const { getAppInfraRequirements } = require('./run-infra-requirements');

const execAsync = promisify(exec);

/**
 * Shell-single-quote a string for use inside a POSIX sh -c style command.
 * @param {string} value
 * @returns {string}
 */
function shellSingleQuote(value) {
  const s = String(value);
  return '\'' + s.replace(/'/g, '\'\\\'\'') + '\'';
}

/**
 * Named volume for /mnt/data (must match templates/typescript/docker-compose.hbs).
 * @param {string} appName
 * @param {string|number} developerId
 * @returns {string}
 */
function storageVolumeName(appName, developerId) {
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  if (idNum === 0) {
    return `aifabrix_${appName}_data`;
  }
  return `aifabrix_dev${developerId}_${appName}_data`;
}

/**
 * True when safe to emulate compose with `docker run` if Compose is unavailable.
 * @param {Object} appConfig
 * @param {{ devMountPath?: string|null }} startOpts
 * @returns {boolean}
 */
function canUseDockerRunWithoutCompose(appConfig, startOpts) {
  const req = getAppInfraRequirements(appConfig);
  if (!req || req.needsPostgres || req.needsRedis) {
    return false;
  }
  if (appConfig.frontDoorRouting && appConfig.frontDoorRouting.enabled === true) {
    return false;
  }
  if (startOpts.devMountPath) {
    return false;
  }
  return true;
}

/**
 * @param {Object} o
 * @param {string} o.appName
 * @param {Object} o.appConfig
 * @param {number} o.hostPort
 * @param {string} o.fullImage image:tag
 * @param {string|null} o.runEnvPath
 * @param {string} o.misoEnvironment
 * @param {boolean} o.debug
 * @returns {Promise<void>}
 */
async function executeDockerRunUp(o) {
  const { appName, appConfig, hostPort, fullImage, runEnvPath, misoEnvironment, debug } = o;
  const idNum = typeof appConfig.developerId === 'string' ? parseInt(appConfig.developerId, 10) : appConfig.developerId;
  const containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${appConfig.developerId}-${appName}`;
  const containerPort = getContainerPort(appConfig, 3000);

  const needsStorage =
    appConfig.requires?.storage === true ||
    appConfig.services?.storage === true;

  const parts = [
    'docker run -d',
    `--name ${shellSingleQuote(containerName)}`,
    '--restart unless-stopped',
    `-p ${hostPort}:${containerPort}`,
    `-e MISO_ENVIRONMENT=${shellSingleQuote(misoEnvironment)}`
  ];

  if (needsStorage) {
    parts.push(`-v ${shellSingleQuote(storageVolumeName(appName, appConfig.developerId))}:/mnt/data`);
  }
  if (runEnvPath && typeof runEnvPath === 'string') {
    parts.push(`--env-file ${shellSingleQuote(runEnvPath)}`);
  }
  parts.push(shellSingleQuote(fullImage));

  const cmd = parts.join(' ');
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Docker run fallback: ${cmd.replace(/env-file [^ ]+/, 'env-file <redacted>')}`));
  }
  await execAsync(cmd);
}

module.exports = {
  canUseDockerRunWithoutCompose,
  executeDockerRunUp,
  storageVolumeName
};
