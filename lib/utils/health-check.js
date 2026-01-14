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
const net = require('net');
const chalk = require('chalk');
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('./logger');

const execAsync = promisify(exec);

/**
 * Checks if db-init container exists and waits for it to complete
 * @async
 * @function waitForDbInit
 * @param {string} appName - Application name
 * @throws {Error} If db-init fails
 */
/**
 * Checks if db-init container exists
 * @async
 * @function checkDbInitContainerExists
 * @param {string} dbInitContainer - Container name
 * @returns {Promise<boolean>} True if container exists
 */
async function checkDbInitContainerExists(dbInitContainer) {
  try {
    const { stdout } = await execAsync(`docker ps -a --filter "name=${dbInitContainer}" --format "{{.Names}}"`);
    return stdout.trim() === dbInitContainer;
  } catch {
    return false;
  }
}

/**
 * Gets container exit code
 * @async
 * @function getContainerExitCode
 * @param {string} dbInitContainer - Container name
 * @returns {Promise<string>} Exit code
 */
async function getContainerExitCode(dbInitContainer) {
  const { stdout: exitCode } = await execAsync(`docker inspect --format='{{.State.ExitCode}}' ${dbInitContainer}`);
  return exitCode.trim();
}

/**
 * Handles exited container status
 * @async
 * @function handleExitedContainer
 * @param {string} dbInitContainer - Container name
 * @returns {Promise<boolean>} True if handled (container already exited)
 */
async function handleExitedContainer(dbInitContainer) {
  const { stdout: status } = await execAsync(`docker inspect --format='{{.State.Status}}' ${dbInitContainer}`);
  if (status.trim() === 'exited') {
    const exitCode = await getContainerExitCode(dbInitContainer);
    if (exitCode === '0') {
      logger.log(chalk.green('✓ Database initialization already completed'));
    } else {
      logger.log(chalk.yellow(`⚠ Database initialization exited with code ${exitCode}`));
    }
    return true;
  }
  return false;
}

/**
 * Waits for container to exit
 * @async
 * @function waitForContainerExit
 * @param {string} dbInitContainer - Container name
 * @param {number} maxAttempts - Maximum attempts
 */
async function waitForContainerExit(dbInitContainer, maxAttempts) {
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const { stdout: currentStatus } = await execAsync(`docker inspect --format='{{.State.Status}}' ${dbInitContainer}`);
    if (currentStatus.trim() === 'exited') {
      const exitCode = await getContainerExitCode(dbInitContainer);
      if (exitCode === '0') {
        logger.log(chalk.green('✓ Database initialization completed'));
      } else {
        logger.log(chalk.yellow(`⚠ Database initialization exited with code ${exitCode}`));
      }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function waitForDbInit(appName) {
  const dbInitContainer = `aifabrix-${appName}-db-init`;
  try {
    if (!(await checkDbInitContainerExists(dbInitContainer))) {
      return;
    }

    if (await handleExitedContainer(dbInitContainer)) {
      return;
    }

    logger.log(chalk.blue('Waiting for database initialization to complete...'));
    await waitForContainerExit(dbInitContainer, 30);
  } catch (error) {
    // db-init container might not exist, which is fine
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
  const { stdout: portMapping } = await execAsync(inspectCmd);
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
  const { stdout: psOutput } = await execAsync(psCmd);
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
    try {
      const urlObj = new URL(healthCheckUrl);
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

      // Declare timeoutId before creating req so it can be used in callbacks
      // eslint-disable-next-line prefer-const
      let timeoutId;

      const req = http.request(options, (res) => {
        clearTimeout(timeoutId);
        let data = '';
        if (debug) {
          logger.log(chalk.gray(`[DEBUG] Response status code: ${res.statusCode}`));
          logger.log(chalk.gray(`[DEBUG] Response headers: ${JSON.stringify(res.headers, null, 2)}`));
        }
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (debug) {
            const truncatedData = data.length > 200 ? data.substring(0, 200) + '...' : data;
            logger.log(chalk.gray(`[DEBUG] Response body: ${truncatedData}`));
          }
          const isHealthy = parseHealthResponse(data, res.statusCode);
          if (debug) {
            logger.log(chalk.gray(`[DEBUG] Health check result: ${isHealthy ? 'healthy' : 'unhealthy'}`));
          }
          resolve(isHealthy);
        });
      });

      // Set timeout for the request using setTimeout
      timeoutId = setTimeout(() => {
        if (debug) {
          logger.log(chalk.gray('[DEBUG] Health check request timeout after 5 seconds'));
        }
        req.destroy();
        resolve(false);
      }, 5000);

      req.on('error', (error) => {
        clearTimeout(timeoutId);
        if (debug) {
          logger.log(chalk.gray(`[DEBUG] Health check request error: ${error.message}`));
        }
        resolve(false);
      });

      req.end();
    } catch (error) {
      if (debug) {
        logger.log(chalk.gray(`[DEBUG] Health check exception: ${error.message}`));
      }
      // Re-throw exceptions (not just network errors)
      reject(error);
    }
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
  const healthCheckPath = config?.healthCheck?.path || '/health';
  const healthCheckUrl = `http://localhost:${healthCheckPort}${healthCheckPath}`;
  const maxAttempts = timeout / 2;

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Health check URL: ${healthCheckUrl}`));
    logger.log(chalk.gray(`[DEBUG] Timeout: ${timeout} seconds, Max attempts: ${maxAttempts}`));
  }

  return { healthCheckUrl, maxAttempts };
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
      logger.log(chalk.green('✓ Application is healthy'));
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

async function waitForHealthCheck(appName, timeout = 90, port = null, config = null, debug = false) {
  await waitForDbInit(appName);

  const healthCheckPort = await determineHealthCheckPort(port, appName, debug);
  const { healthCheckUrl, maxAttempts } = buildHealthCheckConfig(healthCheckPort, config, timeout, debug);

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const passed = await performHealthCheckAttempt(healthCheckUrl, attempts, maxAttempts, debug);
    if (passed) {
      return;
    }

    if (attempts < maxAttempts - 1) {
      logger.log(chalk.yellow(`Waiting for health check... (${attempts + 1}/${maxAttempts}) ${healthCheckUrl}`));
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
  checkPortAvailable
};

