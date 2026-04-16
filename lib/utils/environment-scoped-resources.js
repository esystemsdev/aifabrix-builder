/**
 * Environment-scoped resource naming (shared infra: dev/tst on same Postgres/Redis/Docker).
 * Effective only when user gate AND app flag AND run env is dev|tst.
 *
 * @fileoverview environmentScopedResources + useEnvironmentScopedResources helpers
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * Run/env keys that participate in resource prefixing (not pro).
 * @param {string} envKey - Normalized lowercase env key
 * @returns {boolean}
 */
function isScopedRunEnvironmentKey(envKey) {
  if (!envKey || typeof envKey !== 'string') return false;
  const k = envKey.toLowerCase();
  return k === 'dev' || k === 'tst';
}

/**
 * Effective local/deploy prefix behavior: user gate ∧ app flag ∧ dev|tst.
 *
 * @param {boolean} useEnvironmentScopedResources - ~/.aifabrix/config.yaml
 * @param {boolean} appEnvironmentScopedResources - application.yaml
 * @param {string} runEnvKey - dev | tst | pro | other (lowercase)
 * @returns {boolean}
 */
function computeEffectiveEnvironmentScopedResources(
  useEnvironmentScopedResources,
  appEnvironmentScopedResources,
  runEnvKey
) {
  return (
    Boolean(useEnvironmentScopedResources) &&
    Boolean(appEnvironmentScopedResources) &&
    isScopedRunEnvironmentKey(runEnvKey)
  );
}

/**
 * Redis logical DB index when env-scoped resources are effective.
 * dev → 0, tst → 1 (single shared Redis instance).
 *
 * @param {string} runEnvKey - dev | tst
 * @returns {number|null} Index or null if not applicable
 */
function redisDbIndexForScopedRunEnv(runEnvKey) {
  if (!runEnvKey || typeof runEnvKey !== 'string') return null;
  const k = runEnvKey.toLowerCase();
  if (k === 'dev') return 0;
  if (k === 'tst') return 1;
  return null;
}

/**
 * Docker container name for local `aifabrix run` when env-scoping applies.
 *
 * @param {string} appName - Application key
 * @param {string|number} devId - Developer id
 * @param {number} idNum - Parsed numeric developer id
 * @param {string} envKey - dev | tst
 * @returns {string}
 */
function buildScopedLocalContainerName(appName, devId, idNum, envKey) {
  const e = String(envKey).toLowerCase();
  if (idNum === 0) {
    return `aifabrix-${e}-${appName}`;
  }
  return `aifabrix-dev${devId}-${e}-${appName}`;
}

/**
 * Default local container name (no env scope).
 *
 * @param {string} appName - Application key
 * @param {string|number} devId - Developer id
 * @param {number} idNum - Parsed numeric developer id
 * @returns {string}
 */
function buildDefaultLocalContainerName(appName, devId, idNum) {
  if (idNum === 0) {
    return `aifabrix-${appName}`;
  }
  return `aifabrix-dev${devId}-${appName}`;
}

/**
 * Resolved container name for run/stop/status.
 *
 * @param {string} appName - Application key
 * @param {string|number} developerId - Developer id
 * @param {boolean} effectiveScoped - From {@link computeEffectiveEnvironmentScopedResources}
 * @param {string} [runEnvKey] - dev | tst (required when effectiveScoped)
 * @returns {string}
 */
function resolveRunContainerName(appName, developerId, effectiveScoped, runEnvKey) {
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  if (effectiveScoped && runEnvKey) {
    return buildScopedLocalContainerName(appName, developerId, idNum, runEnvKey);
  }
  return buildDefaultLocalContainerName(appName, developerId, idNum);
}

/**
 * Traefik PathPrefix: prefix /{envKey} before pattern base (e.g. /api → /dev/api).
 *
 * @param {string} basePath - From derivePathFromPattern
 * @param {string} envKey - dev | tst
 * @returns {string}
 */
function buildEnvScopedTraefikPath(basePath, envKey) {
  const e = String(envKey).toLowerCase();
  const trimmed = (basePath || '/').trim() || '/';
  if (trimmed === '/') {
    return `/${e}`;
  }
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `/${e}${withSlash}`.replace(/\/{2,}/g, '/');
}

/**
 * Compose service + Traefik router key when env-scoped (unique per env on shared host).
 *
 * @param {string} appName - Application key
 * @param {string} envKey - dev | tst
 * @returns {string}
 */
function composeTraefikServiceKey(appName, envKey) {
  return `${String(envKey).toLowerCase()}-${appName}`;
}

module.exports = {
  isScopedRunEnvironmentKey,
  computeEffectiveEnvironmentScopedResources,
  redisDbIndexForScopedRunEnv,
  buildScopedLocalContainerName,
  buildDefaultLocalContainerName,
  resolveRunContainerName,
  buildEnvScopedTraefikPath,
  composeTraefikServiceKey
};
