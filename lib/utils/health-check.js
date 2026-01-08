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
async function waitForDbInit(appName) {
  const dbInitContainer = `aifabrix-${appName}-db-init`;
  try {
    const { stdout } = await execAsync(`docker ps -a --filter "name=${dbInitContainer}" --format "{{.Names}}"`);
    if (stdout.trim() !== dbInitContainer) {
      return;
    }

    const { stdout: status } = await execAsync(`docker inspect --format='{{.State.Status}}' ${dbInitContainer}`);
    if (status.trim() === 'exited') {
      const { stdout: exitCode } = await execAsync(`docker inspect --format='{{.State.ExitCode}}' ${dbInitContainer}`);
      if (exitCode.trim() === '0') {
        logger.log(chalk.green('✓ Database initialization already completed'));
      } else {
        logger.log(chalk.yellow(`⚠ Database initialization exited with code ${exitCode.trim()}`));
      }
      return;
    }

    logger.log(chalk.blue('Waiting for database initialization to complete...'));
    const maxDbInitAttempts = 30;
    for (let dbInitAttempts = 0; dbInitAttempts < maxDbInitAttempts; dbInitAttempts++) {
      const { stdout: currentStatus } = await execAsync(`docker inspect --format='{{.State.Status}}' ${dbInitContainer}`);
      if (currentStatus.trim() === 'exited') {
        const { stdout: exitCode } = await execAsync(`docker inspect --format='{{.State.ExitCode}}' ${dbInitContainer}`);
        if (exitCode.trim() === '0') {
          logger.log(chalk.green('✓ Database initialization completed'));
        } else {
          logger.log(chalk.yellow(`⚠ Database initialization exited with code ${exitCode.trim()}`));
        }
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
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
async function getContainerPort(appName, debug = false) {
  try {
    // Try to get the actual mapped host port from Docker
    // First try docker inspect for the container port mapping
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

    // Fallback: try docker ps to get port mapping (format: "0.0.0.0:3010->3000/tcp")
    try {
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
    } catch (error) {
      if (debug) {
        logger.log(chalk.gray(`[DEBUG] Fallback port detection failed: ${error.message}`));
      }
      // Fall through
    }
  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Port detection failed: ${error.message}`));
    }
    // Fall through to default
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
async function waitForHealthCheck(appName, timeout = 90, port = null, config = null, debug = false) {
  await waitForDbInit(appName);

  // Use provided port if given, otherwise detect from Docker
  // Port provided should be the host port (CLI --port or config.port, NOT localPort)
  const healthCheckPort = port !== null && port !== undefined ? port : await getContainerPort(appName, debug);

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Health check port: ${healthCheckPort} (${port !== null && port !== undefined ? 'provided' : 'auto-detected'})`));
  }

  const healthCheckPath = config?.healthCheck?.path || '/health';
  const healthCheckUrl = `http://localhost:${healthCheckPort}${healthCheckPath}`;
  const maxAttempts = timeout / 2;

  if (debug) {
    logger.log(chalk.gray(`[DEBUG] Health check URL: ${healthCheckUrl}`));
    logger.log(chalk.gray(`[DEBUG] Timeout: ${timeout} seconds, Max attempts: ${maxAttempts}`));
  }

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    try {
      if (debug) {
        logger.log(chalk.gray(`[DEBUG] Health check attempt ${attempts + 1}/${maxAttempts}`));
      }
      const healthCheckPassed = await checkHealthEndpoint(healthCheckUrl, debug);
      if (healthCheckPassed) {
        logger.log(chalk.green('✓ Application is healthy'));
        if (debug) {
          logger.log(chalk.gray(`[DEBUG] Health check passed after ${attempts + 1} attempt(s)`));
        }
        return;
      }
    } catch (error) {
      if (debug) {
        logger.log(chalk.gray(`[DEBUG] Health check exception on attempt ${attempts + 1}: ${error.message}`));
      }
      // If exception occurs, continue retrying until timeout
      // The error will be handled by timeout error below
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

