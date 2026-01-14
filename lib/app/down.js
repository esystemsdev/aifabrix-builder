/**
 * Application Down Management
 *
 * Provides functionality to stop and remove a specific application's container,
 * and optionally remove its associated Docker volume.
 *
 * @fileoverview Application stop/remove utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const { exec } = require('child_process');
const logger = require('../utils/logger');
const config = require('../core/config');
const helpers = require('./run-helpers');
const { validateAppName } = require('./push');

/**
 * Executes a shell command asynchronously.
 * Wraps child_process.exec with a Promise interface.
 *
 * @async
 * @param {string} command - Command to execute
 * @param {Object} [options] - Exec options
 * @returns {Promise<{stdout: string, stderr: string}>} Exec result
 */
function execAsync(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Computes the Docker volume name for an application, based on developer ID.
 * Dev 0: aifabrix_{app}_data
 * Dev > 0: aifabrix_dev{developerId}_{app}_data
 *
 * @param {string} appName - Application name
 * @param {number|string} developerId - Developer ID
 * @returns {string} Docker volume name
 */
function getAppVolumeName(appName, developerId) {
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  if (idNum === 0) {
    return `aifabrix_${appName}_data`;
  }
  return `aifabrix_dev${developerId}_${appName}_data`;
}

/**
 * Stops and removes a specific application's container.
 * If --volumes is passed, attempts to remove the app's named Docker volume.
 *
 * This does NOT delete any files under builder/<app> or apps/<app>.
 *
 * @async
 * @function downApp
 * @param {string} appName - Application name
 * @param {Object} options - Options
 * @param {boolean} [options.volumes=false] - Remove Docker volume data
 * @returns {Promise<void>} Resolves when operation completes
 * @throws {Error} If validation fails or Docker operations error (other than missing volume)
 *
 * @example
 * await downApp('myapp', { volumes: true });
 */
async function downApp(appName, options = {}) {
  try {
    // Input validation
    if (!appName || typeof appName !== 'string') {
      throw new Error('Application name is required and must be a string');
    }
    validateAppName(appName);

    const volumes = !!options.volumes;

    // Load developer ID
    const developerId = await config.getDeveloperId();

    // Stop and remove container (idempotent handling in helper logs when not running)
    await helpers.stopAndRemoveContainer(appName, developerId, false);

    // Optionally remove named Docker volume (ignore if it doesn't exist)
    if (volumes) {
      const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
      // Primary expected name
      const primaryName = getAppVolumeName(appName, developerId);
      // Legacy name used when devId \"0\" was treated as string in templates
      const legacyDev0Name = idNum === 0 ? `aifabrix_dev0_${appName}_data` : null;
      // Build list of candidates, unique and non-empty
      const candidates = Array.from(
        new Set([primaryName, legacyDev0Name].filter(Boolean))
      );

      for (const volumeName of candidates) {
        logger.log(chalk.yellow(`Removing volume ${volumeName}...`));
        try {
          await execAsync(`docker volume rm -f ${volumeName}`);
          logger.log(chalk.green(`✓ Volume ${volumeName} removed`));
        } catch (volErr) {
          // Swallow errors for missing volume; provide neutral message
          logger.log(chalk.gray(`Volume ${volumeName} not found or already removed`));
        }
      }
    }
  } catch (error) {
    // Provide meaningful error while avoiding sensitive info
    throw new Error(`Failed to stop application: ${error.message}`);
  }
}

module.exports = {
  downApp
};

