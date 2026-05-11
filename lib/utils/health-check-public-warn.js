/**
 * Post-success warnings when public/Traefik health URL was skipped or not verified.
 *
 * @fileoverview Split from health-check.js for file size limits
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');

/**
 * When Traefik URL is set, drop it if the hostname does not resolve; retain full URL for UX.
 *
 * @param {string} traefikUrl
 * @param {boolean} debug
 * @param {Function} isHostnameResolvableFn - (hostname, debug) => Promise<boolean>
 * @returns {Promise<{ traefikUrl: string, skippedPublicHealthUrl: string }>}
 */
async function filterTraefikUrlByDns(traefikUrl, debug, isHostnameResolvableFn) {
  if (!traefikUrl) {
    return { traefikUrl: '', skippedPublicHealthUrl: '' };
  }
  try {
    const hn = new URL(traefikUrl).hostname;
    const ok = await isHostnameResolvableFn(hn, debug);
    if (!ok) {
      return { traefikUrl: '', skippedPublicHealthUrl: traefikUrl };
    }
  } catch {
    return { traefikUrl: '', skippedPublicHealthUrl: '' };
  }
  return { traefikUrl, skippedPublicHealthUrl: '' };
}

/**
 * @param {Object} p
 * @param {string} [p.skippedPublicHealthUrl]
 * @param {string[]} [p.urlsToTry]
 * @param {number} p.resolvedIndex
 */
function logPublicHealthUrlWarningIfNeeded(p) {
  const { skippedPublicHealthUrl, urlsToTry, resolvedIndex } = p;
  if (typeof resolvedIndex !== 'number' || resolvedIndex < 0) return;

  if (skippedPublicHealthUrl) {
    logger.log(
      chalk.yellow(
        `⚠ Public URL was not verified (DNS): ${skippedPublicHealthUrl}. ` +
          'The application reported healthy via localhost only. Validate DNS names and Traefik routing for this host.'
      )
    );
    return;
  }
  if (Array.isArray(urlsToTry) && urlsToTry.length > 1 && resolvedIndex > 0) {
    const pub = urlsToTry[0];
    logger.log(
      chalk.yellow(
        `⚠ Public URL was not verified: ${pub}. ` +
          'Health checks succeeded via localhost only. Validate Traefik routing, TLS, and DNS.'
      )
    );
  }
}

module.exports = {
  filterTraefikUrlByDns,
  logPublicHealthUrlWarningIfNeeded
};
