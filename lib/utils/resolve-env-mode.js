/**
 * Chooses `local` vs `docker` for `generateEnvFile` / `resolve` (integration → local, no Docker rewrite).
 *
 * @fileoverview Resolve environment mode for env generation
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');

/** Platform builder apps that run in Docker and need docker host/port transforms on resolve. */
const PLATFORM_DOCKER_APP_KEYS = new Set(['keycloak', 'miso-controller', 'dataplane']);

/**
 * @param {string} appPath - Resolved app directory from getResolveAppPath
 * @returns {boolean}
 */
function isIntegrationAppPath(appPath) {
  if (!appPath || typeof appPath !== 'string') return false;
  const normalized = path.resolve(appPath);
  const marker = `${path.sep}integration${path.sep}`;
  return normalized.includes(marker);
}

/**
 * @param {string} appPath - Resolved application directory
 * @param {string} [appName] - App or system key
 * @returns {'local'|'docker'}
 */
function resolveGenerateEnvEnvironment(appPath, appName) {
  if (isIntegrationAppPath(appPath)) {
    return 'local';
  }
  const key = String(appName || '').trim().toLowerCase();
  if (PLATFORM_DOCKER_APP_KEYS.has(key)) {
    return 'docker';
  }
  return 'docker';
}

module.exports = {
  PLATFORM_DOCKER_APP_KEYS,
  isIntegrationAppPath,
  resolveGenerateEnvEnvironment
};
