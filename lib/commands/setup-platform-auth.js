/**
 * Session-aware platform controller URL + auth for `aifabrix setup`.
 *
 * @fileoverview Setup platform-controller persistence and login gate
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const config = require('../core/config');
const upCommon = require('./up-common');
const { resolvePlatformControllerUrl } = require('../utils/platform-controller-url');
const { isPlatformAuthValidForController } = require('../utils/controller-url');
const { infoLine } = require('../utils/cli-test-layout-chalk');
const logger = require('../utils/logger');

/**
 * Recompute `controller` and `platform-controller` from traefik / setupPlatformMode / front-door config.
 * Call after setup changes platform topology (fresh install, re-install, wipe-data) so a prior
 * full-platform URL (e.g. `http://localhost:3600/miso`) is not reused in single mode.
 *
 * @async
 * @returns {Promise<string>} Normalized platform controller URL
 */
async function syncPlatformControllerUrlsInConfig() {
  const platformControllerUrl = await resolvePlatformControllerUrl();
  await config.setPlatformControllerUrl(platformControllerUrl);
  await config.setControllerUrl(platformControllerUrl);
  return platformControllerUrl;
}

/**
 * Resolve absolute platform controller URL, persist `platform-controller` and `controller`,
 * and optionally apply `up-platform --force` config (token clear only when not logged in).
 *
 * @async
 * @param {{ applyForceConfig?: boolean, clearTokensAlways?: boolean }} [opts]
 * @returns {Promise<{
 *   platformControllerUrl: string,
 *   skipLoginIfAuthenticated: boolean,
 *   forceSummary: object|null
 * }>}
 */
async function ensureSetupPlatformAuth(opts = {}) {
  const platformControllerUrl = await syncPlatformControllerUrlsInConfig();

  let forceSummary = null;
  let skipLoginIfAuthenticated = await isPlatformAuthValidForController(platformControllerUrl);
  const clearTokensAlways = opts.clearTokensAlways === true;
  if (opts.applyForceConfig === true) {
    forceSummary = await upCommon.applyUpPlatformForceConfig({
      silent: true,
      clearTokens: clearTokensAlways || !skipLoginIfAuthenticated,
      defaultControllerUrl: platformControllerUrl
    });
    if (clearTokensAlways || (forceSummary && forceSummary.deviceCleared > 0)) {
      skipLoginIfAuthenticated = false;
    }
  }

  if (skipLoginIfAuthenticated) {
    logger.log(infoLine(`Already authenticated to ${platformControllerUrl}`));
  }

  return {
    platformControllerUrl,
    skipLoginIfAuthenticated,
    forceSummary
  };
}

module.exports = {
  syncPlatformControllerUrlsInConfig,
  ensureSetupPlatformAuth
};
