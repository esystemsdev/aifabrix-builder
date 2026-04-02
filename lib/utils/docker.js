/**
 * Docker CLI Utilities
 *
 * Detects availability of Docker and determines the correct Docker Compose command
 * across environments (Compose v2 plugin: "docker compose", Compose v1: "docker-compose").
 *
 * @fileoverview Docker/Compose detection helpers for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/** Env override: full compose CLI prefix, e.g. `docker compose` or `docker-compose` (validated with version). */
const COMPOSE_CMD_ENV = 'AIFABRIX_COMPOSE_CMD';

/**
 * Checks that Docker CLI is available.
 * @async
 * @function checkDockerCli
 * @returns {Promise<void>} Resolves if docker is available
 * @throws {Error} If docker is unavailable
 */
async function checkDockerCli() {
  await execAsync('docker --version');
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
  const override =
    typeof process.env[COMPOSE_CMD_ENV] === 'string' ? process.env[COMPOSE_CMD_ENV].trim() : '';
  if (override) {
    try {
      await execAsync(`${override} version`);
      return override;
    } catch {
      try {
        await execAsync(`${override} --version`);
        return override;
      } catch (err) {
        throw new Error(
          `${COMPOSE_CMD_ENV}="${override}" is set but failed (tried "version" and "--version"): ${err.message}`
        );
      }
    }
  }

  // Prefer Compose v2 plugin if present
  try {
    await execAsync('docker compose version');
    return 'docker compose';
  } catch (_) {
    // Fall back to legacy docker-compose
  }

  try {
    await execAsync('docker-compose --version');
    return 'docker-compose';
  } catch (_) {
    // Podman with compose (some hosts use podman-docker + podman compose)
  }

  try {
    await execAsync('podman compose version');
    return 'podman compose';
  } catch (_) {
    throw new Error(
      'Docker Compose is not available. Tried: "docker compose", "docker-compose", "podman compose". ' +
        'On Ubuntu/Debian with Docker Engine: sudo apt-get install -y docker-compose-plugin && docker compose version. ' +
        `Or set ${COMPOSE_CMD_ENV} to your compose command prefix (e.g. docker compose).`
    );
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

