/**
 * Remote Docker environment – DOCKER_HOST and TLS cert path when docker-endpoint is set.
 *
 * @fileoverview Env overlay for Docker CLI when using remote Builder Server
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const config = require('../core/config');
const { getCertDir } = require('./dev-cert-helper');
const { getConfigDirForPaths } = require('./paths');

/**
 * If remote Docker is configured (docker-endpoint + cert.pem, key.pem, and ca.pem present),
 * returns env vars for Docker CLI: DOCKER_HOST, DOCKER_TLS_VERIFY, DOCKER_CERT_PATH.
 * Docker requires ca.pem in DOCKER_CERT_PATH for TLS; if it is missing we return {} so
 * the CLI uses local Docker and avoids "open ca.pem: no such file or directory".
 *
 * @returns {Promise<Object>} Env overlay (may be empty)
 */
async function getRemoteDockerEnv() {
  const endpoint = await config.getDockerEndpoint();
  if (!endpoint || typeof endpoint !== 'string' || !endpoint.trim()) {
    return {};
  }
  const devId = await config.getDeveloperId();
  const certDir = getCertDir(getConfigDirForPaths(), devId);
  const certPath = path.join(certDir, 'cert.pem');
  const keyPath = path.join(certDir, 'key.pem');
  const caPath = path.join(certDir, 'ca.pem');
  const fs = require('fs');
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !fs.existsSync(caPath)) {
    return {};
  }
  return {
    DOCKER_HOST: endpoint.trim(),
    DOCKER_TLS_VERIFY: '1',
    DOCKER_CERT_PATH: certDir
  };
}

module.exports = { getRemoteDockerEnv };
