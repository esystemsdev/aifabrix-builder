/**
 * Public URL base for url:// expansion when Traefik + frontDoorRouting.host (plan 122 phase 2).
 *
 * @fileoverview Traefik host template vs remote-server vs localhost+port
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { expandFrontDoorHostPlaceholders } = require('./compose-generator');
const { publishedHostPort, localHostPort } = require('./declarative-url-ports');

/**
 * Expand frontDoorRouting.host placeholders for url:// (same rules as Traefik labels in compose-generator).
 *
 * @param {string} template
 * @param {Object} opts
 * @param {string|number|null|undefined} opts.developerIdRaw
 * @param {string|null|undefined} opts.remoteServer
 * @returns {string}
 */
function expandFrontDoorHostTemplateForUrls(template, opts) {
  const { developerIdRaw, remoteServer } = opts || {};
  return expandFrontDoorHostPlaceholders(template, developerIdRaw, remoteServer);
}

/**
 * Scheme + authority (no path) for public url://* when Traefik, remote, or localhost.
 *
 * @param {Object} opts
 * @param {boolean} [opts.traefik]
 * @param {string|null|undefined} opts.hostTemplate
 * @param {boolean} [opts.tls]
 * @param {string|number|null|undefined} opts.developerIdRaw
 * @param {string|null|undefined} opts.remoteServer
 * @param {'docker'|'local'} opts.profile
 * @param {number} opts.listenPort
 * @param {number} opts.developerIdNum
 * @returns {string}
 */
function computePublicUrlBaseString(opts) {
  const {
    traefik,
    hostTemplate,
    tls,
    developerIdRaw,
    remoteServer,
    profile,
    listenPort,
    developerIdNum
  } = opts;

  if (traefik && hostTemplate && String(hostTemplate).trim()) {
    const expanded = expandFrontDoorHostTemplateForUrls(hostTemplate, {
      developerIdRaw,
      remoteServer
    });
    if (expanded) {
      const scheme = tls === false ? 'http' : 'https';
      return `${scheme}://${expanded}`.replace(/\/+$/, '');
    }
  }

  if (remoteServer && String(remoteServer).trim()) {
    return String(remoteServer).trim().replace(/\/+$/, '');
  }

  const hostPort =
    profile === 'docker'
      ? publishedHostPort(listenPort, developerIdNum)
      : localHostPort(listenPort, developerIdNum);
  return `http://localhost:${hostPort}`;
}

module.exports = {
  expandFrontDoorHostTemplateForUrls,
  computePublicUrlBaseString
};
