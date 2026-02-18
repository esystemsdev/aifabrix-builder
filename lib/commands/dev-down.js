/**
 * dev down – stop Mutagen sync sessions and optionally app containers for this developer.
 *
 * @fileoverview Dev down command (plan 65: stop sync sessions; optional stop apps)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const chalk = require('chalk');
const logger = require('../utils/logger');
const config = require('../core/config');
const appLib = require('../app');

const execAsync = promisify(exec);

/**
 * Stop Mutagen sync sessions for this developer (session names aifabrix-<dev-id>-*).
 * When Mutagen is not available or no sessions exist, no-op.
 * @param {string} developerId - Developer ID
 * @returns {Promise<void>}
 */
async function stopMutagenSessions(developerId) {
  const { getMutagenPath } = require('../utils/mutagen');
  const mutagenPath = await getMutagenPath();
  if (!mutagenPath) {
    logger.log(chalk.gray('Mutagen not installed; no sync sessions to stop.'));
    return;
  }
  try {
    const { stdout } = await execAsync(`"${mutagenPath}" sync list --template '{{.Name}}'`, {
      encoding: 'utf8',
      timeout: 5000
    });
    const sessions = (stdout || '').trim().split('\n').filter(Boolean);
    const prefix = `aifabrix-${developerId}-`;
    const toTerminate = sessions.filter(name => name.startsWith(prefix));
    for (const name of toTerminate) {
      await execAsync(`"${mutagenPath}" sync terminate "${name}"`, { timeout: 5000 });
      logger.log(chalk.green(`  ✓ Stopped sync session: ${name}`));
    }
    if (toTerminate.length === 0 && sessions.length > 0) {
      logger.log(chalk.gray('No sync sessions for this developer.'));
    } else if (toTerminate.length === 0) {
      logger.log(chalk.gray('No Mutagen sync sessions to stop.'));
    }
  } catch (err) {
    logger.log(chalk.gray('No Mutagen sync sessions to stop.'));
  }
}

const INFRA_SUFFIXES = ['-postgres', '-redis', '-pgadmin', '-redis-commander', '-traefik', '-db-init'];

/**
 * List running app container names for this developer (excludes infra containers).
 * @param {string} developerId - Developer ID
 * @returns {Promise<string[]>} Container names (e.g. aifabrix-dev1-myapp)
 */
async function listAppContainersForDeveloper(developerId) {
  const idNum = parseInt(developerId, 10);
  const filter = idNum === 0 ? 'aifabrix-' : `aifabrix-dev${developerId}-`;
  const { stdout } = await execAsync(
    `docker ps --filter "name=${filter}" --format "{{.Names}}"`,
    { encoding: 'utf8' }
  );
  const names = (stdout || '').trim().split('\n').filter(Boolean);
  return names.filter(n => !INFRA_SUFFIXES.some(s => n.endsWith(s)));
}

/**
 * Extract app name from container name (aifabrix-dev1-myapp -> myapp, aifabrix-myapp -> myapp).
 * @param {string} containerName - Container name
 * @param {string} developerId - Developer ID
 * @returns {string} App name
 */
function appNameFromContainer(containerName, developerId) {
  const idNum = parseInt(developerId, 10);
  const prefix = idNum === 0 ? 'aifabrix-' : `aifabrix-dev${developerId}-`;
  return containerName.startsWith(prefix) ? containerName.slice(prefix.length) : containerName;
}

/**
 * Handle dev down: stop Mutagen sessions; optionally stop app containers.
 * @param {Object} options - { apps: boolean }
 * @returns {Promise<void>}
 */
async function handleDevDown(options = {}) {
  const developerId = await config.getDeveloperId();
  logger.log(chalk.blue('\nStopping dev resources for developer ' + developerId + '...\n'));

  await stopMutagenSessions(developerId);

  if (options.apps) {
    const containers = await listAppContainersForDeveloper(developerId);
    for (const containerName of containers) {
      const appName = appNameFromContainer(containerName, developerId);
      if (!appName) continue;
      try {
        await appLib.downApp(appName, {});
        logger.log(chalk.green(`  ✓ Stopped app: ${appName}`));
      } catch (err) {
        logger.log(chalk.yellow(`  ⚠ Could not stop ${appName}: ${err.message}`));
      }
    }
    if (containers.length === 0) {
      logger.log(chalk.gray('No running app containers for this developer.'));
    }
  }

  logger.log(chalk.green('\n✓ dev down complete.\n'));
}

module.exports = { handleDevDown };
