/**
 * Poll Keycloak until the `aifabrix` realm is available (post-wipe / fresh install).
 *
 * @fileoverview Keycloak realm readiness for setup auth
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { computeAppBaseUrl } = require('./platform-controller-url');

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
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    if (await probeRealmWellKnown(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Keycloak realm "aifabrix" was not ready within ${timeoutSeconds}s (checked ${url}). ` +
      'Ensure Miso Controller finished onboarding after the database wipe.'
  );
}

module.exports = {
  buildRealmWellKnownUrl,
  waitForKeycloakRealmReady
};
