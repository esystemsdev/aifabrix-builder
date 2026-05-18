/**
 * Builder CLI ↔ dataplane version gate (plan 142.0).
 *
 * Resolves the dataplane-advertised `minBuilderCliVersion` (from cache or a
 * fresh health probe) and compares it against the installed Builder CLI
 * version. Used at the top of dataplane API entrypoints so an outdated CLI
 * cannot mutate dataplane state silently.
 *
 * Local-only commands (validate, run, up-infra, file generation) do **not**
 * call into this module; the gate is intentionally per-call, not global.
 *
 * @fileoverview Compatibility gate for dataplane API entrypoints
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { fetchDataplaneGeneralHealth } = require('../api/dataplane-health.api');
const {
  getDeviceDataplaneVersions,
  updateDeviceDataplaneVersions,
  isCacheStale
} = require('../core/config-device-dataplane');
const { compareSemver, isValidSemver } = require('./semver-compare');
const { formatCliVersionGateError } = require('./dataplane-cli-version-help');

/**
 * Get the installed Builder CLI version from `package.json`.
 * Centralized so tests can stub it via Jest module mocks.
 * @returns {string}
 */
function getInstalledCliVersion() {
  return require('../../package.json').version;
}

/**
 * Internal sentinel error code so callers can distinguish gate failures from
 * generic dataplane errors when needed.
 * @type {string}
 */
const ERROR_CODE = 'CLI_VERSION_INCOMPATIBLE';

/**
 * True when `err` was thrown by this gate.
 * @param {*} err
 * @returns {boolean}
 */
function isCliVersionIncompatibleError(err) {
  return Boolean(err && err.code === ERROR_CODE);
}

/**
 * Resolve the dataplane minimum Builder CLI version, preferring cached value
 * when fresh; otherwise probe health and persist a new snapshot under
 * `device.<controllerUrl>`.
 *
 * @private
 * @async
 * @param {string} controllerUrl
 * @param {string} dataplaneUrl
 * @param {{ forceRefresh?: boolean }} [options]
 * @returns {Promise<{ minBuilderCliVersion?: string, dataplaneVersion?: string }>}
 */
async function resolveMinBuilderCliVersion(controllerUrl, dataplaneUrl, options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);
  if (!forceRefresh) {
    const cached = await safeReadCache(controllerUrl);
    if (cached && !isCacheStale(cached)) {
      return {
        minBuilderCliVersion: cached.minBuilderCliVersion,
        dataplaneVersion: cached.version
      };
    }
  }

  const snapshot = await safeFetch(dataplaneUrl);
  if (!snapshot) {
    // Cannot reach dataplane → do not gate (offline / pre-rollout). Reuse
    // any cached value we may have.
    const cached = await safeReadCache(controllerUrl);
    return {
      minBuilderCliVersion: cached ? cached.minBuilderCliVersion : undefined,
      dataplaneVersion: cached ? cached.version : undefined
    };
  }

  await safeWriteCache(controllerUrl, {
    version: snapshot.version,
    minBuilderCliVersion: snapshot.minBuilderCliVersion || null
  });
  return {
    minBuilderCliVersion: snapshot.minBuilderCliVersion,
    dataplaneVersion: snapshot.version
  };
}

/**
 * Read cached versions without throwing — gate failures should not mask real
 * dataplane errors caused by config corruption.
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
 * Fetch health swallowing transport errors so callers can decide what to do
 * when the dataplane is unreachable.
 * @private
 * @async
 * @param {string} dataplaneUrl
 * @returns {Promise<Object|null>}
 */
async function safeFetch(dataplaneUrl) {
  try {
    return await fetchDataplaneGeneralHealth(dataplaneUrl);
  } catch (_error) {
    return null;
  }
}

/**
 * Write the cache without throwing — best-effort persistence.
 * @private
 * @async
 * @param {string} controllerUrl
 * @param {Object} versions
 * @returns {Promise<void>}
 */
async function safeWriteCache(controllerUrl, versions) {
  if (!controllerUrl) return;
  try {
    await updateDeviceDataplaneVersions(controllerUrl, versions);
  } catch (_error) {
    // intentionally swallowed — cache write failure must not block the call
  }
}

/**
 * Throw when the installed CLI is older than the dataplane minimum.
 *
 * No-op when:
 *   - `dataplaneUrl` is empty (no dataplane in play)
 *   - Dataplane omits `minBuilderCliVersion` (no enforcement)
 *   - Dataplane is unreachable and no cached minimum is known
 *   - Cached/advertised minimum is not valid semver (warn-only contract per plan)
 *
 * @async
 * @param {string} dataplaneUrl - Dataplane base URL (e.g. `http://localhost:3201`)
 * @param {Object} [options]
 * @param {string} [options.controllerUrl] - Controller URL for cache lookup/write
 * @param {boolean} [options.forceRefresh] - Skip cache and probe health now
 * @returns {Promise<void>}
 * @throws {Error & { code: 'CLI_VERSION_INCOMPATIBLE', required: string, installed: string, formatted: string }}
 */
async function assertDataplaneCliVersionCompatible(dataplaneUrl, options = {}) {
  if (!dataplaneUrl || typeof dataplaneUrl !== 'string') {
    return;
  }
  const { minBuilderCliVersion } = await resolveMinBuilderCliVersion(
    options.controllerUrl || null,
    dataplaneUrl,
    { forceRefresh: Boolean(options.forceRefresh) }
  );
  if (!minBuilderCliVersion) return;
  if (!isValidSemver(minBuilderCliVersion)) return;

  // Go through module.exports so tests can stub `getInstalledCliVersion`.
  const installed = module.exports.getInstalledCliVersion();
  if (!isValidSemver(installed)) return;

  if (compareSemver(installed, minBuilderCliVersion) >= 0) {
    return;
  }

  const formatted = formatCliVersionGateError(minBuilderCliVersion, installed);
  const error = new Error(
    `Builder CLI ${installed} is below the dataplane minimum (${minBuilderCliVersion}). ` +
    'Upgrade with: npm install -g @aifabrix/builder@latest'
  );
  error.code = ERROR_CODE;
  error.required = minBuilderCliVersion;
  error.installed = installed;
  error.formatted = formatted;
  throw error;
}

module.exports = {
  assertDataplaneCliVersionCompatible,
  isCliVersionIncompatibleError,
  getInstalledCliVersion,
  ERROR_CODE
};
