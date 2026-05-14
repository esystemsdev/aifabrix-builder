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
 * Public URL authorities that must use `http://` (browsers hit loopback without TLS in practice).
 *
 * @param {string} hostname - Parsed URL hostname
 * @returns {boolean}
 */
function isLocalhostPublicSchemeHostname(hostname) {
  const h = String(hostname || '').trim().toLowerCase();
  if (!h) {
    return false;
  }
  if (h === 'localhost') {
    return true;
  }
  if (h === '127.0.0.1') {
    return true;
  }
  return h === '::1';
}

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
 * Scheme for `declarativePublicUrlsUseLocalhost` bases: always **http** for loopback reachability
 * (ignore `tlsEnabled` / `remote-server` https — localhost URLs are not served with TLS in dev).
 * @param {Object} opts - Kept for call-site compatibility (same shape as {@link computePublicUrlBaseString})
 * @returns {'http'}
 */
function schemeForDeclarativeLocalhostPublicBase(opts) {
  void opts;
  return 'http';
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
 * Public authority from `remote-server` when expansion opts in (Traefik on, or per-app `proxy: true` ⇒
 * `declarativePublicUrlsUseLocalhost === false`). If the URL already has an explicit port, keep host:port but
 * **scheme follows `infraTlsEnabled`**, not the literal `https://` in `remote-server` when TLS is off
 * (`up-infra` without `--tls`). If `remote-server` omits a port, append the profile-specific published/listen-derived port.
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
  let scheme = infraTlsEnabled ? 'https' : 'http';
  if (isLocalhostPublicSchemeHostname(u.hostname)) {
    scheme = 'http';
  }

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
 * True when `frontDoorRouting.host` depends on `remote-server` for expansion (`${REMOTE_HOST}`).
 * Without a remote, expansion yields a bare `devNN` label (no DNS) — public `url://` bases must fall back to localhost.
 *
 * @param {string|null|undefined} hostTemplate
 * @returns {boolean}
 */
function templateUsesRemoteHostPlaceholder(hostTemplate) {
  return /\$\{REMOTE_HOST\}/.test(String(hostTemplate || ''));
}

/**
 * @param {Object} opts - same shape as computePublicUrlBaseString
 * @returns {string|null}
 */
function buildTraefikPublicBaseIfApplicable(opts) {
  const { traefik, pathActive, hostTemplate, developerIdRaw, remoteServer, infraTlsEnabled } =
    opts;
  // Plan 124: Traefik host authority only when pathActive (traefik ∧ frontDoorRouting.enabled)
  if (!traefik || !pathActive || !hostTemplate || !String(hostTemplate).trim()) {
    return null;
  }
  if (templateUsesRemoteHostPlaceholder(hostTemplate) && !String(remoteServer || '').trim()) {
    return null;
  }
  const expanded = expandFrontDoorHostTemplateForUrls(hostTemplate, {
    developerIdRaw,
    remoteServer
  });
  if (!expanded) {
    return null;
  }
  // Scheme follows global `tlsEnabled` (`up-infra --tls`) only — not `frontDoorRouting.tls` when infra TLS is off.
  const useHttps = Boolean(infraTlsEnabled);
  let scheme = useHttps ? 'https' : 'http';
  if (isLocalhostPublicSchemeHostname(expanded)) {
    scheme = 'http';
  }
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
 * @param {boolean} [opts.infraTlsEnabled] - `tlsEnabled` from ~/.aifabrix/config.yaml (`up-infra --tls`); Traefik front-door public bases use **`https`** only when this is **true** (even if `frontDoorRouting.tls` is **false**). When **false**, front-door bases use **`http`** regardless of `frontDoorRouting.tls`. Loopback hostnames stay **http** always.
 * @param {boolean} [opts.pathActive] - traefik ∧ frontDoorRouting.enabled; required for Traefik host branch (plan 124)
 * @param {boolean|undefined} [opts.declarativePublicUrlsUseLocalhost] - **`true`**: force localhost authority (+ port rules below). **`false`**: allow `remote-server` as authority when Traefik is on, or when global `traefik` is not `false` and per-app `proxy` opts in without Traefik. **`undefined`**: default — omit `remote-server` when Traefik is off so published services use `http://localhost:<port>` (e.g. `af setup` / device login URLs). When user config has **`traefik: false`**, expansion forces localhost for public bases regardless of per-app `proxy`.
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

  if (opts.declarativePublicUrlsUseLocalhost) {
    const hostPort = resolveHostPortForDeclarativePublic({
      profile,
      listenPort,
      developerIdNum,
      declarativeTargetAppKey: declarativePortOpts.declarativeTargetAppKey,
      declarativeCurrentAppKey: declarativePortOpts.declarativeCurrentAppKey
    });
    const scheme = schemeForDeclarativeLocalhostPublicBase(opts);
    return `${scheme}://localhost:${hostPort}`;
  }

  const remoteTrimmed = remoteServer && String(remoteServer).trim();
  const useRemotePublicAuthority =
    Boolean(remoteTrimmed) &&
    (Boolean(opts.traefik) || opts.declarativePublicUrlsUseLocalhost === false);
  if (useRemotePublicAuthority) {
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
  return `http://localhost:${hostPort}`;
}

module.exports = {
  expandFrontDoorHostTemplateForUrls,
  computePublicUrlBaseString,
  resolveHostPortForDeclarativePublic
};
