/**
 * Docker Compose up and docker-run fallback for `aifabrix run`.
 *
 * @fileoverview Extracted from run-helpers to keep file size within limits
 */

'use strict';

const fs = require('fs').promises;
const chalk = require('chalk');
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const dockerUtils = require('../utils/docker');
const containerHelpers = require('../utils/app-run-containers');
const { waitForHealthCheck } = require('../utils/health-check');
const runDockerFallback = require('./run-docker-fallback');
const { resolveRunImage } = require('./run-resolve-image');

const execAsync = promisify(exec);

/**
 * Logs and runs docker when Compose CLI is missing (narrow eligibility).
 * @async
 * @param {string} appName
 * @param {Object} appConfig
 * @param {number} port
 * @param {Object} opts
 */
async function emitAndRunDockerFallback(appName, appConfig, port, opts) {
  const { debug, runEnvPath, runOptions, misoEnvironment } = opts;
  logger.log(
    chalk.yellow(
      'Docker Compose not found; using docker run (apps without database/redis only). ' +
        'Install docker-compose-plugin for full compose support.'
    )
  );
  const { imageName, imageTag } = resolveRunImage(appName, appConfig, runOptions);
  await runDockerFallback.executeDockerRunUp({
    appName,
    appConfig,
    hostPort: port,
    fullImage: `${imageName}:${imageTag}`,
    runEnvPath,
    misoEnvironment,
    debug
  });
}

/**
 * Prepares env for docker compose child process (UID/GID + remote docker).
 * @async
 * @param {boolean} debug
 * @returns {Promise<Object>}
 */
async function prepareContainerEnv(debug) {
  const { getDockerExecEnv } = require('../utils/remote-docker-env');
  const env = await getDockerExecEnv();

  if (typeof process.getuid === 'function' && typeof process.getgid === 'function') {
    env.AIFABRIX_UID = String(process.getuid());
    env.AIFABRIX_GID = String(process.getgid());
  } else {
    env.AIFABRIX_UID = '1000';
    env.AIFABRIX_GID = '1000';
  }

  if (debug) {
    logger.log(chalk.gray('[DEBUG] Container env prepared (secrets via env_file)'));
  }

  return env;
}

/**
 * @async
 * @param {string} composeCmdBase
 * @param {string} composePath
 * @param {Object} env
 * @param {boolean} debug
 */
async function executeComposeUp(composeCmdBase, composePath, env, debug) {
  const composeCmd = `${composeCmdBase} -f "${composePath}" up -d`;
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Executing: ${composeCmd}`));
    logger.log(chalk.gray(`[DEBUG] Compose file: ${composePath}`));
  }
  await execAsync(composeCmd, { env });
}

/**
 * Log status, wait for HTTP health, delete run .env files.
 * @async
 * @param {string} appName
 * @param {number} port
 * @param {Object} appConfig
 * @param {{ debug: boolean, runEnvPath: string|null, runEnvAdminPath: string|null }} o
 */
async function waitForHealthyAndCleanupEnvFiles(appName, port, appConfig, o) {
  const { debug, runEnvPath, runEnvAdminPath, runOptions = {} } = o;
  const ro = runOptions || {};
  const scopeOpts =
    ro.effectiveEnvironmentScopedResources === true && ro.env
      ? { effectiveEnvironmentScopedResources: true, env: String(ro.env).toLowerCase() }
      : null;
  const containerName = containerHelpers.getContainerName(appName, appConfig.developerId, scopeOpts);
  logger.log(chalk.green(`✓ Container ${containerName} started`));
  await containerHelpers.logContainerStatus(containerName, debug);

  const healthCheckPath = appConfig?.healthCheck?.path || '/health';
  logger.log(chalk.blue(`Waiting for application to be healthy at http://localhost:${port}${healthCheckPath}...`));
  await waitForHealthCheck(appName, 90, port, appConfig, debug);

  for (const p of [runEnvPath, runEnvAdminPath]) {
    if (p && typeof p === 'string') {
      try {
        await fs.unlink(p);
      } catch (err) {
        if (err.code !== 'ENOENT') logger.log(chalk.yellow(`Warning: could not remove run .env: ${err.message}`));
      }
    }
  }
}

/**
 * Starts the container and waits for health check. Deletes run .env files after success (ISO 27K).
 * @async
 * @param {string} appName
 * @param {string} composePath
 * @param {number} port
 * @param {Object} appConfig
 * @param {Object} [opts]
 */
async function startContainer(appName, composePath, port, appConfig = null, opts = {}) {
  const {
    debug = false,
    runEnvPath = null,
    runEnvAdminPath = null,
    runOptions = {},
    devMountPath = null,
    misoEnvironment = 'dev'
  } = opts;
  logger.log(chalk.blue(`Starting ${appName}...`));

  let composeCmdBase;
  let usedDockerRunFallback = false;
  try {
    composeCmdBase = await dockerUtils.ensureDockerAndCompose();
  } catch (composeErr) {
    if (runDockerFallback.canUseDockerRunWithoutCompose(appConfig, { devMountPath })) {
      await emitAndRunDockerFallback(appName, appConfig, port, {
        debug,
        runEnvPath,
        runOptions,
        misoEnvironment
      });
      usedDockerRunFallback = true;
    } else {
      throw composeErr;
    }
  }

  if (!usedDockerRunFallback) {
    const env = await prepareContainerEnv(debug);
    await executeComposeUp(composeCmdBase, composePath, env, debug);
  }

  await waitForHealthyAndCleanupEnvFiles(appName, port, appConfig, {
    debug,
    runEnvPath,
    runEnvAdminPath,
    runOptions
  });
}

module.exports = { startContainer, prepareContainerEnv, executeComposeUp };
