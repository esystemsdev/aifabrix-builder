/**
 * Derive controller URLs stored in config (default + device token keys).
 *
 * @fileoverview Registered controller URL list for auth --set-controller pick mode
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/**
 * Build sorted unique controller URLs from a config object.
 * @param {Object} cfg - Parsed config.yaml object
 * @param {(url: string) => string} normalizeControllerUrl - normalizer from config module
 * @returns {string[]}
 */
function buildRegisteredControllerUrlList(cfg, normalizeControllerUrl) {
  const seen = new Set();
  const add = (raw) => {
    if (!raw || typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (!/^https?:\/\//i.test(trimmed)) return;
    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
    seen.add(normalizeControllerUrl(trimmed));
  };
  if (cfg.controller) {
    add(cfg.controller);
  }
  for (const key of Object.keys(cfg.device || {})) {
    add(key);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * @param {() => Promise<Object>} getConfig - async config loader
 * @param {(url: string) => string} normalizeControllerUrl
 * @returns {Promise<string[]>}
 */
async function getRegisteredControllerUrlsWithLoader(getConfig, normalizeControllerUrl) {
  const cfg = await getConfig();
  return buildRegisteredControllerUrlList(cfg, normalizeControllerUrl);
}

module.exports = {
  buildRegisteredControllerUrlList,
  getRegisteredControllerUrlsWithLoader
};
