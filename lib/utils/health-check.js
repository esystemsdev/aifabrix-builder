const { formatSuccessLine } = require('./cli-test-layout-chalk');
/**
 * Health Check Utilities
 *
 * Handles health check functionality for application containers
 *
 * @fileoverview Health check utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const http = require('http');
const https = require('https');
const net = require('net');
const dns = require('dns');
const chalk = require('chalk');
const logger = require('./logger');
const { execWithDockerEnv } = require('./docker-exec');
const { computeTraefikHealthCheckUrl } = require('./health-check-url');
const { computePathActive } = require('./url-declarative-url-flags');
const { isFrontDoorRoutingEnabledInDoc } = require('./url-declarative-vdir-inactive-env');
const { waitForDbInit } = require('./health-check-db-init');
const {
  filterTraefikUrlByDns,
  logPublicHealthUrlWarningIfNeeded
} = require('./health-check-public-warn');

/**
 * Compute the health check URL for an app.
 *
 * - Default (path inactive): http://localhost:<port><healthPath> (e.g. Keycloak with KC_HTTP_RELATIVE_PATH=/)
 * - Path active (Traefik on ∧ frontDoorRouting.enabled): localhost probe uses same vdir as the container (e.g. /auth/health/ready)
 *
 * @async
 * @param {string} appName
 * @param {number} healthCheckPort
 * @param {Object|null} appConfig
 * @param {Object} opts
 * @param {Object} [opts.runOptions] - runApp options (may include env + effectiveEnvironmentScopedResources)
 * @param {boolean} [opts.skipTraefikPublicUrl] - Omit Traefik URL (localhost leg in dual-probe flow only).
 * @returns {Promise<string>}
 */
async function computeHealthCheckUrl(appName, healthCheckPort, appConfig, _opts = {}) {
  const rawHealthPath = appConfig?.healthCheck?.path || '/health';

  function computeLocalhostHealthPath() {
    // Plan 124 pathActive: prepend front-door pattern when Traefik on; keep bare /health for miso/dataplane style.
    try {
      const runOptions = _opts && typeof _opts === 'object' && _opts.runOptions ? _opts.runOptions : null;
      const traefikOn = Boolean(runOptions && runOptions.traefikEnabled === true);
      const fd = appConfig && appConfig.frontDoorRouting ? appConfig.frontDoorRouting : null;
      const pattern = fd && typeof fd.pattern === 'string' ? fd.pattern : null;
      const pathActive = computePathActive(traefikOn, isFrontDoorRoutingEnabledInDoc(appConfig || null));
      const shouldMount = pathActive && Boolean(pattern) && rawHealthPath !== '/health';
      if (!shouldMount) return rawHealthPath;
      const { joinUrlPath, normalizeFrontDoorPatternForHealth } = require('./health-check-url');
      const mountPath = normalizeFrontDoorPatternForHealth(pattern);
      return joinUrlPath(mountPath, rawHealthPath);
    } catch {
      return rawHealthPath;
    }
  }

  const localhostHealthPath = computeLocalhostHealthPath();

  // Local readiness probes localhost; optional Traefik URL is for display / dual-probe (see waitForHealthCheck).
  async function maybeGetTraefikUrl() {
    if (_opts && _opts.skipTraefikPublicUrl) return '';
    const runOptions = (_opts && typeof _opts === 'object') ? _opts.runOptions : null;
    const wantsTraefik =
      Boolean(runOptions) &&
      (runOptions.probeViaTraefik === true || runOptions.traefikEnabled === true);
    if (!wantsTraefik) return '';
    try {
      return await computeTraefikHealthCheckUrl(appName, healthCheckPort, appConfig);
    } catch {
      return '';
    }
  }

  const traefikUrl = await maybeGetTraefikUrl();
  if (traefikUrl) return traefikUrl;

  return `http://localhost:${healthCheckPort}${localhostHealthPath}`;
}

async function isHostnameResolvable(hostname, debug) {
  if (!hostname) return false;
  const hn = String(hostname).trim().toLowerCase();
  if (!hn) return false;
  if (hn === 'localhost' || hn === '127.0.0.1' || hn === '::1') return true;
  try {
    await dns.promises.lookup(hn);
    return true;
  } catch (err) {
    // ENOTFOUND: caller may log a single post-success warning with the full public health URL.
    if (debug && !(err && err.code === 'ENOTFOUND')) {
      logger.log(chalk.gray(`[DEBUG] DNS lookup failed for ${hostname}: ${err.message}`));
    }
    return false;
  }
}

/**
 * Gets container port from Docker inspect
 * @async
 * @function getContainerPort
 * @param {string} appName - Application name
 * @param {boolean} [debug=false] - Enable debug logging
 * @returns {Promise<number>} Container port
 */
/**
 * Gets port from docker inspect
 * @async
 * @function getPortFromDockerInspect
 * @param {string} appName - Application name
 * @param {boolean} debug - Debug flag
 * @returns {Promise<number|null>} Port number or null
 */
async function getPortFromDockerInspect(appName, debug) {
  const inspectCmd = `docker inspect --format='{{range $p, $conf := .NetworkSettings.Ports}}{{if $conf}}{{range $conf}}{{.HostPort}}{{end}}{{end}}{{end}}' aifabrix-${appName}`;
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Executing: ${inspectCmd}`));
  }
  const { stdout: portMapping } = await execWithDockerEnv(inspectCmd);
  const ports = portMapping.trim().split('\n').filter(p => p && p !== '');
  if (ports.length > 0) {
    const port = parseInt(ports[0], 10);
    if (!isNaN(port) && port > 0) {
      if (debug) {
        logger.log(chalk.gray(`[DEBUG] Detected port ${port} from docker inspect`));
      }
      return port;
    }
  }
  return null;
}

/**
 * Gets port from docker ps (fallback)
 * @async
 * @function getPortFromDockerPs
 * @param {string} appName - Application name
 * @param {boolean} debug - Debug flag
 * @returns {Promise<number|null>} Port number or null
 */
async function getPortFromDockerPs(appName, debug) {
  const psCmd = `docker ps --filter "name=aifabrix-${appName}" --format "{{.Ports}}"`;
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Fallback: Executing: ${psCmd}`));
  }
  const { stdout: psOutput } = await execWithDockerEnv(psCmd);
  const portMatch = psOutput.match(/:(\d+)->/);
  if (!portMatch) {
    return null;
  }
  const port = parseInt(portMatch[1], 10);
  if (isNaN(port) || port <= 0) {
    return null;
  }
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Detected port ${port} from docker ps`));
  }
  return port;
}

async function getContainerPort(appName, debug = false) {
  try {
    const port = await getPortFromDockerInspect(appName, debug);
    if (port !== null) {
      return port;
    }

    // Fallback: try docker ps
    try {
      return await getPortFromDockerPs(appName, debug);
    } catch (error) {
      if (debug) {
        logger.log(chalk.gray(`[DEBUG] Fallback port detection failed: ${error.message}`));
      }
    }
  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Port detection failed: ${error.message}`));
    }
  }
  if (debug) {
    logger.log(chalk.gray('[DEBUG] Using default port 3000'));
  }
  return 3000;
}

/**
 * Parses health check response
 * @function parseHealthResponse
 * @param {string} data - Response data
 * @param {number} statusCode - HTTP status code
 * @returns {boolean} True if healthy
 */
function parseHealthResponse(data, statusCode) {
  try {
    const health = JSON.parse(data);
    if (health.status === 'UP') {
      return true;
    }
    if (health.status === 'ok') {
      return health.database === 'connected' || !health.database;
    }
    if (health.status === 'healthy') {
      return true;
    }
    if (health.success === true) {
      return true;
    }
    return false;
  } catch (error) {
    return statusCode === 200;
  }
}

function handleHealthResponse(res, data, debug, resolve) {
  const isHealthy = parseHealthResponse(data, res.statusCode);
  if (debug) {
    const truncatedData = data.length > 200 ? data.substring(0, 200) + '...' : data;
    logger.log(chalk.gray(`[DEBUG] Response body: ${truncatedData}`));
    logger.log(chalk.gray(`[DEBUG] Health check result: ${isHealthy ? 'healthy' : 'unhealthy'}`));
  }
  resolve(isHealthy);
}

function doHealthCheckRequest(healthCheckUrl, debug, resolve, reject) {
  try {
    const urlObj = new URL(healthCheckUrl);
    const transport = urlObj.protocol === 'https:' ? https : http;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET'
    };
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Health check request: ${healthCheckUrl}`));
      logger.log(chalk.gray(`[DEBUG] Request options: ${JSON.stringify(options, null, 2)}`));
    }
    const timer = { id: null };
    const req = transport.request(options, (res) => {
      clearTimeout(timer.id);
      let data = '';
      if (debug) {
        logger.log(chalk.gray(`[DEBUG] Response status code: ${res.statusCode}`));
        logger.log(chalk.gray(`[DEBUG] Response headers: ${JSON.stringify(res.headers, null, 2)}`));
      }
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => handleHealthResponse(res, data, debug, resolve));
    });
    timer.id = setTimeout(() => {
      if (debug) logger.log(chalk.gray('[DEBUG] Health check request timeout after 5 seconds'));
      req.destroy();
      resolve(false);
    }, 5000);
    req.on('error', (error) => {
      clearTimeout(timer.id);
      if (debug) logger.log(chalk.gray(`[DEBUG] Health check request error: ${error.message}`));
      resolve(false);
    });
    req.end();
  } catch (error) {
    if (debug) logger.log(chalk.gray(`[DEBUG] Health check exception: ${error.message}`));
    reject(error);
  }
}

/**
 * Checks health endpoint
 * @async
 * @function checkHealthEndpoint
 * @param {string} healthCheckUrl - Health check URL
 * @param {boolean} [debug=false] - Enable debug logging
 * @returns {Promise<boolean>} True if healthy
 * @throws {Error} If request fails with exception
 */
async function checkHealthEndpoint(healthCheckUrl, debug = false) {
  return new Promise((resolve, reject) => {
    doHealthCheckRequest(healthCheckUrl, debug, resolve, reject);
  });
}

/**
 * Waits for application health check to pass
 * Checks HTTP endpoint and waits for healthy response
 *
 * @async
 * @function waitForHealthCheck
 * @param {string} appName - Application name
 * @param {number} timeout - Timeout in seconds (default: 90)
 * @param {number} [port] - Application port (auto-detected if not provided)
 * @param {Object} [config] - Application configuration
 * @param {boolean} [debug=false] - Enable debug logging
 * @returns {Promise<void>} Resolves when health check passes
 * @throws {Error} If health check times out
 */
/**
 * Determines health check port
 * @async
 * @function determineHealthCheckPort
 * @param {number|null} port - Provided port
 * @param {string} appName - Application name
 * @param {boolean} debug - Debug flag
 * @returns {Promise<number>} Health check port
 */
async function determineHealthCheckPort(port, appName, debug) {
  const healthCheckPort = port !== null && port !== undefined ? port : await getContainerPort(appName, debug);
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Health check port: ${healthCheckPort} (${port !== null && port !== undefined ? 'provided' : 'auto-detected'})`));
  }
  return healthCheckPort;
}

/**
 * Builds health check configuration
 * @function buildHealthCheckConfig
 * @param {number} healthCheckPort - Health check port
 * @param {Object|null} config - Configuration object
 * @param {number} timeout - Timeout in seconds
 * @param {boolean} debug - Debug flag
 * @returns {Object} Health check configuration
 */
function buildHealthCheckConfig(healthCheckPort, config, timeout, debug) {
  const maxAttempts = timeout / 2;

  // URL is computed later (may use Traefik public base).
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Timeout: ${timeout} seconds, Max attempts: ${maxAttempts}`));
  }

  return { maxAttempts };
}

/**
 * Performs a single health check attempt
 * @async
 * @function performHealthCheckAttempt
 * @param {string} healthCheckUrl - Health check URL
 * @param {number} attempt - Attempt number
 * @param {number} maxAttempts - Maximum attempts
 * @param {boolean} debug - Debug flag
 * @returns {Promise<boolean>} True if health check passed
 */
async function performHealthCheckAttempt(healthCheckUrl, attempt, maxAttempts, debug) {
  try {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Health check attempt ${attempt + 1}/${maxAttempts}`));
    }
    const healthCheckPassed = await checkHealthEndpoint(healthCheckUrl, debug);
    if (healthCheckPassed) {
      logger.log(formatSuccessLine('Application is healthy'));
      if (debug) {
        logger.log(chalk.gray(`[DEBUG] Health check passed after ${attempt + 1} attempt(s)`));
      }
      return true;
    }
  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Health check exception on attempt ${attempt + 1}: ${error.message}`));
    }
  }
  return false;
}

async function computePreferredHealthCheckUrls(appName, healthCheckPort, config, runOptions, debug) {
  const localhostUrl = await computeHealthCheckUrl(appName, healthCheckPort, config, {
    runOptions: runOptions && typeof runOptions === 'object' ? runOptions : {},
    skipTraefikPublicUrl: true
  });

  let traefikUrl = '';
  /** Full Traefik/public health URL when DNS fails — used for one post-success warning. */
  let skippedPublicHealthUrl = '';
  const wantsTraefikFirst = Boolean(
    runOptions && (runOptions.probeViaTraefik === true || runOptions.traefikEnabled === true)
  );
  if (wantsTraefikFirst) {
    try {
      traefikUrl = await computeTraefikHealthCheckUrl(appName, healthCheckPort, config);
    } catch {
      traefikUrl = '';
    }
  }

  const filtered = await filterTraefikUrlByDns(traefikUrl, debug, isHostnameResolvable);
  traefikUrl = filtered.traefikUrl;
  skippedPublicHealthUrl = filtered.skippedPublicHealthUrl;

  const urlsToTry = traefikUrl ? [traefikUrl, localhostUrl] : [localhostUrl];
  if (urlsToTry.length > 1) {
    logger.log(
      chalk.gray(
        `ℹ Health check order: Traefik/DNS (${urlsToTry[0]}), then localhost (${urlsToTry[1]}).`
      )
    );
  }
  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Health check URLs: ${urlsToTry.join(' | ')}`));
  }
  return { urlsToTry, skippedPublicHealthUrl };
}

async function performHealthCheckAttemptForUrls(urlsToTry, attempt, maxAttempts, debug) {
  for (let i = 0; i < urlsToTry.length; i++) {
    const url = urlsToTry[i];
    const passed = await performHealthCheckAttempt(url, attempt, maxAttempts, debug);
    if (passed) {
      return { ok: true, resolvedIndex: i };
    }
  }
  return { ok: false, resolvedIndex: -1 };
}

async function waitForHealthCheck(appName, timeout = 90, port = null, config = null, debug = false, runOptions = {}) {
  await waitForDbInit(appName);

  const healthCheckPort = await determineHealthCheckPort(port, appName, debug);
  const { maxAttempts } = buildHealthCheckConfig(healthCheckPort, config, timeout, debug);
  const { urlsToTry, skippedPublicHealthUrl } = await computePreferredHealthCheckUrls(
    appName,
    healthCheckPort,
    config,
    runOptions,
    debug
  );

  if (skippedPublicHealthUrl && urlsToTry.length === 1) {
    logger.log(
      chalk.gray(
        `ℹ Health check: public URL not used (DNS): ${skippedPublicHealthUrl}. ` +
          `Probing ${urlsToTry[0]} only until the app responds.`
      )
    );
  }

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const attemptResult = await performHealthCheckAttemptForUrls(urlsToTry, attempts, maxAttempts, debug);
    if (attemptResult.ok) {
      logPublicHealthUrlWarningIfNeeded({
        skippedPublicHealthUrl,
        urlsToTry,
        resolvedIndex: attemptResult.resolvedIndex
      });
      return;
    }

    if (attempts < maxAttempts - 1) {
      const probeHint =
        urlsToTry.length > 1
          ? `trying ${urlsToTry[0]}, then ${urlsToTry[1]}`
          : (urlsToTry[0] || 'health URL');
      logger.log(
        chalk.yellow(`Waiting for health check… (${attempts + 1}/${maxAttempts}) (${probeHint})`)
      );
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Health check failed after ${maxAttempts} attempts`));
  }
  throw new Error(`Health check timeout after ${timeout} seconds`);
}

/**
 * Checks if port is available
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} True if port is available
 */
async function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });
}

module.exports = {
  waitForHealthCheck,
  checkHealthEndpoint,
  checkPortAvailable,
  computeHealthCheckUrl,
  // Re-exported for tests and shared usage.
  normalizeFrontDoorPatternForHealth: require('./health-check-url').normalizeFrontDoorPatternForHealth
};

