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
 * @returns {Promise<number>} Container port
 */
async function getContainerPort(appName) {
  try {
    // Try to get the actual mapped host port from Docker
    // First try docker inspect for the container port mapping
    const { stdout: portMapping } = await execAsync(`docker inspect --format='{{range $p, $conf := .NetworkSettings.Ports}}{{if $conf}}{{range $conf}}{{.HostPort}}{{end}}{{end}}{{end}}' aifabrix-${appName}`);
    const ports = portMapping.trim().split('\n').filter(p => p && p !== '');
    if (ports.length > 0) {
      const port = parseInt(ports[0], 10);
      if (!isNaN(port) && port > 0) {
        return port;
      }
    }

    // Fallback: try docker ps to get port mapping (format: "0.0.0.0:3010->3000/tcp")
    try {
      const { stdout: psOutput } = await execAsync(`docker ps --filter "name=aifabrix-${appName}" --format "{{.Ports}}"`);
      const portMatch = psOutput.match(/:(\d+)->/);
      if (portMatch) {
        const port = parseInt(portMatch[1], 10);
        if (!isNaN(port) && port > 0) {
          return port;
        }
      }
    } catch (error) {
      // Fall through
    }
  } catch (error) {
    // Fall through to default
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
 * @returns {Promise<boolean>} True if healthy
 * @throws {Error} If request fails with exception
 */
async function checkHealthEndpoint(healthCheckUrl) {
  return new Promise((resolve, reject) => {
    try {
      const req = http.get(healthCheckUrl, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(parseHealthResponse(data, res.statusCode));
        });
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch (error) {
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
 * @returns {Promise<void>} Resolves when health check passes
 * @throws {Error} If health check times out
 */
async function waitForHealthCheck(appName, timeout = 90, port = null, config = null) {
  await waitForDbInit(appName);

  // Always detect the actual port from Docker to ensure we use the correct mapped port
  const detectedPort = await getContainerPort(appName);
  const healthCheckPort = port || detectedPort;

  const healthCheckPath = config?.healthCheck?.path || '/health';
  const healthCheckUrl = `http://localhost:${healthCheckPort}${healthCheckPath}`;
  const maxAttempts = timeout / 2;

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    try {
      const healthCheckPassed = await checkHealthEndpoint(healthCheckUrl);
      if (healthCheckPassed) {
        logger.log(chalk.green('✓ Application is healthy'));
        return;
      }
    } catch (error) {
      // If exception occurs, continue retrying until timeout
      // The error will be handled by timeout error below
    }

    if (attempts < maxAttempts - 1) {
      logger.log(chalk.yellow(`Waiting for health check... (${attempts + 1}/${maxAttempts}) ${healthCheckUrl}`));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error(`Health check timeout after ${timeout} seconds`);
}

module.exports = {
  waitForHealthCheck
};

