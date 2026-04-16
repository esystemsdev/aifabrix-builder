/**
 * Remote shared builder vs local Docker Desktop — developer-id rules (plan 018).
 *
 * @fileoverview Fail fast when remote-server is non-localhost but developer-id is not a positive integer
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {string|null|undefined} remoteServer - remote-server from config (URL or host)
 * @returns {boolean} True when hostname is set and not localhost / loopback only
 */
function remoteServerHostIsNonLocalhost(remoteServer) {
  const raw =
    remoteServer === null || remoteServer === undefined ? '' : String(remoteServer).trim();
  if (!raw) {
    return false;
  }
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    let h = (u.hostname || '').toLowerCase();
    if (h.startsWith('[') && h.endsWith(']')) {
      h = h.slice(1, -1);
    }
    if (!h) {
      return false;
    }
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Host for user-facing messages (no path, no credentials).
 * @param {string|null|undefined} remoteServer
 * @returns {string}
 */
function remoteServerDisplayHost(remoteServer) {
  const raw =
    remoteServer === null || remoteServer === undefined ? '' : String(remoteServer).trim();
  if (!raw) {
    return '(remote-server)';
  }
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    return u.host || raw;
  } catch {
    return raw;
  }
}

const REMOTE_DEV_ID_BODY =
  'Remote builder at %s requires a positive developer-id (1, 2, 3, …).\n' +
  'Developer-id 0 is only supported for local Docker Desktop (localhost).\n' +
  'Set developer-id in ~/.aifabrix/config.yaml to match your dev account (e.g. 1 for dev01), ' +
  'or run onboarding against the builder: aifabrix dev init …';

const REMOTE_DEV_ID_TAIL =
  '\n\nIf you meant to work only on this machine, set remote-server to use localhost or remove the shared builder URL.';

/**
 * When remote-server points at a shared (non-local) builder, require developer-id ≥ 1.
 * @param {string|null|undefined} remoteServer
 * @param {string|number|null|undefined} developerIdRaw
 * @throws {Error} When remote builder and id missing, non-numeric, or < 1
 */
function assertRemoteBuilderDeveloperId(remoteServer, developerIdRaw) {
  if (!remoteServerHostIsNonLocalhost(remoteServer)) {
    return;
  }
  const host = remoteServerDisplayHost(remoteServer);
  const head = REMOTE_DEV_ID_BODY.replace('%s', host);

  if (developerIdRaw === null || developerIdRaw === undefined || developerIdRaw === '') {
    throw new Error(head + REMOTE_DEV_ID_TAIL);
  }
  const s = String(developerIdRaw).trim();
  if (!/^\d+$/.test(s)) {
    throw new Error(head + REMOTE_DEV_ID_TAIL);
  }
  const n = parseInt(s, 10);
  if (n < 1) {
    throw new Error(head + REMOTE_DEV_ID_TAIL);
  }
}

module.exports = {
  remoteServerHostIsNonLocalhost,
  remoteServerDisplayHost,
  assertRemoteBuilderDeveloperId
};
