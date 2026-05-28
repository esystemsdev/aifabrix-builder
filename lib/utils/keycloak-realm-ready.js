/**
 * Poll Keycloak until the `aifabrix` realm is available (post-wipe / fresh install).
 *
 * @fileoverview Keycloak realm readiness for setup auth
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { computeAppBaseUrl } = require('./platform-controller-url');
const config = require('../core/config');
const { readUrlsLocalRegistrySync } = require('./urls-local-registry');
const { normalizeFrontDoorPatternForHealth } = require('./health-check-url');

/**
 * @param {string} keycloakBase
 * @returns {string}
 */
function buildRealmWellKnownUrl(keycloakBase) {
  const base = String(keycloakBase || '').replace(/\/+$/, '');
  return `${base}/realms/aifabrix/.well-known/openid-configuration`;
}

/**
 * @async
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function probeRealmWellKnown(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function computeKeycloakDirectBaseUrlFromRegistry(registry, developerIdNum) {
  const portRaw = registry && registry['keycloak-port'];
  const port =
    typeof portRaw === 'number'
      ? portRaw
      : typeof portRaw === 'string' && /^\d+$/.test(portRaw.trim())
        ? parseInt(portRaw.trim(), 10)
        : null;
  if (!port || port <= 0) {
    return null;
  }
  const patternRaw = registry && registry['keycloak-pattern'];
  const pattern = typeof patternRaw === 'string' && patternRaw.trim() ? patternRaw.trim() : null;
  const mount = pattern ? normalizeFrontDoorPatternForHealth(pattern) : null;
  const adjusted = port + (Number.isFinite(developerIdNum) ? developerIdNum : 0) * 100;
  return `http://localhost:${adjusted}${mount || ''}`;
}

/**
 * Wait until Keycloak serves the aifabrix realm OIDC metadata.
 *
 * @async
 * @param {{ timeoutSeconds?: number, intervalMs?: number }} [opts]
 * @returns {Promise<void>}
 * @throws {Error} On timeout
 */
async function waitForKeycloakRealmReady(opts = {}) {
  const timeoutSeconds = Number.isFinite(opts.timeoutSeconds) ? opts.timeoutSeconds : 180;
  const intervalMs = Number.isFinite(opts.intervalMs) ? opts.intervalMs : 3000;
  const keycloakBase = await computeAppBaseUrl('keycloak');
  const url = buildRealmWellKnownUrl(keycloakBase);
  const registry = readUrlsLocalRegistrySync();
  const developerIdRaw = await config.getDeveloperId();
  const developerIdNum = typeof developerIdRaw === 'string' ? parseInt(developerIdRaw, 10) : developerIdRaw;
  const directBase = computeKeycloakDirectBaseUrlFromRegistry(registry, developerIdNum);
  const directUrl = directBase ? buildRealmWellKnownUrl(directBase) : null;
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    if (await probeRealmWellKnown(url)) {
      return;
    }
    if (directUrl && (await probeRealmWellKnown(directUrl))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Keycloak realm "aifabrix" was not ready within ${timeoutSeconds}s (checked ${url}${directUrl ? ` and ${directUrl}` : ''}). ` +
      'Ensure Miso Controller finished onboarding after the database wipe.'
  );
}

module.exports = {
  buildRealmWellKnownUrl,
  waitForKeycloakRealmReady,
  computeKeycloakDirectBaseUrlFromRegistry
};
