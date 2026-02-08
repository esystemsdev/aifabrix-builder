/**
 * App logs command – show container env (masked) and docker logs for an app
 *
 * @fileoverview App logs command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const config = require('../core/config');
const containerHelpers = require('../utils/app-run-containers');
const { validateAppName } = require('../app/push');

const execAsync = promisify(exec);

/** Default number of log lines */
const DEFAULT_TAIL_LINES = 100;

/** Env key patterns that indicate a secret (mask value) */
const SECRET_KEY_PATTERN = /password|secret|token|credential|api[_-]?key/i;

/** Prefixes to strip before checking key (avoids masking KEYCLOAK_SERVER_URL etc.) */
const KEY_PREFIXES_TO_STRIP = /^KEYCLOAK_|^KEY_VAULT_/;

/** URL with embedded credentials: scheme://user:password@host → scheme://user:***@host */
const URL_CREDENTIAL_PATTERN = /(\w+:\/\/)([^:@]*):([^@]+)@/g;

/**
 * Masks a single env line if the key looks like a secret or value contains URL credentials
 * @param {string} line - Line in form KEY=value
 * @returns {string} Same line or KEY=*** or value with masked URL credentials
 */
function maskEnvLine(line) {
  const eq = line.indexOf('=');
  if (eq <= 0) return line;
  const key = line.slice(0, eq);
  const value = line.slice(eq + 1);

  const keyForCheck = key.replace(KEY_PREFIXES_TO_STRIP, '');
  const isSecretKey = SECRET_KEY_PATTERN.test(keyForCheck);

  const maskedValue = value.replace(URL_CREDENTIAL_PATTERN, '$1$2:***@');
  const hasUrlCredentials = maskedValue !== value;

  if (isSecretKey) return `${key}=***`;
  if (hasUrlCredentials) return `${key}=${maskedValue}`;
  return line;
}

/**
 * Dump container env (masked) and print to logger
 * @async
 * @param {string} containerName - Docker container name
 * @returns {Promise<void>}
 */
async function dumpMaskedEnv(containerName) {
  try {
    const { stdout } = await execAsync(`docker exec ${containerName} env`, { encoding: 'utf8', timeout: 5000 });
    const lines = stdout.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return;
    logger.log(chalk.bold('\n--- Environment (sensitive values masked) ---\n'));
    lines.sort((a, b) => {
      const keyA = a.indexOf('=') > 0 ? a.slice(0, a.indexOf('=')) : a;
      const keyB = b.indexOf('=') > 0 ? b.slice(0, b.indexOf('=')) : b;
      return keyA.localeCompare(keyB);
    });
    lines.forEach((line) => logger.log(maskEnvLine(line)));
    logger.log(chalk.gray('\n--- Logs ---\n'));
  } catch (err) {
    logger.log(chalk.gray('(Could not read container env; container may be stopped)\n'));
  }
}

/**
 * Run docker logs (non-follow): tail N lines or full (tail 0)
 * @async
 * @param {string} containerName - Docker container name
 * @param {Object} options - { tail: number } (0 = full, no limit)
 * @returns {Promise<void>}
 */
async function runDockerLogs(containerName, options) {
  const args = options.tail === 0 ? ['logs', containerName] : ['logs', '--tail', String(options.tail), containerName];
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`docker logs exited with ${code}`))));
  });
}

/**
 * Run docker logs --follow (stream), optionally with tail
 * @param {string} containerName - Docker container name
 * @param {number} [tail] - Lines to show (0 = full, omit --tail)
 */
function runDockerLogsFollow(containerName, tail) {
  const args = tail === 0 ? ['logs', '-f', containerName] : ['logs', '-f', '--tail', String(tail), containerName];
  const proc = spawn('docker', args, { stdio: 'inherit' });
  proc.on('error', (err) => {
    logger.log(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  });
  proc.on('close', (code) => {
    if (code !== 0 && code !== null) process.exit(code);
  });
}

/**
 * Run app logs command: optional env dump (masked), then docker logs
 * @async
 * @param {string} appKey - Application key (app name)
 * @param {Object} options - CLI options
 * @param {boolean} [options.follow] - Follow log stream (-f)
 * @param {number} [options.tail] - Number of lines (default 100; 0 = full list)
 * @returns {Promise<void>}
 */
async function runAppLogs(appKey, options = {}) {
  validateAppName(appKey);
  const developerId = await config.getDeveloperId();
  const containerName = containerHelpers.getContainerName(appKey, developerId);

  const follow = !!options.follow;
  const tail = typeof options.tail === 'number' ? options.tail : DEFAULT_TAIL_LINES;

  logger.log(chalk.blue(`Container: ${containerName}\n`));

  if (!follow) {
    await dumpMaskedEnv(containerName);
  }

  if (follow) {
    runDockerLogsFollow(containerName, tail);
    return;
  }

  try {
    await runDockerLogs(containerName, { tail });
  } catch (err) {
    logger.log(chalk.red(`Error: ${err.message}`));
    throw new Error(`Failed to show logs: ${err.message}`);
  }
}

module.exports = { runAppLogs, maskEnvLine };
