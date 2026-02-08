/**
 * Down-app command – stop container, optionally volumes, then remove image if unused
 *
 * @fileoverview Down-app command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const config = require('../core/config');
const containerHelpers = require('../utils/app-run-containers');
const { downApp } = require('../app/down');

const execAsync = promisify(exec);

/**
 * Get image ID of a running container (sha or name:tag)
 * @async
 * @param {string} containerName - Docker container name
 * @returns {Promise<string|null>} Image ID or null if container not found / not running
 */
async function getContainerImageId(containerName) {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.Image}}' ${containerName}`,
      { encoding: 'utf8' }
    );
    const id = (stdout && stdout.trim()) || null;
    return id || null;
  } catch {
    return null;
  }
}

/**
 * Remove Docker image by ID; ignore "in use" or "no such image"
 * @async
 * @param {string} imageId - Image ID (sha or name:tag)
 */
async function removeImageIfUnused(imageId) {
  if (!imageId) return;
  try {
    await execAsync(`docker rmi ${imageId}`);
    logger.log(chalk.green(`✓ Image ${imageId} removed`));
  } catch (err) {
    const msg = (err && err.message) || '';
    if (msg.includes('in use') || msg.includes('is being used')) {
      logger.log(chalk.gray(`Image ${imageId} still in use by another container; not removed`));
    } else if (msg.includes('No such image')) {
      logger.log(chalk.gray(`Image ${imageId} not found (already removed)`));
    } else {
      logger.log(chalk.yellow(`Could not remove image: ${msg}`));
    }
  }
}

/**
 * Run down-app: get image from container, stop/remove container (and optionally volume), then remove image if unused
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - { volumes: boolean }
 * @returns {Promise<void>}
 */
async function runDownAppWithImageRemoval(appName, options = {}) {
  const developerId = await config.getDeveloperId();
  const containerName = containerHelpers.getContainerName(appName, developerId);
  const imageId = await getContainerImageId(containerName);

  await downApp(appName, options);
  await removeImageIfUnused(imageId);
}

module.exports = {
  runDownAppWithImageRemoval,
  getContainerImageId,
  removeImageIfUnused
};
