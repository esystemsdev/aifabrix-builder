/**
 * Auth-status dataplane version refresh + compatibility resolution (plan 142.0).
 *
 * Extracted from `auth-status.js` to keep that file under the 500-line limit
 * (`.cursor/rules/project-rules.mdc → File and Function Size Limits`). The
 * helpers here are pure-ish (only depend on the dataplane health API and the
 * `device.<controllerUrl>` cache module) so they are easy to mock in unit
 * tests.
 *
 * @fileoverview Resolve dataplane version + Builder CLI compatibility for auth status
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { fetchDataplaneGeneralHealth } = require('../api/dataplane-health.api');
const {
  updateDeviceDataplaneVersions,
  getDeviceDataplaneVersions
} = require('../core/config-device-dataplane');
const {
  getInstalledCliVersion
} = require('../utils/dataplane-cli-version-gate');
const { isAtLeast, isValidSemver } = require('../utils/semver-compare');

/**
 * Per plan 142.0: invalid semver from the dataplane is logged but does **not**
 * block the CLI; missing min version means no enforcement.
 *
 * @param {string} cliVersion
 * @param {string|undefined} minBuilderCliVersion
 * @returns {boolean}
 */
function computeCompatibility(cliVersion, minBuilderCliVersion) {
  if (!minBuilderCliVersion) return true;
  if (!isValidSemver(minBuilderCliVersion) || !isValidSemver(cliVersion)) {
    return true;
  }
  return isAtLeast(cliVersion, minBuilderCliVersion);
}

/**
 * Read `device.<controllerUrl>` cache without throwing.
 * @private
 * @async
 * @param {string} controllerUrl
 * @returns {Promise<Object|null>}
 */
async function safeReadCache(controllerUrl) {
  if (!controllerUrl) return null;
  try {
    return await getDeviceDataplaneVersions(controllerUrl);
  } catch (_error) {
    return null;
  }
}

/**
 * Refresh dataplane health, persist `device.<controllerUrl>` version cache,
 * and derive the compatibility verdict against the installed Builder CLI.
 * Falls back to the cached entry when the live probe fails so `auth status`
 * still shows the last-known values offline.
 *
 * @async
 * @param {string} controllerUrl - Controller URL (cache key)
 * @param {string} dataplaneUrl - Dataplane base URL for the health probe
 * @returns {Promise<{
 *   dataplaneVersion: string|undefined,
 *   minBuilderCliVersion: string|undefined,
 *   cliVersion: string,
 *   compatible: boolean
 * }>}
 */
async function refreshDataplaneVersionInfo(controllerUrl, dataplaneUrl) {
  const cliVersion = getInstalledCliVersion();
  let dataplaneVersion;
  let minBuilderCliVersion;

  try {
    const snapshot = await fetchDataplaneGeneralHealth(dataplaneUrl);
    if (snapshot) {
      dataplaneVersion = snapshot.version;
      minBuilderCliVersion = snapshot.minBuilderCliVersion;
      try {
        await updateDeviceDataplaneVersions(controllerUrl, {
          version: dataplaneVersion,
          minBuilderCliVersion: minBuilderCliVersion || null
        });
      } catch (_persistError) {
        // cache write failure must not break the display
      }
    }
  } catch (_fetchError) {
    // ignore — fall through to cached values
  }

  if (!dataplaneVersion && !minBuilderCliVersion) {
    const cached = await safeReadCache(controllerUrl);
    if (cached) {
      dataplaneVersion = cached.version;
      minBuilderCliVersion = cached.minBuilderCliVersion;
    }
  }

  const compatible = computeCompatibility(cliVersion, minBuilderCliVersion);
  return { dataplaneVersion, minBuilderCliVersion, cliVersion, compatible };
}

/**
 * Load cached versions only (no live probe). Used when the dataplane is
 * unreachable so `auth status` can still surface a known compatibility floor.
 *
 * @async
 * @param {string} controllerUrl
 * @returns {Promise<{
 *   dataplaneVersion: string|undefined,
 *   minBuilderCliVersion: string|undefined,
 *   cliVersion: string,
 *   compatible: boolean
 * }>}
 */
async function loadCachedVersionInfo(controllerUrl) {
  const cliVersion = getInstalledCliVersion();
  const cached = await safeReadCache(controllerUrl);
  const dataplaneVersion = cached ? cached.version : undefined;
  const minBuilderCliVersion = cached ? cached.minBuilderCliVersion : undefined;
  return {
    dataplaneVersion,
    minBuilderCliVersion,
    cliVersion,
    compatible: computeCompatibility(cliVersion, minBuilderCliVersion)
  };
}

/**
 * Resolve bearer auth after login (device token preferred, else client app token).
 * @private
 * @async
 * @param {string} controllerUrl
 * @param {string} environment
 * @param {Object} loginOptions
 * @returns {Promise<Object|null>}
 */
async function resolveAuthConfigAfterLogin(controllerUrl, environment, loginOptions) {
  const { getOrRefreshDeviceToken, getDeploymentAuth } = require('../utils/token-manager');
  const device = await getOrRefreshDeviceToken(controllerUrl);
  if (device && device.token) {
    return { type: 'bearer', token: device.token };
  }
  if (!loginOptions.app) {
    return null;
  }
  try {
    return await getDeploymentAuth(controllerUrl, environment, loginOptions.app);
  } catch (_authError) {
    return null;
  }
}

/**
 * Resolve dataplane URL after login (mirrors auth-status silent resolver).
 * @private
 * @async
 * @param {string} controllerUrl
 * @param {string} environment
 * @param {Object} authConfig
 * @returns {Promise<string|null>}
 */
async function resolveDataplaneUrlAfterLogin(controllerUrl, environment, authConfig) {
  const { findDataplaneServiceAppKey } = require('./wizard-dataplane');
  const { getDataplaneUrl } = require('../datasource/deploy');
  try {
    const dataplaneAppKey = await findDataplaneServiceAppKey(
      controllerUrl,
      environment,
      authConfig
    );
    if (dataplaneAppKey) {
      return await getDataplaneUrl(controllerUrl, dataplaneAppKey, environment, authConfig);
    }
    return await getDataplaneUrl(controllerUrl, 'dataplane', environment, authConfig);
  } catch (_resolveError) {
    return null;
  }
}

/**
 * Best-effort health refresh after login when dataplane URL is discoverable.
 * Never throws — cache failures must not block login success.
 *
 * @async
 * @param {string} controllerUrl - Controller URL (device cache key)
 * @param {Object} [loginOptions]
 * @param {string} [loginOptions.app] - App name (credentials login) for client-token auth
 * @returns {Promise<void>}
 */
async function tryRefreshDataplaneVersionAfterLogin(controllerUrl, loginOptions = {}) {
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    return;
  }
  try {
    const { resolveEnvironment } = require('../core/config');
    const environment = await resolveEnvironment();
    const authConfig = await resolveAuthConfigAfterLogin(
      controllerUrl,
      environment,
      loginOptions
    );
    if (!authConfig) {
      return;
    }
    const dataplaneUrl = await resolveDataplaneUrlAfterLogin(
      controllerUrl,
      environment,
      authConfig
    );
    if (dataplaneUrl) {
      await refreshDataplaneVersionInfo(controllerUrl, dataplaneUrl);
    }
  } catch (_error) {
    // best-effort only
  }
}

module.exports = {
  refreshDataplaneVersionInfo,
  loadCachedVersionInfo,
  computeCompatibility,
  tryRefreshDataplaneVersionAfterLogin
};
