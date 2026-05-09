const chalk = require('chalk');
const { formatSuccessLine } = require('./cli-test-layout-chalk');
const logger = require('./logger');
const { execWithDockerEnv } = require('./docker-exec');

/**
 * Checks if db-init container exists.
 * @async
 * @param {string} dbInitContainer
 * @returns {Promise<boolean>}
 */
async function checkDbInitContainerExists(dbInitContainer) {
  try {
    const { stdout } = await execWithDockerEnv(
      `docker ps -a --filter "name=${dbInitContainer}" --format "{{.Names}}"`
    );
    return stdout.trim() === dbInitContainer;
  } catch {
    return false;
  }
}

/**
 * Gets container exit code.
 * @async
 * @param {string} dbInitContainer
 * @returns {Promise<string>}
 */
async function getContainerExitCode(dbInitContainer) {
  const { stdout: exitCode } = await execWithDockerEnv(
    `docker inspect --format='{{.State.ExitCode}}' ${dbInitContainer}`
  );
  return exitCode.trim();
}

/**
 * Handles exited container status.
 * @async
 * @param {string} dbInitContainer
 * @returns {Promise<boolean>}
 */
async function handleExitedContainer(dbInitContainer) {
  const { stdout: status } = await execWithDockerEnv(
    `docker inspect --format='{{.State.Status}}' ${dbInitContainer}`
  );
  if (status.trim() === 'exited') {
    const exitCode = await getContainerExitCode(dbInitContainer);
    if (exitCode === '0') {
      logger.log(formatSuccessLine('Database initialization already completed'));
    } else {
      logger.log(chalk.yellow(`⚠ Database initialization exited with code ${exitCode}`));
    }
    return true;
  }
  return false;
}

/**
 * Waits for container to exit (best-effort).
 * @async
 * @param {string} dbInitContainer
 * @param {number} maxAttempts
 * @returns {Promise<void>}
 */
async function waitForContainerExit(dbInitContainer, maxAttempts) {
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const { stdout: currentStatus } = await execWithDockerEnv(
      `docker inspect --format='{{.State.Status}}' ${dbInitContainer}`
    );
    if (currentStatus.trim() === 'exited') {
      const exitCode = await getContainerExitCode(dbInitContainer);
      if (exitCode === '0') {
        logger.log(formatSuccessLine('Database initialization completed'));
      } else {
        logger.log(chalk.yellow(`⚠ Database initialization exited with code ${exitCode}`));
      }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Checks if db-init container exists and waits for it to complete.
 * @async
 * @param {string} appName
 * @returns {Promise<void>}
 */
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
  } catch {
    // db-init container might not exist, which is fine
  }
}

module.exports = { waitForDbInit };
