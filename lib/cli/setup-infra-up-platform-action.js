/**
 * `aifabrix up-platform` action body (keeps setup-infra.js under size limits).
 *
 * @fileoverview up-platform CLI action
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { formatProgress } = require('../utils/cli-test-layout-chalk');
const { handleCommandError, isAuthenticationError } = require('../utils/cli-utils');
const { resolveControllerUrl } = require('../utils/controller-url');
const { handleLogin } = require('../commands/login');
const { handleUpMiso } = require('../commands/up-miso');
const { handleUpDataplane } = require('../commands/up-dataplane');
const {
  applyUpPlatformForceConfig,
  cleanBuilderAppDirs,
  prepareUrlsLocalRegistryForUpPlatform
} = require('../commands/up-common');
const { runGuidedUpPlatform } = require('./infra-guided');
const { recordInfraInstallationCommand } = require('./installation-log-command');

const PLATFORM_APPS = ['keycloak', 'miso-controller', 'dataplane'];

/**
 * @param {Object} options
 * @returns {Promise<string[]>}
 */
async function runUpPlatformWork(options) {
  let cleanedAppKeys = [];
  let platformForceCleanSummary = null;
  if (options.force) {
    const forceSummary = await applyUpPlatformForceConfig({ silent: !options.verbose });
    const cleanedApps = await cleanBuilderAppDirs(PLATFORM_APPS, {
      silent: !options.verbose
    });
    cleanedAppKeys = Array.isArray(cleanedApps) ? cleanedApps : [];
    if (!options.verbose) {
      platformForceCleanSummary = { forceSummary, cleanedApps: cleanedAppKeys };
    }
  }

  if (!options.verbose) {
    await runGuidedUpPlatform(
      options,
      handleUpMiso,
      handleUpDataplane,
      handleLogin,
      platformForceCleanSummary
    );
  } else {
    await prepareUrlsLocalRegistryForUpPlatform();
    await handleUpMiso(options);
    await handleUpDataplane(options);
  }
  return cleanedAppKeys;
}

/**
 * @param {Object} params
 * @returns {Promise<void>}
 */
async function logUpPlatformOutcome(params) {
  const { options, startedAt, outcome, error, cleanedAppKeys } = params;
  await recordInfraInstallationCommand({
    command: 'up-platform',
    options,
    startedAt,
    outcome,
    error,
    platformAppList: PLATFORM_APPS,
    cleanup: cleanedAppKeys.length > 0 ? { cleanedAppKeys } : undefined,
    upPlatformForce: options.force === true
  });
}

async function maybeHandleUpPlatformAuthRetry(error, options) {
  if (!isAuthenticationError(error)) {
    return false;
  }
  const controllerUrl = error.controllerUrl || await resolveControllerUrl();
  if (!options.verbose) {
    logger.log(formatProgress('Authenticating...'));
  } else {
    logger.log(chalk.blue('\nAuthentication required. Running aifabrix login...\n'));
  }
  await handleLogin({ method: 'device', controller: controllerUrl, compact: !options.verbose });
  await handleUpDataplane(options);
  return true;
}

/**
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function handleUpPlatformCliAction(options) {
  const startedAt = new Date();
  let cleanedAppKeys = [];
  try {
    cleanedAppKeys = await runUpPlatformWork(options);
    await logUpPlatformOutcome({ options, startedAt, outcome: 'success', cleanedAppKeys });
  } catch (error) {
    try {
      if (await maybeHandleUpPlatformAuthRetry(error, options)) {
        await logUpPlatformOutcome({ options, startedAt, outcome: 'success', cleanedAppKeys });
        return;
      }
    } catch (loginOrRetryError) {
      await logUpPlatformOutcome({
        options,
        startedAt,
        outcome: 'failure',
        error: loginOrRetryError,
        cleanedAppKeys
      });
      handleCommandError(loginOrRetryError, 'up-platform');
      process.exit(1);
    }
    await logUpPlatformOutcome({ options, startedAt, outcome: 'failure', error, cleanedAppKeys });
    handleCommandError(error, 'up-platform');
    process.exit(1);
  }
}

module.exports = {
  handleUpPlatformCliAction
};
