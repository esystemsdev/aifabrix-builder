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

function devTlsCertPaths(certDir) {
  return {
    certPath: path.join(certDir, 'cert.pem'),
    keyPath: path.join(certDir, 'key.pem'),
    caPath: path.join(certDir, 'ca.pem')
  };
}

function missingClientTlsError(trimmed, certDir) {
  return new Error(
    `docker-endpoint is set (${trimmed}) but client TLS material is missing in ${certDir}. ` +
      'Place cert.pem and key.pem there (from Builder Server issue-cert or `AIFABRIX_DEV_ISSUE_PIN`), ' +
      'or enable TLS skip-verify (`docker-tls-skip-verify: true` or `AIFABRIX_DOCKER_TLS_SKIP_VERIFY=1`) ' +
      'if the daemon does not require client certificates. With skip-verify and no ca.pem, DOCKER_TLS_VERIFY=0. ' +
      'Clear docker-endpoint only if you intend to use the local Docker daemon.'
  );
}

function missingCaError(trimmed, certDir) {
  return new Error(
    `docker-endpoint is set (${trimmed}) but ca.pem is missing in ${certDir} and docker-tls-skip-verify is not enabled. ` +
      'Add ca.pem (daemon/CA PEM), or for a self-signed Docker API set docker-tls-skip-verify: true in ~/.aifabrix/config.yaml ' +
      '(or AIFABRIX_DOCKER_TLS_SKIP_VERIFY=1). Skip-verify uses TLS but does not verify the daemon certificate — use only on trusted networks.'
  );
}

/**
 * If remote Docker is configured (docker-endpoint set), returns env vars for Docker CLI:
 * DOCKER_HOST, DOCKER_TLS_VERIFY, and optionally DOCKER_CERT_PATH when client certs exist.
 * When docker-endpoint is set, we do not fall back to the local daemon without that endpoint
 * (avoids accidentally using Docker Desktop while the dev profile targets a remote engine).
 *
 * When **TLS skip-verify** is enabled (config or env) and **ca.pem is missing**, client cert/key are
 * optional: Docker can use DOCKER_TLS_VERIFY=0 with no client certs if the daemon allows it.
 * If **ca.pem is present** (e.g. from Builder Server issue-cert), the daemon certificate is always
 * verified (DOCKER_TLS_VERIFY=1) even when skip-verify is set — better security once a trust anchor exists.
 *
 * Without skip-verify, cert.pem, key.pem, and ca.pem are required in the dev cert directory.
 *
 * @returns {Promise<Object>} Env overlay (empty when docker-endpoint is not set)
 * @throws {Error} When docker-endpoint is set but required TLS material is missing
 */
async function getRemoteDockerEnv() {
  const endpoint = await config.getDockerEndpoint();
  if (!endpoint || typeof endpoint !== 'string' || !endpoint.trim()) {
    return {};
  }
  const trimmed = endpoint.trim();
  const certDir = getCertDir(getConfigDirForPaths(), await config.getDeveloperId());
  const { certPath, keyPath, caPath } = devTlsCertPaths(certDir);
  const fs = require('fs');
  const skipVerify = await config.getDockerTlsSkipVerify();
  const hasClient = fs.existsSync(certPath) && fs.existsSync(keyPath);
  const hasCa = fs.existsSync(caPath);

  if (!hasClient) {
    if (!skipVerify) throw missingClientTlsError(trimmed, certDir);
    return { DOCKER_HOST: trimmed, DOCKER_TLS_VERIFY: '0' };
  }
  if (!hasCa && !skipVerify) throw missingCaError(trimmed, certDir);
  const verifyDaemon = hasCa;
  return {
    DOCKER_HOST: trimmed,
    DOCKER_TLS_VERIFY: verifyDaemon ? '1' : '0',
    DOCKER_CERT_PATH: certDir
  };
}

/**
 * Full environment for child_process exec/spawn: process.env merged with remote Docker vars when configured.
 * @returns {Promise<Object>}
 */
async function getDockerExecEnv() {
  const overlay = await getRemoteDockerEnv();
  const merged = { ...process.env };
  if (overlay.DOCKER_HOST && !Object.prototype.hasOwnProperty.call(overlay, 'DOCKER_CERT_PATH')) {
    delete merged.DOCKER_CERT_PATH;
  }
  return { ...merged, ...overlay };
}

module.exports = { getRemoteDockerEnv, getDockerExecEnv };
