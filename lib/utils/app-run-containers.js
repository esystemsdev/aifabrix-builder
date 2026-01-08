/**
 * AI Fabrix Builder - App Run Container Helpers
 *
 * Container-related helper functions for application run workflow.
 * Extracted from app-run-helpers.js to reduce file size.
 *
 * @fileoverview Container helper functions for application run workflow
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const chalk = require('chalk');
const logger = require('./logger');

const execAsync = promisify(exec);

/**
 * Checks if Docker image exists for the application
 * @param {string} imageName - Image name (can include repository prefix)
 * @param {string} tag - Image tag (default: latest)
 * @param {boolean} [debug=false] - Enable debug logging
 * @returns {Promise<boolean>} True if image exists
 */
async function checkImageExists(imageName, tag = 'latest', debug = false) {
  try {
    const fullImageName = `${imageName}:${tag}`;
    const cmd = `docker images --format "{{.Repository}}:{{.Tag}}" --filter "reference=${fullImageName}"`;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Executing: ${cmd}`));
    }
    const { stdout } = await execAsync(cmd);
    const lines = stdout.trim().split('\n').filter(line => line.trim() !== '');
    const exists = lines.some(line => line.trim() === fullImageName);
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Image ${fullImageName} exists: ${exists}`));
    }
    return exists;
  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Image check failed: ${error.message}`));
    }
    return false;
  }
}

/**
 * Checks if container is already running
 * @param {string} appName - Application name
 * @param {number|string} developerId - Developer ID (0 = default infra, > 0 = developer-specific; string allowed)
 * @param {boolean} [debug=false] - Enable debug logging
 * @returns {Promise<boolean>} True if container is running
 */
async function checkContainerRunning(appName, developerId, debug = false) {
  try {
    const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    const containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
    const cmd = `docker ps --filter "name=${containerName}" --format "{{.Names}}"`;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Executing: ${cmd}`));
    }
    const { stdout } = await execAsync(cmd);
    const isRunning = stdout.trim() === containerName;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Container ${containerName} running: ${isRunning}`));
      if (isRunning) {
        const statusCmd = `docker ps --filter "name=${containerName}" --format "{{.Status}}"`;
        const { stdout: status } = await execAsync(statusCmd);
        const portsCmd = `docker ps --filter "name=${containerName}" --format "{{.Ports}}"`;
        const { stdout: ports } = await execAsync(portsCmd);
        logger.log(chalk.gray(`[DEBUG] Container status: ${status.trim()}`));
        logger.log(chalk.gray(`[DEBUG] Container ports: ${ports.trim()}`));
      }
    }
    return isRunning;
  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Container check failed: ${error.message}`));
    }
    return false;
  }
}

/**
 * Stops and removes existing container
 * @param {string} appName - Application name
 * @param {number|string} developerId - Developer ID (0 = default infra, > 0 = developer-specific; string allowed)
 * @param {boolean} [debug=false] - Enable debug logging
 */
async function stopAndRemoveContainer(appName, developerId, debug = false) {
  try {
    const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    const containerName = idNum === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
    logger.log(chalk.yellow(`Stopping existing container ${containerName}...`));
    const stopCmd = `docker stop ${containerName}`;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Executing: ${stopCmd}`));
    }
    await execAsync(stopCmd);
    const rmCmd = `docker rm ${containerName}`;
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Executing: ${rmCmd}`));
    }
    await execAsync(rmCmd);
    logger.log(chalk.green(`✓ Container ${containerName} stopped and removed`));
  } catch (error) {
    if (debug) {
      logger.log(chalk.gray(`[DEBUG] Stop/remove container error: ${error.message}`));
    }
    const idNum2 = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
    const containerName = idNum2 === 0 ? `aifabrix-${appName}` : `aifabrix-dev${developerId}-${appName}`;
    logger.log(chalk.gray(`Container ${containerName} was not running`));
  }
}

/**
 * Log container status for debugging
 * @async
 * @param {string} containerName - Container name
 * @param {boolean} debug - Enable debug logging
 */
async function logContainerStatus(containerName, debug) {
  if (debug) {
    const statusCmd = `docker ps --filter "name=${containerName}" --format "{{.Status}}"`;
    const { stdout: status } = await execAsync(statusCmd);
    const portsCmd = `docker ps --filter "name=${containerName}" --format "{{.Ports}}"`;
    const { stdout: ports } = await execAsync(portsCmd);
    logger.log(chalk.gray(`[DEBUG] Container status: ${status.trim()}`));
    logger.log(chalk.gray(`[DEBUG] Container ports: ${ports.trim()}`));
  }
}

module.exports = {
  checkImageExists,
  checkContainerRunning,
  stopAndRemoveContainer,
  logContainerStatus
};

