/**
 * @fileoverview Resolve Builder Server URL and client cert for cert-authenticated dev API calls
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const config = require('../core/config');
const { getCertDir, readClientCertPem, readServerCaPem } = require('./dev-cert-helper');
const { getConfigDirForPaths, getAifabrixHome, getAifabrixWork } = require('./paths');

/**
 * Single API object so resolveSharedSecretsEndpoint and callers share one getRemoteDevAuth
 * (Jest spies and partial mocks work reliably).
 */
const remoteDevAuth = {
  /**
   * Check if a string is an http(s) URL (for aifabrix-secrets remote mode).
   * @param {string} value - Config value
   * @returns {boolean}
   */
  isRemoteSecretsUrl(value) {
    return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
  },

  /**
   * Get Builder Server URL, client cert PEM, and optional dev root CA when remote is configured; otherwise null.
   * serverCaPem comes from ca.pem (saved at dev init); required for Node TLS to private-CA servers.
   * Use for cert-authenticated dev API calls (settings, users, ssh-keys, secrets).
   * @returns {Promise<{ serverUrl: string, clientCertPem: string, serverCaPem: string|null }|null>}
   */
  async getRemoteDevAuth() {
    const serverUrl = await config.getRemoteServer();
    if (!serverUrl) return null;
    const devId = await config.getDeveloperId();
    const certDir = getCertDir(getConfigDirForPaths(), devId);
    const clientCertPem = readClientCertPem(certDir);
    if (!clientCertPem) return null;
    const serverCaPem = readServerCaPem(certDir);
    return { serverUrl, clientCertPem, serverCaPem };
  },

  /**
   * Resolve where shared secrets read/write should go. After dev init, config may still hold a
   * server-side filesystem path from GET /api/dev/settings (not an http URL) if merge did not rewrite it.
   * Those paths are not writable on the developer machine; use the Builder secrets API instead when
   * remote-server + client cert are configured and the path is not under aifabrix-home or aifabrix-work.
   *
   * @param {string} configuredPath - config.yaml aifabrix-secrets
   * @returns {Promise<string>} Same string for local file targets, or https?://…/api/dev/secrets for remote API
   */
  async resolveSharedSecretsEndpoint(configuredPath) {
    if (!configuredPath || typeof configuredPath !== 'string') return configuredPath;
    const trimmed = configuredPath.trim();
    if (!trimmed) return configuredPath;
    if (remoteDevAuth.isRemoteSecretsUrl(trimmed)) return trimmed.replace(/\/+$/, '');
    const auth = await remoteDevAuth.getRemoteDevAuth();
    if (!auth) return configuredPath;
    const abs = normalizeSharedSecretsFilePath(trimmed);
    if (!abs) return configuredPath;
    const home = path.normalize(getAifabrixHome());
    if (isPathUnderDir(abs, home)) return configuredPath;
    const work = getAifabrixWork();
    if (work) {
      const w = path.normalize(work);
      if (isPathUnderDir(abs, w)) return configuredPath;
    }
    const base = String(auth.serverUrl).replace(/\/+$/, '');
    return `${base}/api/dev/secrets`;
  },

  /**
   * Hostname from a resolved shared-secrets API URL (for CLI labels).
   * @param {string} secretsEndpointUrl - e.g. https://builder02.local/api/dev/secrets
   * @returns {string|null} Hostname, or null if the URL cannot be parsed
   */
  getSharedSecretsRemoteHostname(secretsEndpointUrl) {
    try {
      const u = new URL(String(secretsEndpointUrl));
      return u.hostname || null;
    } catch {
      return null;
    }
  },

  /**
   * Titles/messages for `secret list --shared` when the store is remote.
   * @param {string} secretsEndpointUrl - Resolved secrets API URL
   * @returns {{ title: string, emptyMessage: string }}
   */
  getSharedSecretsRemoteListLabels(secretsEndpointUrl) {
    const host = remoteDevAuth.getSharedSecretsRemoteHostname(secretsEndpointUrl);
    if (host) {
      return {
        title: `Shared secrets (remote - ${host})`,
        emptyMessage: `No shared secrets (remote - ${host}).`
      };
    }
    return {
      title: 'Shared secrets (remote)',
      emptyMessage: 'No shared secrets (remote).'
    };
  }
};

/**
 * True when normalized file path is dir or a descendant of base (same volume semantics as path relative checks).
 * @param {string} filePath - Normalized absolute path
 * @param {string} baseDir - Normalized absolute directory
 * @returns {boolean}
 */
function isPathUnderDir(filePath, baseDir) {
  if (!filePath || !baseDir) return false;
  const f = filePath;
  const d = baseDir;
  if (f === d) return true;
  const prefix = d.endsWith(path.sep) ? d : d + path.sep;
  return f.startsWith(prefix);
}

/**
 * Normalize configured shared-secrets file path for "is this on the laptop?" checks.
 * @param {string} configured - Raw config value
 * @returns {string} Absolute normalized path
 */
function normalizeSharedSecretsFilePath(configured) {
  const trimmed = String(configured || '').trim();
  if (!trimmed) return '';
  return path.isAbsolute(trimmed)
    ? path.normalize(trimmed)
    : path.normalize(path.resolve(process.cwd(), trimmed));
}

module.exports = remoteDevAuth;
