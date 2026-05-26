/**
 * Controller URL Resolution Utilities
 *
 * Provides utilities for resolving controller URLs with developer ID-based defaults
 * and fallback chain support.
 *
 * @fileoverview Controller URL resolution utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getDeveloperIdNumber } = require('./env-map');
const devConfig = require('./dev-config');
const config = require('../core/config');
const { getDeviceToken, isTokenExpired } = require('./token-manager');

/**
 * Calculate default controller URL based on developer ID
 * Uses getDevPorts to get the app port which is adjusted by developer ID
 * Developer ID 0 = http://localhost:3000
 * Developer ID 1 = http://localhost:3100
 * Developer ID 2 = http://localhost:3200
 * @async
 * @function getDefaultControllerUrl
 * @returns {Promise<string>} Default controller URL
 */
async function getDefaultControllerUrl() {
  const developerId = await getDeveloperIdNumber(null);
  const ports = devConfig.getDevPorts(developerId);
  return `http://localhost:${ports.app}`;
}

/**
 * Normalize controller URL (remove trailing slashes)
 * @param {string} url - Controller URL to normalize
 * @returns {string} Normalized controller URL
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  return url.trim().replace(/\/+$/, '');
}
/**
 * True when `config.yaml` has a non-expired-looking device entry for this controller URL
 * (normalized host/path comparison).
 *
 * @async
 * @param {string} controllerUrl
 * @returns {Promise<boolean>}
 */
async function hasStoredDeviceTokenForController(controllerUrl) {
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    return false;
  }
  const want = normalizeUrl(controllerUrl);
  if (!want) {
    return false;
  }
  try {
    const userConfig = await config.getConfig();
    if (!userConfig.device || typeof userConfig.device !== 'object') {
      return false;
    }
    return Object.keys(userConfig.device).some((key) => normalizeUrl(key) === want);
  } catch {
    return false;
  }
}

/**
 * True when a stored, non-expired device token exists (local config only — no refresh HTTP).
 * Setup uses this to decide whether to skip the device-login step; avoids refresh warnings
 * when the controller is not up yet or `device:` is empty.
 *
 * @async
 * @param {string} controllerUrl
 * @returns {Promise<boolean>}
 */
async function isDeviceTokenUsableForController(controllerUrl) {
  if (!(await hasStoredDeviceTokenForController(controllerUrl))) {
    return false;
  }
  const want = normalizeUrl(controllerUrl);
  try {
    const tokenInfo = await getDeviceToken(want);
    return Boolean(tokenInfo && tokenInfo.token && !isTokenExpired(tokenInfo.expiresAt));
  } catch {
    return false;
  }
}

/**
 * True when a stored device token can be refreshed (if needed) and validated against the controller API.
 * Prefer this after the controller is reachable (guided platform auth step). Falls back to local expiry-only
 * check when the controller is not reachable yet.
 *
 * @async
 * @param {string} controllerUrl
 * @returns {Promise<boolean>}
 */
async function isPlatformAuthValidForController(controllerUrl) {
  if (!(await hasStoredDeviceTokenForController(controllerUrl))) {
    return false;
  }
  const want = normalizeUrl(controllerUrl);

  if (!(await isControllerHealthReachable(want))) {
    return isDeviceTokenUsableForController(controllerUrl);
  }

  const { getOrRefreshDeviceToken } = require('./token-manager');
  const { getAuthUser } = require('../api/auth.api');

  let tokenResult = null;
  try {
    tokenResult = await getOrRefreshDeviceToken(want);
  } catch {
    tokenResult = null;
  }

  if (!tokenResult || !tokenResult.token) {
    return false;
  }

  try {
    const response = await getAuthUser(want, { type: 'bearer', token: tokenResult.token });
    return Boolean(response.success && response.data && response.data.authenticated !== false);
  } catch {
    return false;
  }
}

/**
 * Best-effort GET /health on the controller (no auth). Used to avoid token refresh HTTP
 * during setup before Miso Controller is running.
 *
 * @async
 * @param {string} controllerUrl
 * @returns {Promise<boolean>}
 */
async function isControllerHealthReachable(controllerUrl) {
  const base = normalizeUrl(controllerUrl);
  if (!base) {
    return false;
  }
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get controller URL from logged-in user's device tokens.
 * Prefers the entry under {@link config.controller} when it matches a `device` key; otherwise a
 * single `device` entry; with multiple unrelated entries and no matching default, returns **null**
 * (callers must not treat arbitrary key order as the active controller).
 *
 * @async
 * @function getControllerUrlFromLoggedInUser
 * @returns {Promise<string|null>} Controller URL from logged-in user, or null if not found
 */
async function getControllerUrlFromLoggedInUser() {
  try {
    const userConfig = await config.getConfig();
    if (!userConfig.device || typeof userConfig.device !== 'object') {
      return null;
    }

    const deviceUrls = Object.keys(userConfig.device);
    if (deviceUrls.length === 0) {
      return null;
    }

    const cfgController =
      userConfig.controller && typeof userConfig.controller === 'string'
        ? normalizeUrl(userConfig.controller)
        : '';
    if (cfgController) {
      const match = deviceUrls.find((u) => normalizeUrl(u) === cfgController);
      if (match) {
        return normalizeUrl(match);
      }
    }

    if (deviceUrls.length === 1) {
      return normalizeUrl(deviceUrls[0]);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get controller URL from config.yaml
 * @async
 * @function getControllerFromConfig
 * @returns {Promise<string|null>} Controller URL from config or null
 */
async function getControllerFromConfig() {
  const { getControllerUrl } = require('../core/config');
  return await getControllerUrl();
}

/**
 * Resolve controller URL with fallback chain
 * Priority:
 * 1. config.controller (from config.yaml)
 * 2. getControllerUrlFromLoggedInUser() (from logged-in device tokens)
 * 3. getDefaultControllerUrl() (developer ID-based default)
 * @async
 * @function resolveControllerUrl
 * @returns {Promise<string>} Resolved controller URL
 */
async function resolveControllerUrl() {
  // Priority 1: config.controller (from config.yaml)
  const configController = await getControllerFromConfig();
  if (configController) {
    return configController.replace(/\/+$/, '');
  }

  // Priority 2: Logged-in user's device tokens
  const loggedInControllerUrl = await getControllerUrlFromLoggedInUser();
  if (loggedInControllerUrl) {
    return loggedInControllerUrl;
  }

  // Priority 3: Developer ID-based default
  return await getDefaultControllerUrl();
}

module.exports = {
  getDefaultControllerUrl,
  hasStoredDeviceTokenForController,
  isDeviceTokenUsableForController,
  isPlatformAuthValidForController,
  isControllerHealthReachable,
  getControllerUrlFromLoggedInUser,
  getControllerFromConfig,
  resolveControllerUrl
};
