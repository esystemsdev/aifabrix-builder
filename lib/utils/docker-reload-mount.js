/**
 * Decide whether `aifabrix run --reload` can bind-mount workspace without Mutagen.
 * Mutagen is only needed when the CLI filesystem and the Docker engine host differ.
 *
 * @fileoverview Co-located Docker detection for reload mounts
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const os = require('os');

/**
 * @param {string} host
 * @returns {string}
 */
function normalizeHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
}

/**
 * @param {string} host
 * @returns {boolean}
 */
function isLocalLoopbackHost(host) {
  const h = normalizeHost(host);
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0:0:0:0:0:0:0:1';
}

/**
 * @param {string} rest - after "tcp://"
 * @returns {string|null}
 */
function tcpHostFromRest(rest) {
  if (rest.startsWith('[')) {
    const end = rest.indexOf(']');
    if (end === -1) return null;
    return normalizeHost(rest.slice(1, end));
  }
  const hostPort = rest.split('/')[0];
  const colonIdx = hostPort.lastIndexOf(':');
  if (colonIdx === -1) {
    return normalizeHost(hostPort);
  }
  const maybePort = hostPort.slice(colonIdx + 1);
  if (/^\d+$/.test(maybePort)) {
    return normalizeHost(hostPort.slice(0, colonIdx));
  }
  return normalizeHost(hostPort);
}

/**
 * Extract host from docker-endpoint (tcp, optional URL form).
 * @param {string} endpoint
 * @returns {string|null} normalized host, or null for unix socket paths / empty
 */
function extractHostFromDockerEndpoint(endpoint) {
  const s = String(endpoint || '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith('unix:')) {
    return null;
  }
  if (lower.startsWith('tcp://')) {
    return tcpHostFromRest(s.slice(6));
  }
  try {
    const u = new URL(s.includes('://') ? s : `tcp://${s}`);
    return normalizeHost(u.hostname);
  } catch {
    return null;
  }
}

/**
 * sync-ssh-host localhost check (same rules as run.js isLocalhostHost for reload gate).
 * @param {string} host
 * @returns {boolean}
 */
function isLocalhostSyncSshHost(host) {
  if (!host || typeof host !== 'string') return false;
  const h = host.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1';
}

/**
 * True when docker API host is this machine (first label or FQDN match).
 * @param {string} dockerHost - from extractHostFromDockerEndpoint
 * @returns {boolean}
 */
function hostnameMatchesDockerHost(dockerHost) {
  const h = normalizeHost(dockerHost);
  if (!h) return true;
  if (isLocalLoopbackHost(h)) return true;
  const hn = normalizeHost(os.hostname());
  if (h === hn) return true;
  const hnShort = hn.split('.')[0];
  const hShort = h.split('.')[0];
  if (h === hnShort || hn === hShort) return true;
  return false;
}

/**
 * When true, use a direct bind mount for --reload; Mutagen is not required.
 * @param {string|null|undefined} dockerEndpoint - config `docker-endpoint`
 * @returns {boolean}
 */
function isReloadBindMountOnEngineHost(dockerEndpoint) {
  const e = String(dockerEndpoint || '').trim();
  if (!e) return true;
  if (e.toLowerCase().startsWith('unix:')) return true;
  const host = extractHostFromDockerEndpoint(e);
  if (host === null) {
    return false;
  }
  return hostnameMatchesDockerHost(host);
}

module.exports = {
  extractHostFromDockerEndpoint,
  isReloadBindMountOnEngineHost,
  isLocalhostSyncSshHost
};
