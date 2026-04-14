/**
 * Canonical env defaults for docker/local interpolation (formerly lib/schema/env-config.yaml).
 *
 * @fileoverview Infra-only vs app-service layers merged for backward compatibility.
 *   True infra: DB, Redis, runtime. App rows (MISO_*, DATAPLANE_*, …) are a separate object
 *   so policy and future YAML-only sourcing stay clear — see APP_SERVICE_ENV_DEFAULTS.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { buildAppServiceEnvOverlay } = require('./app-service-env-from-builder');

/**
 * @param {string|null|undefined} projectRoot
 * @returns {string}
 */
function resolveProjectRootForEnvDefaults(projectRoot) {
  if (projectRoot !== undefined && projectRoot !== null) {
    return projectRoot;
  }
  try {
    const { getProjectRoot } = require('./paths');
    if (typeof getProjectRoot === 'function') {
      return getProjectRoot();
    }
  } catch {
    // ignore
  }
  return process.cwd();
}

/** Docker profile: databases, cache, process env only (no application services). */
const INFRA_ENV_DEFAULTS_DOCKER = Object.freeze({
  DB_HOST: 'postgres',
  DB_PORT: 5432,
  REDIS_HOST: 'redis',
  REDIS_PORT: 6379,
  NODE_ENV: 'production',
  PYTHONUNBUFFERED: 1,
  PYTHONDONTWRITEBYTECODE: 1,
  PYTHONIOENCODING: 'utf-8'
});

/** Local profile: same infra shape as docker with localhost hosts. */
const INFRA_ENV_DEFAULTS_LOCAL = Object.freeze({
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  NODE_ENV: 'development',
  PYTHONUNBUFFERED: 1,
  PYTHONDONTWRITEBYTECODE: 1,
  PYTHONIOENCODING: 'utf-8'
});

/**
 * Default *_HOST / *_PORT / *_PUBLIC_PORT for known stack apps.
 * Prefer application.yaml + url:// for URLs; these support ${VAR} interpolation until templates migrate.
 */
const APP_SERVICE_ENV_DEFAULTS_DOCKER = Object.freeze({
  MISO_HOST: 'miso-controller',
  MISO_PORT: 3000,
  MISO_PUBLIC_PORT: 3000,
  KEYCLOAK_HOST: 'keycloak',
  KEYCLOAK_PORT: 8080,
  KEYCLOAK_PUBLIC_PORT: 8082,
  MORI_HOST: 'mori-controller',
  MORI_PORT: 3004,
  OPENWEBUI_HOST: 'openwebui',
  OPENWEBUI_PORT: 3003,
  FLOWISE_HOST: 'flowise',
  FLOWISE_PORT: 3002,
  DATAPLANE_HOST: 'dataplane',
  DATAPLANE_PORT: 3001,
  DATAPLANE_PUBLIC_PORT: 3001
});

const APP_SERVICE_ENV_DEFAULTS_LOCAL = Object.freeze({
  MISO_HOST: 'localhost',
  MISO_PORT: 3010,
  MISO_PUBLIC_PORT: 3010,
  KEYCLOAK_HOST: 'localhost',
  KEYCLOAK_PORT: 8082,
  KEYCLOAK_PUBLIC_PORT: 8082,
  MORI_HOST: 'localhost',
  MORI_PORT: 3014,
  OPENWEBUI_HOST: 'localhost',
  OPENWEBUI_PORT: 3013,
  FLOWISE_HOST: 'localhost',
  FLOWISE_PORT: 3012,
  DATAPLANE_HOST: 'localhost',
  DATAPLANE_PORT: 3011,
  DATAPLANE_PUBLIC_PORT: 3011
});

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @returns {Record<string, unknown>}
 */
function shallowMergeEnv(a, b) {
  return { ...a, ...b };
}

/**
 * Merged env-config shape (infra + static app fallbacks + per-app builder manifest overlay).
 * @param {string|null|undefined} [projectRoot] - When omitted, uses paths getProjectRoot or process.cwd().
 * @returns {Object}
 */
function buildMergedDefaultEnvConfig(projectRoot) {
  const root = resolveProjectRootForEnvDefaults(projectRoot);
  const overlay = buildAppServiceEnvOverlay(root);
  return {
    environments: {
      docker: shallowMergeEnv(
        shallowMergeEnv(
          { ...INFRA_ENV_DEFAULTS_DOCKER },
          { ...APP_SERVICE_ENV_DEFAULTS_DOCKER }
        ),
        overlay.docker
      ),
      local: shallowMergeEnv(
        shallowMergeEnv(
          { ...INFRA_ENV_DEFAULTS_LOCAL },
          { ...APP_SERVICE_ENV_DEFAULTS_LOCAL }
        ),
        overlay.local
      )
    }
  };
}

/**
 * Deep clone of default env-config (docker/local hosts and ports).
 * @param {string|null|undefined} [projectRoot] - Optional workspace root for builder/ scan.
 * @returns {Object}
 */
function getDefaultEnvConfig(projectRoot) {
  return JSON.parse(JSON.stringify(buildMergedDefaultEnvConfig(projectRoot)));
}

/**
 * Infra-only defaults for declarative url:// resolution and registry fallbacks.
 * Application manifests should set `port` / `frontDoorRouting`; these apply when omitted.
 */
const DECLARATIVE_URL_INFRA_DEFAULTS = Object.freeze({
  manifestPortFallback: 3000,
  frontDoorPatternWhenUnspecified: '/',
  inactiveVdirPublicEnvReplacement: '/'
});

module.exports = {
  getDefaultEnvConfig,
  buildMergedDefaultEnvConfig,
  INFRA_ENV_DEFAULTS_DOCKER,
  INFRA_ENV_DEFAULTS_LOCAL,
  APP_SERVICE_ENV_DEFAULTS_DOCKER,
  APP_SERVICE_ENV_DEFAULTS_LOCAL,
  DECLARATIVE_URL_INFRA_DEFAULTS
};
