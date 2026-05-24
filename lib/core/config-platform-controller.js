/**
 * `platform-controller` field in `config.yaml` — absolute Miso URL for setup / platform flows.
 *
 * @fileoverview config.yaml platform-controller helpers
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {() => Promise<Object>} getConfig
 * @returns {Promise<string|null>}
 */
async function getPlatformControllerUrlFromConfig(getConfig) {
  const cfg = await getConfig();
  const raw = cfg && cfg['platform-controller'];
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().replace(/\/+$/, '');
  }
  return null;
}

/**
 * @param {() => Promise<Object>} getConfig
 * @param {(data: Object) => Promise<void>} saveConfig
 * @param {(url: string) => string} normalizeControllerUrl
 * @param {string} url
 * @returns {Promise<void>}
 */
async function setPlatformControllerUrlInConfig(getConfig, saveConfig, normalizeControllerUrl, url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Platform controller URL is required and must be a string');
  }
  const normalized = normalizeControllerUrl(url);
  const cfg = await getConfig();
  cfg['platform-controller'] = normalized;
  await saveConfig(cfg);
}

module.exports = {
  getPlatformControllerUrlFromConfig,
  setPlatformControllerUrlInConfig
};
