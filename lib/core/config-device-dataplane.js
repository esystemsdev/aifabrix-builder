/**
 * Persist dataplane version metadata under `device.<controllerUrl>` in
 * `~/.aifabrix/config.yaml` for the Builder CLI compatibility gate (plan 142.0).
 *
 * Only public dataplane fields are written here. Token / refresh-token entries
 * on the same device entry are preserved untouched.
 *
 * Schema additions (kebab-case, matching `developer-id` style):
 *   - `dataplane-version`         ← health `version`
 *   - `dataplane-min-cli-version` ← health `minBuilderCliVersion` (omitted when not enforced)
 *   - `dataplane-checked-at`      ← ISO timestamp for cache TTL (default 5 min)
 *
 * @fileoverview Cache dataplane health under existing `device.<controllerUrl>` entry
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { getConfig, saveConfig, normalizeControllerUrl } = require('./config');

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolve the device entry key matching `controllerUrl`, taking URL
 * normalization into account so callers do not need to worry about trailing
 * slashes or scheme differences.
 * @private
 * @param {Object} deviceMap - `config.device` map
 * @param {string} normalizedUrl
 * @returns {string|null} The key under `config.device` or null when missing
 */
function findDeviceKey(deviceMap, normalizedUrl) {
  if (!deviceMap || typeof deviceMap !== 'object') return null;
  if (deviceMap[normalizedUrl]) return normalizedUrl;
  for (const storedUrl of Object.keys(deviceMap)) {
    if (normalizeControllerUrl(storedUrl) === normalizedUrl) {
      return storedUrl;
    }
  }
  return null;
}

/**
 * Read the dataplane cache currently persisted under `device.<controllerUrl>`.
 *
 * @async
 * @param {string} controllerUrl
 * @returns {Promise<{
 *   version?: string,
 *   minBuilderCliVersion?: string,
 *   checkedAt?: string
 * }|null>} The cached snapshot, or null when no entry exists
 * @throws {Error} If controllerUrl is missing
 */
async function getDeviceDataplaneVersions(controllerUrl) {
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    throw new Error('controllerUrl is required and must be a string');
  }
  const config = await getConfig();
  const normalizedUrl = normalizeControllerUrl(controllerUrl);
  const key = findDeviceKey(config.device, normalizedUrl);
  if (!key) return null;
  const entry = config.device[key];
  if (!entry || typeof entry !== 'object') return null;
  const snapshot = {};
  if (typeof entry['dataplane-version'] === 'string') {
    snapshot.version = entry['dataplane-version'];
  }
  if (typeof entry['dataplane-min-cli-version'] === 'string') {
    snapshot.minBuilderCliVersion = entry['dataplane-min-cli-version'];
  }
  if (typeof entry['dataplane-checked-at'] === 'string') {
    snapshot.checkedAt = entry['dataplane-checked-at'];
  }
  if (Object.keys(snapshot).length === 0) return null;
  return snapshot;
}

/**
 * Apply the `dataplane-version` field to a device entry in-place.
 * @private
 * @param {Object} entry
 * @param {string|null|undefined} version
 */
function applyDataplaneVersionField(entry, version) {
  if (typeof version === 'string' && version.trim()) {
    entry['dataplane-version'] = version.trim();
  } else if (version === null || version === '') {
    delete entry['dataplane-version'];
  }
}

/**
 * Apply the `dataplane-min-cli-version` field to a device entry in-place.
 * Treat absent / empty as "no enforcement" → clear the cached floor so an
 * older value never lingers after the operator removes the env variable.
 * @private
 * @param {Object} entry
 * @param {string|null|undefined} minCli
 */
function applyMinCliField(entry, minCli) {
  if (typeof minCli === 'string' && minCli.trim()) {
    entry['dataplane-min-cli-version'] = minCli.trim();
    return;
  }
  if (minCli === null || minCli === '' || minCli === undefined) {
    delete entry['dataplane-min-cli-version'];
  }
}

/**
 * Compute the timestamp persisted as `dataplane-checked-at`.
 * @private
 * @param {string|undefined} checkedAt
 * @returns {string} ISO timestamp
 */
function resolveCheckedAt(checkedAt) {
  if (typeof checkedAt === 'string' && checkedAt.trim()) {
    return checkedAt.trim();
  }
  return new Date().toISOString();
}

/**
 * Persist dataplane version metadata under the device entry for `controllerUrl`.
 *
 * Token / refresh-token entries are preserved; only the `dataplane-*` keys are
 * written. When `versions.minBuilderCliVersion` is empty/undefined the cache
 * key is removed (dataplane does not enforce a minimum).
 *
 * @async
 * @param {string} controllerUrl - Controller URL (will be normalized)
 * @param {{
 *   version?: string,
 *   minBuilderCliVersion?: string|null,
 *   checkedAt?: string
 * }} versions
 * @returns {Promise<void>}
 * @throws {Error} If controllerUrl is missing
 */
async function updateDeviceDataplaneVersions(controllerUrl, versions = {}) {
  if (!controllerUrl || typeof controllerUrl !== 'string') {
    throw new Error('controllerUrl is required and must be a string');
  }
  const config = await getConfig();
  if (!config.device || typeof config.device !== 'object') {
    config.device = {};
  }
  const normalizedUrl = normalizeControllerUrl(controllerUrl);
  const key = findDeviceKey(config.device, normalizedUrl) || normalizedUrl;
  if (!config.device[key] || typeof config.device[key] !== 'object') {
    config.device[key] = {};
  }
  const entry = config.device[key];

  applyDataplaneVersionField(entry, versions.version);
  applyMinCliField(entry, versions.minBuilderCliVersion);
  entry['dataplane-checked-at'] = resolveCheckedAt(versions.checkedAt);

  await saveConfig(config);
}

/**
 * True when the cached snapshot is older than the configured TTL (or missing).
 *
 * @param {{checkedAt?: string}|null} snapshot
 * @param {number} [ttlMs] - TTL in milliseconds (defaults to 5 minutes)
 * @param {Date|number} [now] - Override "now" for tests
 * @returns {boolean}
 */
function isCacheStale(snapshot, ttlMs = DEFAULT_CACHE_TTL_MS, now = Date.now()) {
  if (!snapshot || !snapshot.checkedAt) return true;
  const checkedAtMs = Date.parse(snapshot.checkedAt);
  if (Number.isNaN(checkedAtMs)) return true;
  const reference = typeof now === 'number' ? now : now.getTime();
  return reference - checkedAtMs >= ttlMs;
}

module.exports = {
  getDeviceDataplaneVersions,
  updateDeviceDataplaneVersions,
  isCacheStale,
  DEFAULT_CACHE_TTL_MS
};
