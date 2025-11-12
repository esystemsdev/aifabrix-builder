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
    const containerNamePattern = idNum === 0
      ? `aifabrix-${serviceName}`
      : `aifabrix-dev${developerId}-${serviceName}`;
    let { stdout } = await execAsync(`docker ps --filter "name=${containerNamePattern}" --format "{{.Names}}"`);
    let containerName = stdout.trim();
    if (!containerName) {
      // Fallback to old naming patterns for backward compatibility
      ({ stdout } = await execAsync(`docker ps --filter "name=infra-${serviceName}" --format "{{.Names}}"`));
      containerName = stdout.trim();
      if (!containerName) {
        ({ stdout } = await execAsync(`docker ps --filter "name=aifabrix-${serviceName}" --format "{{.Names}}"`));
        containerName = stdout.trim();
      }
    }
    return containerName;
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

