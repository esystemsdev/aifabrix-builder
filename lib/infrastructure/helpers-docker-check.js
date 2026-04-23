/**
 * @fileoverview Docker / Compose availability check and user-facing failure text for infra helpers.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const dockerUtils = require('../utils/docker');
const { ensureDevCertsIfNeededForRemoteDocker } = require('../utils/ensure-dev-certs-for-remote-docker');

/**
 * User-facing error when Docker/Compose checks fail (tailored by underlying message).
 * @param {string} detail - Error message from ensureDockerAndCompose / Docker CLI
 * @returns {string}
 */
function formatDockerInfrastructureFailure(detail) {
  const cause = (detail || '').trim() || 'unknown error';

  if (/Docker Compose is not available/i.test(cause)) {
    return (
      'Cannot use Docker for infrastructure: Docker Compose check failed (see Cause below).\n\n' +
      `Cause: ${cause}\n\n` +
      'If Cause mentions TLS, certificate, or handshake, fix client TLS for docker-endpoint (cert.pem, key.pem, ca.pem under ~/.aifabrix/certs/<developer-id>/) or docker-tls-skip-verify when appropriate. ' +
      'If Cause suggests a missing plugin, install Docker Compose v2 for your user (docker CLI + plugin; no unix socket needed when using tcp:// docker-endpoint). ' +
      'Or set AIFABRIX_COMPOSE_CMD. Run `aifabrix doctor` for diagnostics.'
    );
  }

  if (/AIFABRIX_COMPOSE_CMD/i.test(cause) && /is set but failed/i.test(cause)) {
    return (
      'Cannot use Docker for infrastructure: AIFABRIX_COMPOSE_CMD failed.\n\n' +
      `Cause: ${cause}\n\n` +
      'Unset or fix AIFABRIX_COMPOSE_CMD, or install a working Compose. Run `aifabrix doctor` for diagnostics.'
    );
  }

  return (
    'Cannot use Docker for infrastructure (Docker CLI missing, Compose missing, or remote Docker misconfigured).\n\n' +
    `Cause: ${cause}\n\n` +
    'Install Docker Engine and Compose on this machine (or set AIFABRIX_COMPOSE_CMD). ' +
    'If you use docker-endpoint in dev config: install cert.pem, key.pem, and ca.pem for full TLS verify; use `aifabrix dev pin` / ' +
    '`dev init --pin` as needed; or enable TLS skip-verify (config or AIFABRIX_DOCKER_TLS_SKIP_VERIFY) when appropriate. ' +
    'Run `aifabrix doctor` for diagnostics.'
  );
}

/**
 * Check Docker availability (local daemon or remote via docker-endpoint + TLS).
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If Docker/Compose cannot be used (includes underlying cause)
 */
async function checkDockerAvailability() {
  await ensureDevCertsIfNeededForRemoteDocker();
  try {
    await dockerUtils.ensureDockerAndCompose();
  } catch (error) {
    const detail = (error && error.message) || String(error);
    throw new Error(formatDockerInfrastructureFailure(detail));
  }
}

module.exports = {
  formatDockerInfrastructureFailure,
  checkDockerAvailability
};
