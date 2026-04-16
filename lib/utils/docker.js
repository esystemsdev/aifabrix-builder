/**
 * Docker CLI Utilities
 *
 * Detects availability of Docker and determines the correct Docker Compose command
 * across environments (Compose v2 plugin: "docker compose", Compose v1: "docker-compose").
 * Uses docker-endpoint from dev config when set (see remote-docker-env / docker-exec).
 *
 * @fileoverview Docker/Compose detection helpers for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { execWithDockerEnv } = require('./docker-exec');

/** Env override: full compose CLI prefix, e.g. `docker compose` or `docker-compose` (validated with version). */
const COMPOSE_CMD_ENV = 'AIFABRIX_COMPOSE_CMD';

/**
 * Short string from exec failure (message + stderr) for user-visible errors.
 * @param {unknown} err - Rejected error from exec
 * @returns {string}
 */
function formatExecFailure(err) {
  if (!err) return '';
  const e = err;
  const msg = typeof e.message === 'string' ? e.message.trim() : '';
  const stderr = typeof e.stderr === 'string' ? e.stderr.trim() : '';
  const combined = [msg, stderr].filter(Boolean).join(' ').trim();
  if (!combined) return '';
  return combined.length > 280 ? `${combined.slice(0, 277)}...` : combined;
}

/**
 * Hint when docker compose likely failed talking to a remote TLS daemon, not missing plugin.
 * @param {string} detail - formatExecFailure output
 * @returns {string}
 */
function remoteTlsComposeHint(detail) {
  const d = detail.toLowerCase();
  if (!d) return '';
  const tlsish =
    d.includes('tls') ||
    d.includes('certificate') ||
    d.includes('x509') ||
    d.includes('cert') ||
    d.includes('connection refused') ||
    d.includes('2376') ||
    d.includes('eof') ||
    d.includes('handshake');
  if (!tlsish) return '';
  return (
    ' This often means docker-endpoint TLS/client auth failed (place cert.pem, key.pem, ca.pem in ~/.aifabrix/certs/<developer-id>/, or set docker-tls-skip-verify only if appropriate), not a missing Compose plugin.'
  );
}

/**
 * @param {string} composeV2Failure - formatExecFailure from docker compose version
 */
function throwComposeCommandUnavailable(composeV2Failure) {
  const v2bit = composeV2Failure
    ? ` "docker compose version" failed: ${composeV2Failure}.${remoteTlsComposeHint(composeV2Failure)} `
    : ' ';
  throw new Error(
    'Docker Compose is not available. Tried: "docker compose", "docker-compose", "podman compose".' +
      v2bit +
      'Install the Compose v2 plugin (needs only the docker CLI + plugin; no unix socket required when docker-endpoint is set). ' +
      'Example: sudo apt-get install -y docker-compose-plugin. ' +
      `Or set ${COMPOSE_CMD_ENV} to a working compose prefix. ` +
      'up-infra uses the Docker CLI as a client to the Engine API (remote tcp://…:2376 is OK); there is no separate Builder-only compose API.'
  );
}

/**
 * Checks that Docker CLI is available.
 * @async
 * @function checkDockerCli
 * @returns {Promise<void>} Resolves if docker is available
 * @throws {Error} If docker is unavailable
 */
async function checkDockerCli() {
  await execWithDockerEnv('docker --version');
}

/**
 * @returns {Promise<string|null>} Resolved compose command prefix from env override, or null to auto-detect
 */
async function resolveComposeCmdOverride() {
  const override =
    typeof process.env[COMPOSE_CMD_ENV] === 'string' ? process.env[COMPOSE_CMD_ENV].trim() : '';
  if (!override) return null;
  try {
    await execWithDockerEnv(`${override} version`);
    return override;
  } catch {
    try {
      await execWithDockerEnv(`${override} --version`);
      return override;
    } catch (err) {
      throw new Error(
        `${COMPOSE_CMD_ENV}="${override}" is set but failed (tried "version" and "--version"): ${err.message}`
      );
    }
  }
}

/**
 * Determines the correct Docker Compose command on this system.
 * Tries Docker Compose v2 plugin first: "docker compose", then falls back to v1: "docker-compose".
 *
 * @async
 * @function getComposeCommand
 * @returns {Promise<string>} The compose command to use ("docker compose" or "docker-compose")
 * @throws {Error} If neither v2 nor v1 is available
 */
async function getComposeCommand() {
  const fromEnv = await resolveComposeCmdOverride();
  if (fromEnv) return fromEnv;

  let composeV2Failure = '';
  try {
    await execWithDockerEnv('docker compose version');
    return 'docker compose';
  } catch (e) {
    composeV2Failure = formatExecFailure(e);
  }

  try {
    await execWithDockerEnv('docker-compose --version');
    return 'docker-compose';
  } catch (_) {
    // Podman with compose (some hosts use podman-docker + podman compose)
  }

  try {
    await execWithDockerEnv('podman compose version');
    return 'podman compose';
  } catch (_) {
    throwComposeCommandUnavailable(composeV2Failure);
  }
}

/**
 * Ensures Docker and Docker Compose are available, returning the compose command to use.
 * @async
 * @function ensureDockerAndCompose
 * @returns {Promise<string>} The compose command to use
 * @throws {Error} If docker or compose is not available
 */
async function ensureDockerAndCompose() {
  await checkDockerCli();
  return await getComposeCommand();
}

module.exports = {
  checkDockerCli,
  getComposeCommand,
  ensureDockerAndCompose
};
