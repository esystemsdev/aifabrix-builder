/**
 * Public URL base for url:// expansion when Traefik + frontDoorRouting.host (plan 122 phase 2).
 *
 * @fileoverview Traefik host template vs remote-server vs localhost+port (no app-specific rules)
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

function hostPortForProfile(profile, listenPort, developerIdNum) {
  return profile === 'docker'
    ? publishedHostPort(listenPort, developerIdNum)
    : localHostPort(listenPort, developerIdNum);
}

/**
 * Without Traefik, `remote-server` is the dev machine host. Apps bind published host ports, not 443 + path.
 * If the URL already has an explicit port, keep host:port but **scheme follows `infraTlsEnabled`**, not the
 * literal `https://` in `remote-server` when TLS is off (`up-infra` without `--tls`).
 * If `remote-server` omits a port, append the profile-specific published/listen-derived port.
 *
 * @param {string} rawRemote
 * @param {'docker'|'local'} profile
 * @param {number} listenPort
 * @param {number} developerIdNum
 * @param {boolean} infraTlsEnabled
 * @returns {string}
 */
function remotePublicBaseWithoutTraefik(rawRemote, profile, listenPort, developerIdNum, infraTlsEnabled) {
  const raw = String(rawRemote || '').trim().replace(/\/+$/, '');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : (infraTlsEnabled ? `https://${raw}` : `http://${raw}`);
  const u = new URL(withScheme);
  const scheme = infraTlsEnabled ? 'https' : 'http';

  if (u.port !== '') {
    return `${scheme}://${u.host}`;
  }

  const hostPort = hostPortForProfile(profile, listenPort, developerIdNum);
  const defaultPort = scheme === 'https' ? 443 : 80;
  if (Number(hostPort) === defaultPort) {
    return `${scheme}://${u.hostname}`;
  }
  return `${scheme}://${u.hostname}:${hostPort}`;
}

/**
 * @param {Object} opts - same shape as computePublicUrlBaseString
 * @returns {string|null}
 */
function buildTraefikPublicBaseIfApplicable(opts) {
  const { traefik, hostTemplate, tls, developerIdRaw, remoteServer, infraTlsEnabled } = opts;
  if (!traefik || !hostTemplate || !String(hostTemplate).trim()) {
    return null;
  }
  const expanded = expandFrontDoorHostTemplateForUrls(hostTemplate, {
    developerIdRaw,
    remoteServer
  });
  if (!expanded) {
    return null;
  }
  const useHttps = Boolean(infraTlsEnabled) || tls !== false;
  const scheme = useHttps ? 'https' : 'http';
  return `${scheme}://${expanded}`.replace(/\/+$/, '');
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
 * @param {boolean} [opts.infraTlsEnabled] - `tlsEnabled` from ~/.aifabrix/config.yaml (`up-infra --tls`); when true, Traefik front-door public URLs use https even if application.yaml has `frontDoorRouting.tls: false`
 * @returns {string}
 */
function computePublicUrlBaseString(opts) {
  const { remoteServer, profile, listenPort, developerIdNum, infraTlsEnabled } = opts;

  const traefikBase = buildTraefikPublicBaseIfApplicable(opts);
  if (traefikBase) {
    return traefikBase;
  }

  if (remoteServer && String(remoteServer).trim()) {
    return remotePublicBaseWithoutTraefik(
      remoteServer,
      profile,
      listenPort,
      developerIdNum,
      Boolean(infraTlsEnabled)
    );
  }

  const hostPort = hostPortForProfile(profile, listenPort, developerIdNum);
  const scheme = infraTlsEnabled ? 'https' : 'http';
  return `${scheme}://localhost:${hostPort}`;
}

module.exports = {
  expandFrontDoorHostTemplateForUrls,
  computePublicUrlBaseString
};
