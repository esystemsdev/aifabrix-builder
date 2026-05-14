/**
 * `aifabrix up-dataplane` action body (keeps setup-infra.js under size limits).
 *
 * @fileoverview up-dataplane CLI action
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
const { handleUpDataplane } = require('../commands/up-dataplane');
const { cleanBuilderAppDirs } = require('../commands/up-common');
const { runGuidedUpDataplane } = require('./infra-guided');
const { recordInfraInstallationCommand } = require('./installation-log-command');

/**
 * @param {Object} options
 * @returns {Promise<string[]>}
 */
async function runUpDataplaneWork(options) {
  let cleanedAppKeys = [];
  if (options.force) {
    const c = await cleanBuilderAppDirs(['dataplane']);
    cleanedAppKeys = Array.isArray(c) ? c : [];
  }
  if (!options.verbose) {
    await runGuidedUpDataplane(options, handleUpDataplane);
  } else {
    await handleUpDataplane(options);
  }
  return cleanedAppKeys;
}

/**
 * @param {Object} params
 * @returns {Promise<void>}
 */
async function logDataplaneOutcome(params) {
  const { options, startedAt, outcome, error, cleanedAppKeys } = params;
  await recordInfraInstallationCommand({
    command: 'up-dataplane',
    options,
    startedAt,
    outcome,
    error,
    platformAppList: ['dataplane'],
    cleanup: cleanedAppKeys.length > 0 ? { cleanedAppKeys } : undefined
  });
}

/**
 * @param {Object} options
 * @param {Date} startedAt
 * @param {string[]} cleanedAppKeys
 * @param {string} controllerUrl
 * @returns {Promise<void>}
 */
async function runDataplaneAuthRecovery(options, startedAt, cleanedAppKeys, controllerUrl) {
  if (!options.verbose) {
    logger.log(formatProgress('Authenticating...'));
  } else {
    logger.log(chalk.blue('\nAuthentication required. Running aifabrix login...\n'));
  }
  await handleLogin({ method: 'device', controller: controllerUrl, compact: !options.verbose });
  await handleUpDataplane(options);
  await logDataplaneOutcome({ options, startedAt, outcome: 'success', cleanedAppKeys });
}

/**
 * @param {Object} options
 * @returns {Promise<void>}
 */
async function handleUpDataplaneCliAction(options) {
  const startedAt = new Date();
  let cleanedAppKeys = [];
  try {
    cleanedAppKeys = await runUpDataplaneWork(options);
    await logDataplaneOutcome({ options, startedAt, outcome: 'success', cleanedAppKeys });
  } catch (error) {
    if (isAuthenticationError(error)) {
      const controllerUrl = error.controllerUrl || await resolveControllerUrl();
      try {
        await runDataplaneAuthRecovery(options, startedAt, cleanedAppKeys, controllerUrl);
        return;
      } catch (loginOrRetryError) {
        await logDataplaneOutcome({
          options,
          startedAt,
          outcome: 'failure',
          error: loginOrRetryError,
          cleanedAppKeys
        });
        handleCommandError(loginOrRetryError, 'up-dataplane');
        process.exit(1);
      }
    }
    await logDataplaneOutcome({ options, startedAt, outcome: 'failure', error, cleanedAppKeys });
    handleCommandError(error, 'up-dataplane');
    process.exit(1);
  }
}

module.exports = {
  handleUpDataplaneCliAction
};
