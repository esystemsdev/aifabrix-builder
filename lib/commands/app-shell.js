/**
 * Shell command – open an interactive shell in the app container (docker exec -it).
 *
 * @fileoverview App shell command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { spawn } = require('child_process');
const chalk = require('chalk');
const logger = require('../utils/logger');
const config = require('../core/config');
const containerHelpers = require('../utils/app-run-containers');
const pathsUtil = require('../utils/paths');

/**
 * Load application config for builder app (used to ensure app exists).
 * @param {string} appName - Application name
 * @returns {Object} Application config
 */
function loadAppConfig(appName) {
  const { loadConfigFile } = require('../utils/config-format');
  const builderPath = pathsUtil.getBuilderPath(appName);
  const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
  return loadConfigFile(configPath);
}

/**
 * Run interactive shell in the application container. Uses bash if available, else sh.
 * @param {string} appName - Application name
 * @param {Object} [options] - Options (e.g. --env for future remote)
 * @returns {Promise<void>} Resolves when shell exits
 */
async function runAppShell(appName, _options = {}) {
  loadAppConfig(appName);

  const developerId = await config.getDeveloperId();
  const containerName = containerHelpers.getContainerName(appName, developerId);
  const isRunning = await containerHelpers.checkContainerRunning(appName, developerId);

  if (!isRunning) {
    throw new Error(
      `Container ${containerName} is not running.\nRun 'aifabrix run ${appName}' first.`
    );
  }

  logger.log(chalk.blue(`Opening shell in ${containerName} (exit with 'exit' or Ctrl+D)...\n`));

  const proc = spawn('docker', ['exec', '-it', containerName, 'sh'], {
    stdio: 'inherit',
    shell: false
  });

  return new Promise((resolve, reject) => {
    proc.on('close', code => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Shell exited with code ${code}`));
      } else {
        resolve();
      }
    });
    proc.on('error', err => reject(err));
  });
}

module.exports = { runAppShell };
