/**
 * Infrastructure Container Utilities
 *
 * This module provides helper functions for finding and checking
 * infrastructure containers. Used by the main infra.js module.
 *
 * @fileoverview Container utilities for infrastructure management
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const config = require('../config');

const execAsync = promisify(exec);

/**
 * Finds container by name pattern
 * @private
 * @async
 * @param {string} serviceName - Service name
 * @param {number|string} [devId] - Developer ID (optional, will be loaded from config if not provided)
 * @returns {Promise<string|null>} Container name or null if not found
 */
async function findContainer(serviceName, devId = null) {
  try {
    const developerId = devId || await config.getDeveloperId();
    const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    // Dev 0: aifabrix-{serviceName}, Dev > 0: aifabrix-dev{id}-{serviceName}
    const primaryPattern = idNum === 0 ? `aifabrix-${serviceName}` : `aifabrix-dev${developerId}-${serviceName}`;

    // Search order expected by tests:
    // 1) primaryPattern
    // 2) infra-{serviceName} (old pattern)
    // 3) aifabrix-{serviceName} (base pattern)
    const patternsToTry = [
      primaryPattern,
      `infra-${serviceName}`,
      `aifabrix-${serviceName}`
    ];

    for (const pattern of patternsToTry) {
      const { stdout } = await execAsync(`docker ps --filter "name=${pattern}" --format "{{.Names}}"`);
      const names = stdout
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      const exactMatch = names.find(n => n === pattern);
      if (exactMatch || names[0]) {
        return exactMatch || names[0];
      }
    }

    // Not found with any pattern
    return '';
  } catch (error) {
    return null;
  }
}

/**
 * Checks health status for a service with health checks
 * @private
 * @async
 * @param {string} serviceName - Service name
 * @param {number} [devId] - Developer ID (optional, will be loaded from config if not provided)
 * @returns {Promise<string>} Health status
 */
async function checkServiceWithHealthCheck(serviceName, devId = null) {
  try {
    const containerName = await findContainer(serviceName, devId);
    if (!containerName) {
      return 'unknown';
    }
    const { stdout } = await execAsync(`docker inspect --format='{{.State.Health.Status}}' ${containerName}`);
    const status = stdout.trim().replace(/['"]/g, '');
    // Accept both 'healthy' and 'starting' as healthy (starting means it's initializing)
    return (status === 'healthy' || status === 'starting') ? 'healthy' : status;
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Checks health status for a service without health checks
 * @private
 * @async
 * @param {string} serviceName - Service name
 * @param {number} [devId] - Developer ID (optional, will be loaded from config if not provided)
 * @returns {Promise<string>} Health status
 */
async function checkServiceWithoutHealthCheck(serviceName, devId = null) {
  try {
    const containerName = await findContainer(serviceName, devId);
    if (!containerName) {
      return 'unknown';
    }
    const { stdout } = await execAsync(`docker inspect --format='{{.State.Status}}' ${containerName}`);
    const status = stdout.trim().replace(/['"]/g, '');
    // Treat 'running' or 'healthy' as 'healthy' for services without health checks
    return (status === 'running' || status === 'healthy') ? 'healthy' : 'unhealthy';
  } catch (error) {
    return 'unknown';
  }
}

module.exports = {
  findContainer,
  checkServiceWithHealthCheck,
  checkServiceWithoutHealthCheck
};

