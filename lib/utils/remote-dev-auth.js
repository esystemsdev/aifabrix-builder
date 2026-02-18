/**
 * @fileoverview Resolve Builder Server URL and client cert for cert-authenticated dev API calls
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const config = require('../core/config');
const { getCertDir, readClientCertPem } = require('./dev-cert-helper');
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
 * Get Builder Server URL and client cert PEM when remote is configured; otherwise null.
 * Use for cert-authenticated dev API calls (settings, users, ssh-keys, secrets).
 * @returns {Promise<{ serverUrl: string, clientCertPem: string }|null>}
 */
async function getRemoteDevAuth() {
  const serverUrl = await config.getRemoteServer();
  if (!serverUrl) return null;
  const devId = await config.getDeveloperId();
  const certDir = getCertDir(getConfigDirForPaths(), devId);
  const clientCertPem = readClientCertPem(certDir);
  if (!clientCertPem) return null;
  return { serverUrl, clientCertPem };
}

module.exports = {
  isRemoteSecretsUrl,
  getRemoteDevAuth
};
