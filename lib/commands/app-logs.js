/**
 * App logs command – show container env (masked) and docker logs for an app
 *
 * @fileoverview App logs command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { exec, spawn } = require('child_process');
const readline = require('readline');
const { promisify } = require('util');
const logger = require('../utils/logger');
const config = require('../core/config');
const containerHelpers = require('../utils/app-run-containers');
const { validateAppName } = require('../app/push');

const execAsync = promisify(exec);

/** Default number of log lines */
const DEFAULT_TAIL_LINES = 100;

/** Allowed log levels for --level filter (lowest to highest severity) */
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

/** Severity rank: higher = more severe. Used for "show this level and above". */
const LEVEL_RANK = { debug: 0, info: 1, warn: 2, error: 3 };

/** Prefix pattern: INFO:, ERROR:, WARN:, WARNING:, DEBUG: at start of line */
const LEVEL_PREFIX_REGEX = /^(DEBUG|INFO|WARN|WARNING|ERROR)\s*[:-\s]/i;

/** Level after timestamp or space (e.g. "2026-02-11 08:51:01 error: msg" or "  error: msg") */
const LEVEL_AFTER_PREFIX_REGEX = /(?:^|\s)(DEBUG|INFO|WARN|WARNING|ERROR)\s*:/i;

/** Level after word boundary (e.g. "[pino]error: msg" or BOM + "error:") so "error:" is detected anywhere */
const LEVEL_WORD_BOUNDARY_REGEX = /\b(DEBUG|INFO|WARN|WARNING|ERROR)\s*:/i;

/** JSON "level" field pattern (string: "error", "info", etc.) */
const LEVEL_JSON_REGEX = /"level"\s*:\s*"(\w+)"/i;

/** JSON "level" numeric (pino/bunyan: 50=error, 60=fatal, 40=warn, 30=info, 20=debug, 10=trace) */
const LEVEL_JSON_NUMERIC_REGEX = /"level"\s*:\s*(\d+)/;

/** Fallback: line contains whole-word "error" or "Error" when no other level detected (catches stack traces, "Error: msg", etc.) */
const ERROR_WORD_FALLBACK_REGEX = /\berror\b/i;

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

/** Normalize level string to canonical 'debug'|'info'|'warn'|'error'. */
function normalizeLevel(raw) {
  const s = (raw || '').toLowerCase();
  return s === 'warning' ? 'warn' : s;
}

/** Map pino/bunyan numeric level (10–60) to level string. */
function numericLevelToName(num) {
  if (num >= 50) return 'error';
  if (num >= 40) return 'warn';
  if (num >= 30) return 'info';
  return 'debug';
}

/**
 * Extract log level from a line (prefix like INFO:/error: or JSON "level":"info").
 * Supports: INFO:, ERROR:, error:, info: (miso-controller/pino), WARN:, DEBUG:, and "level":"x" in JSON.
 * @param {string} line - Single log line
 * @returns {string|null} One of 'debug'|'info'|'warn'|'error', or null if not parseable
 */
function getLogLevel(line) {
  if (!line || typeof line !== 'string') return null;
  const prefixRe = [LEVEL_PREFIX_REGEX, LEVEL_AFTER_PREFIX_REGEX, LEVEL_WORD_BOUNDARY_REGEX, LEVEL_JSON_REGEX];
  for (const re of prefixRe) {
    const m = line.match(re);
    if (m) return normalizeLevel(m[1]);
  }
  const jsonNum = line.match(LEVEL_JSON_NUMERIC_REGEX);
  if (jsonNum) return numericLevelToName(parseInt(jsonNum[1], 10));
  if (ERROR_WORD_FALLBACK_REGEX.test(line)) return 'error';
  return null;
}

/**
 * Whether a line's level passes the minimum level filter (show this level and above).
 * @param {string|null} lineLevel - Level from getLogLevel (null treated as 'info')
 * @param {string|undefined|null} minLevel - Minimum level (e.g. 'error', 'info')
 * @returns {boolean} True if line should be shown
 */
function passesLevelFilter(lineLevel, minLevel) {
  if (minLevel === null || minLevel === undefined || minLevel === '') return true;
  const normalized = (minLevel || '').toString().trim().toLowerCase();
  if (!LOG_LEVELS.includes(normalized)) return true;
  const lineRank =
    lineLevel === null || lineLevel === undefined ? LEVEL_RANK.info : (LEVEL_RANK[lineLevel] ?? LEVEL_RANK.info);
  const minRank = LEVEL_RANK[normalized];
  return lineRank >= minRank;
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
 * Run docker logs (non-follow): tail N lines or full (tail 0). If options.level is set, stdout is piped and filtered.
 * @async
 * @param {string} containerName - Docker container name
 * @param {Object} options - { tail: number, level?: string }
 * @returns {Promise<void>}
 */
async function runDockerLogs(containerName, options) {
  const args = options.tail === 0 ? ['logs', containerName] : ['logs', '--tail', String(options.tail), containerName];
  const minLevel =
    options.level !== undefined && options.level !== null && options.level !== ''
      ? String(options.level).trim().toLowerCase()
      : null;

  if (minLevel === null || minLevel === undefined || !LOG_LEVELS.includes(minLevel)) {
    return new Promise((resolve, reject) => {
      const proc = spawn('docker', args, { stdio: 'inherit' });
      proc.on('error', reject);
      proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`docker logs exited with ${code}`))));
    });
  }

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', args, { stdio: ['inherit', 'pipe', 'pipe'] });
    proc.on('error', reject);

    function onLine(line) {
      if (passesLevelFilter(getLogLevel(line), minLevel)) {
        process.stdout.write(line + '\n');
      }
    }

    const rlOut = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
    rlOut.on('line', onLine);
    const rlErr = readline.createInterface({ input: proc.stderr, crlfDelay: Infinity });
    rlErr.on('line', onLine);

    let streamsClosed = 0;
    let exitCode = null;
    function tryFinish() {
      if (streamsClosed < 2 || exitCode === null) return;
      if (exitCode !== 0) reject(new Error(`docker logs exited with ${exitCode}`));
      else resolve();
    }
    rlOut.on('close', () => {
      streamsClosed += 1;
      tryFinish();
    });
    rlErr.on('close', () => {
      streamsClosed += 1;
      tryFinish();
    });
    proc.on('close', (code) => {
      exitCode = code;
      tryFinish();
    });
  });
}

/**
 * Run docker logs --follow (stream), optionally with tail. If minLevel is set, stdout is piped and filtered.
 * @param {string} containerName - Docker container name
 * @param {number} [tail] - Lines to show (0 = full, omit --tail)
 * @param {string|null} [minLevel] - Minimum log level to show (debug|info|warn|error)
 */
function runDockerLogsFollow(containerName, tail, minLevel) {
  const args = tail === 0 ? ['logs', '-f', containerName] : ['logs', '-f', '--tail', String(tail), containerName];
  const level =
    minLevel !== undefined && minLevel !== null && minLevel !== ''
      ? String(minLevel).trim().toLowerCase()
      : null;
  const useFilter = level !== null && level !== undefined && LOG_LEVELS.includes(level);

  if (!useFilter) {
    const proc = spawn('docker', args, { stdio: 'inherit' });
    proc.on('error', (err) => {
      logger.log(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    });
    proc.on('close', (code) => {
      if (code !== 0 && code !== null) process.exit(code);
    });
    return;
  }

  const proc = spawn('docker', args, { stdio: ['inherit', 'pipe', 'pipe'] });
  proc.on('error', (err) => {
    logger.log(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  });
  function onLine(line) {
    if (passesLevelFilter(getLogLevel(line), level)) process.stdout.write(line + '\n');
  }
  const rlOut = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
  rlOut.on('line', onLine);
  const rlErr = readline.createInterface({ input: proc.stderr, crlfDelay: Infinity });
  rlErr.on('line', onLine);
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
 * @param {string} [options.level] - Show only logs at this level or above (debug|info|warn|error)
 * @returns {Promise<void>}
 */
async function runAppLogs(appKey, options = {}) {
  validateAppName(appKey);
  const rawLevel =
    options.level !== undefined && options.level !== null && options.level !== ''
      ? String(options.level).trim()
      : undefined;
  const level = rawLevel ? rawLevel.toLowerCase() : undefined;
  if (level !== undefined && level !== null && !LOG_LEVELS.includes(level)) {
    throw new Error(
      `Invalid log level '${rawLevel}'; use one of: ${LOG_LEVELS.join(', ')}`
    );
  }

  const developerId = await config.getDeveloperId();
  const containerName = containerHelpers.getContainerName(appKey, developerId);

  const follow = !!options.follow;
  const tail = typeof options.tail === 'number' ? options.tail : DEFAULT_TAIL_LINES;

  logger.log(chalk.blue(`Container: ${containerName}\n`));

  if (!follow) {
    await dumpMaskedEnv(containerName);
  }

  if (follow) {
    runDockerLogsFollow(containerName, tail, level);
    return;
  }

  try {
    await runDockerLogs(containerName, { tail, level });
  } catch (err) {
    logger.log(chalk.red(`Error: ${err.message}`));
    throw new Error(`Failed to show logs: ${err.message}`);
  }
}

module.exports = { runAppLogs, maskEnvLine, getLogLevel, passesLevelFilter };
