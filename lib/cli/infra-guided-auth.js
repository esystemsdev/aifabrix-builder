/**
 * Guided platform install authentication (device login URL + Dataplane recovery).
 *
 * @fileoverview Auth helpers for infra-guided up-platform / setup
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const config = require('../core/config');
const { resolvePlatformControllerUrl } = require('../utils/platform-controller-url');
const { withMutedLogger } = require('../utils/with-muted-logger');
const { formatBlockingError } = require('../utils/cli-test-layout-chalk');
const { isAuthenticationError } = require('../utils/cli-utils');
const { resolveControllerUrl, isPlatformAuthValidForController } = require('../utils/controller-url');

/**
 * @param {Object} authOpts
 * @returns {Promise<string>}
 */
async function resolveGuidedAuthControllerUrl(authOpts = {}) {
  return (
    authOpts.platformControllerUrl ||
    (await config.getPlatformControllerUrl()) ||
    (await resolvePlatformControllerUrl())
  );
}

/**
 * @async
 * @param {Function} handleLoginFn
 * @param {string} controllerUrl
 * @param {{ skipDataplaneVersionRefresh?: boolean }} [opts]
 * @returns {Promise<void>}
 */
async function runGuidedDeviceLogin(handleLoginFn, controllerUrl, opts = {}) {
  await handleLoginFn({
    method: 'device',
    controller: controllerUrl,
    environment: 'dev',
    compact: true,
    skipDataplaneVersionRefresh: opts.skipDataplaneVersionRefresh === true,
    exitOnFailure: false
  });
}

/**
 * @async
 * @param {Function} handleLoginFn
 * @param {Object} authOpts
 * @param {{ startSpinner: Function, stopSpinnerSuccess: Function }} spinners
 * @returns {Promise<void>}
 */
async function runGuidedAuthStep(handleLoginFn, authOpts, spinners) {
  const spin = spinners.startSpinner('Authenticating...');
  const controllerUrl = await resolveGuidedAuthControllerUrl(authOpts);
  const skipLogin =
    authOpts.skipLoginIfAuthenticated === true ||
    (await isPlatformAuthValidForController(controllerUrl));
  try {
    if (skipLogin) {
      spinners.stopSpinnerSuccess(spin, 'Already authenticated');
      return;
    }
    await runGuidedDeviceLogin(handleLoginFn, controllerUrl, { skipDataplaneVersionRefresh: true });
  } catch (authErr) {
    if (spin) spin.fail('Authentication required');
    logger.error(formatBlockingError('Authentication required. Complete sign-in in your browser.'));
    await runGuidedDeviceLogin(handleLoginFn, controllerUrl, { skipDataplaneVersionRefresh: true });
  }
  spinners.stopSpinnerSuccess(spin, 'Authenticated');
}

/**
 * @async
 * @param {Object} options
 * @param {Function} handleUpDataplane
 * @param {Function} handleLoginFn
 * @param {string} controllerUrl
 * @returns {Promise<void>}
 */
async function runGuidedDataplaneWithAuthRecovery(options, handleUpDataplane, handleLoginFn, controllerUrl) {
  try {
    await withMutedLogger(() =>
      handleUpDataplane({ ...options, platformInstall: true, skipInfraCheck: true })
    );
  } catch (error) {
    if (!isAuthenticationError(error)) {
      throw error;
    }
    const loginUrl = error.controllerUrl || controllerUrl || (await resolveControllerUrl());
    logger.log('');
    logger.log(chalk.yellow('Device login required to register and deploy Dataplane.'));
    await runGuidedDeviceLogin(handleLoginFn, loginUrl, { skipDataplaneVersionRefresh: false });
    await withMutedLogger(() =>
      handleUpDataplane({ ...options, platformInstall: true, skipInfraCheck: true })
    );
  }
}

module.exports = {
  resolveGuidedAuthControllerUrl,
  runGuidedDeviceLogin,
  runGuidedAuthStep,
  runGuidedDataplaneWithAuthRecovery
};
