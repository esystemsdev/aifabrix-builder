/**
 * @fileoverview Resolve Builder Server URL and client cert for cert-authenticated dev API calls
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const config = require('../core/config');
const { getCertDir, readClientCertPem, readServerCaPem } = require('./dev-cert-helper');
const { getConfigDirForPaths } = require('./paths');

/**
 * Check if a string is an http(s) URL (for aifabrix-secrets remote mode).
 * @param {string} value - Config value
 * @returns {boolean}
 */
function isRemoteSecretsUrl(value) {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
}

/**
 * Get Builder Server URL, client cert PEM, and optional dev root CA when remote is configured; otherwise null.
 * serverCaPem comes from ca.pem (saved at dev init); required for Node TLS to private-CA servers.
 * Use for cert-authenticated dev API calls (settings, users, ssh-keys, secrets).
 * @returns {Promise<{ serverUrl: string, clientCertPem: string, serverCaPem: string|null }|null>}
 */
async function getRemoteDevAuth() {
  const serverUrl = await config.getRemoteServer();
  if (!serverUrl) return null;
  const devId = await config.getDeveloperId();
  const certDir = getCertDir(getConfigDirForPaths(), devId);
  const clientCertPem = readClientCertPem(certDir);
  if (!clientCertPem) return null;
  const serverCaPem = readServerCaPem(certDir);
  return { serverUrl, clientCertPem, serverCaPem };
}

module.exports = {
  isRemoteSecretsUrl,
  getRemoteDevAuth
};
