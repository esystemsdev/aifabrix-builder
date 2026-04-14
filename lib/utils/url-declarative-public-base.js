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
 * Local profile: workstation `+10` applies only to the app being resolved (`currentAppKey`).
 * Cross-app tokens (e.g. `url://keycloak-public` from miso-controller) use `publishedHostPort`
 * (manifest + dev*100, no +10) so sibling services keep compose-published offsets only.
 *
 * @param {Object} opts
 * @param {'docker'|'local'} opts.profile
 * @param {number} opts.listenPort - published/manifest basis for public URLs
 * @param {number} opts.developerIdNum
 * @param {string|undefined} opts.declarativeTargetAppKey - target of the url:// token
 * @param {string|undefined} opts.declarativeCurrentAppKey - app whose env is being generated
 * @returns {number}
 */
function resolveHostPortForDeclarativePublic(opts) {
  const {
    profile,
    listenPort,
    developerIdNum,
    declarativeTargetAppKey,
    declarativeCurrentAppKey
  } = opts;
  if (profile !== 'local') {
    return hostPortForProfile(profile, listenPort, developerIdNum);
  }
  const cur = String(declarativeCurrentAppKey || '').trim();
  const tgt = String(declarativeTargetAppKey || '').trim();
  const isCurrentApp = !cur || !tgt || tgt === cur;
  return isCurrentApp ? localHostPort(listenPort, developerIdNum) : publishedHostPort(listenPort, developerIdNum);
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
function remotePublicBaseWithoutTraefik(
  rawRemote,
  profile,
  listenPort,
  developerIdNum,
  infraTlsEnabled,
  declarativePortOpts
) {
  const raw = String(rawRemote || '').trim().replace(/\/+$/, '');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : (infraTlsEnabled ? `https://${raw}` : `http://${raw}`);
  const u = new URL(withScheme);
  const scheme = infraTlsEnabled ? 'https' : 'http';

  if (u.port !== '') {
    return `${scheme}://${u.host}`;
  }

  const hostPort = resolveHostPortForDeclarativePublic({
    profile,
    listenPort,
    developerIdNum,
    declarativeTargetAppKey: declarativePortOpts && declarativePortOpts.declarativeTargetAppKey,
    declarativeCurrentAppKey: declarativePortOpts && declarativePortOpts.declarativeCurrentAppKey
  });
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
  const { traefik, pathActive, hostTemplate, tls, developerIdRaw, remoteServer, infraTlsEnabled } =
    opts;
  // Plan 124: Traefik host authority only when pathActive (traefik ∧ frontDoorRouting.enabled)
  if (!traefik || !pathActive || !hostTemplate || !String(hostTemplate).trim()) {
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
 * @param {boolean} [opts.pathActive] - traefik ∧ frontDoorRouting.enabled; required for Traefik host branch (plan 124)
 * @returns {string}
 */
function computePublicUrlBaseString(opts) {
  const { remoteServer, profile, listenPort, developerIdNum, infraTlsEnabled } = opts;
  const declarativePortOpts = {
    declarativeTargetAppKey: opts.declarativeTargetAppKey,
    declarativeCurrentAppKey: opts.declarativeCurrentAppKey
  };

  const traefikBase = buildTraefikPublicBaseIfApplicable({
    ...opts,
    pathActive: Boolean(opts.pathActive)
  });
  if (traefikBase) {
    return traefikBase;
  }

  if (remoteServer && String(remoteServer).trim()) {
    return remotePublicBaseWithoutTraefik(
      remoteServer,
      profile,
      listenPort,
      developerIdNum,
      Boolean(infraTlsEnabled),
      declarativePortOpts
    );
  }

  const hostPort = resolveHostPortForDeclarativePublic({
    profile,
    listenPort,
    developerIdNum,
    declarativeTargetAppKey: declarativePortOpts.declarativeTargetAppKey,
    declarativeCurrentAppKey: declarativePortOpts.declarativeCurrentAppKey
  });
  const scheme = infraTlsEnabled ? 'https' : 'http';
  return `${scheme}://localhost:${hostPort}`;
}

module.exports = {
  expandFrontDoorHostTemplateForUrls,
  computePublicUrlBaseString,
  resolveHostPortForDeclarativePublic
};
