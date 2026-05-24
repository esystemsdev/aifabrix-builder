/**
 * Template materialization and Docker image pull for `aifabrix setup` modes.
 *
 * @fileoverview Setup image refresh and platform template bootstrap
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const config = require('../core/config');
const pathsUtil = require('../utils/paths');
const logger = require('../utils/logger');
const dockerUtils = require('../utils/docker');
const dockerExec = require('../utils/docker-exec');
const infraHelpers = require('../infrastructure/helpers');
const upCommon = require('./up-common');
const { sectionTitle, formatDatasourceListRow } = require('../utils/cli-test-layout-chalk');
const { startSpinner, stopSpinnerSuccess } = require('./setup-spinners');

const PLATFORM_APPS = ['keycloak', 'miso-controller', 'dataplane'];

/**
 * Pull infra-compose images (postgres, redis, optional pgadmin/redis-commander/traefik).
 *
 * @async
 * @param {{ quiet?: boolean }} [opts]
 * @returns {Promise<void>}
 */
async function pullInfraImages(opts = {}) {
  const quiet = Boolean(opts.quiet);
  const devId = await config.getDeveloperId();
  const infraDir = path.join(pathsUtil.getAifabrixSystemDir(), infraHelpers.getInfraDirName(devId));
  const composePath = path.join(infraDir, 'compose.yaml');
  if (!fs.existsSync(composePath)) {
    if (!quiet) {
      logger.log(chalk.yellow(`No infra compose file at ${composePath}; skipping image pull.`));
    }
    return;
  }
  const project = infraHelpers.getInfraProjectName(devId);
  const composeCmd = await dockerUtils.getComposeCommand();
  if (!quiet) {
    logger.log('');
    logger.log(sectionTitle('Pull images'));
  }
  if (quiet) {
    await dockerExec.execWithDockerEnv(`${composeCmd} -f "${composePath}" -p ${project} pull`, { cwd: infraDir });
    return;
  }
  const spin = startSpinner('Pulling infrastructure images...');
  await dockerExec.execWithDockerEnv(`${composeCmd} -f "${composePath}" -p ${project} pull`, { cwd: infraDir });
  stopSpinnerSuccess(spin, 'Infrastructure images pulled');
}

/**
 * @param {string} appName
 * @returns {string} deploy.image or empty
 */
function readPlatformDeployImageRef(appName) {
  try {
    const { loadConfigFile } = require('../utils/config-format');
    const builderPath = pathsUtil.getBuilderPath(appName);
    const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
    const cfg = loadConfigFile(configPath) || {};
    const image = cfg.deploy && cfg.deploy.image;
    return typeof image === 'string' ? image.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Pull one platform app image from `builder/<app>/application.yaml` deploy.image.
 *
 * @async
 * @param {string} appName
 * @param {{ quiet?: boolean }} [opts]
 * @returns {Promise<boolean>} True when a pull was attempted
 */
async function pullPlatformAppImage(appName, opts = {}) {
  const quiet = Boolean(opts.quiet);
  const imageRef = readPlatformDeployImageRef(appName);
  if (!imageRef) {
    if (!quiet) {
      logger.log(formatDatasourceListRow('skipped', appName, 'no image ref'));
    }
    return false;
  }
  try {
    if (!quiet) {
      const spin = startSpinner(`Pulling ${appName} image...`);
      await dockerExec.execWithDockerEnv(`docker pull ${imageRef}`);
      stopSpinnerSuccess(spin, `Pulled ${appName} image`);
    } else {
      await dockerExec.execWithDockerEnv(`docker pull ${imageRef}`);
    }
  } catch (err) {
    logger.log(chalk.yellow(`Could not pull ${imageRef}: ${err.message}`));
  }
  return true;
}

/**
 * @async
 * @param {{ quiet?: boolean }} [opts]
 * @returns {Promise<number>} Count of images pulled
 */
async function pullPlatformImages(opts = {}) {
  let pulled = 0;
  for (const appName of PLATFORM_APPS) {
    if (await pullPlatformAppImage(appName, opts)) {
      pulled += 1;
    }
  }
  return pulled;
}

/**
 * Materialize platform templates and pull infra + platform images.
 *
 * @async
 * @param {{ quiet?: boolean }} [opts]
 * @returns {Promise<void>}
 */
async function runSetupImageRefresh(opts = {}) {
  const quiet = Boolean(opts.quiet);
  const spin = quiet ? startSpinner('Preparing platform configuration...') : null;
  await upCommon.prepareUrlsLocalRegistryForUpPlatform({ silent: quiet });
  await pullInfraImages({ quiet });
  await pullPlatformImages({ quiet });
  if (quiet) {
    stopSpinnerSuccess(spin, 'Platform configuration ready');
  }
}

module.exports = {
  PLATFORM_APPS,
  pullInfraImages,
  pullPlatformImages,
  runSetupImageRefresh
};
