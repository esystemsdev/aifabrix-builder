/**
 * Test command – run tests inside app container (dev: running container; tst: ephemeral).
 *
 * @fileoverview App test command for builder apps (plan 65: dev = in container, tst = ephemeral)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { spawn } = require('child_process');
const chalk = require('chalk');
const logger = require('../utils/logger');
const config = require('../core/config');
const containerHelpers = require('../utils/app-run-containers');
const composeGenerator = require('../utils/compose-generator');
const pathsUtil = require('../utils/paths');
const { loadConfigFile } = require('../utils/config-format');

/**
 * Load application config for builder app.
 * @param {string} appName - Application name
 * @returns {Object} Application config
 */
function loadAppConfig(appName) {
  const builderPath = pathsUtil.getBuilderPath(appName);
  const configPath = pathsUtil.resolveApplicationConfigPath(builderPath);
  return loadConfigFile(configPath);
}

/**
 * Resolve test command from application config (language or build.scripts).
 * @param {Object} appConfig - Application config
 * @returns {string} Shell command to run tests (e.g. "pnpm test" or "make test")
 */
function getTestCommand(appConfig) {
  const scripts = appConfig.build?.scripts || appConfig.scripts;
  if (scripts && typeof scripts.test === 'string' && scripts.test.trim()) {
    return scripts.test.trim();
  }
  const lang = (appConfig.build?.language || appConfig.language || 'typescript').toLowerCase();
  return lang === 'python' ? 'make test' : 'pnpm test';
}

/**
 * Run tests in dev (exec in running container).
 * @param {string} appName - Application name
 * @param {string|number} developerId - Developer ID
 * @param {string} testCmd - Test command
 * @returns {Promise<number>} Exit code
 */
async function runTestsInDev(appName, developerId, testCmd) {
  const containerName = containerHelpers.getContainerName(appName, developerId);
  const isRunning = await containerHelpers.checkContainerRunning(appName, developerId);
  if (!isRunning) {
    throw new Error(
      `Container ${containerName} is not running.\nRun 'aifabrix run ${appName}' first.`
    );
  }
  logger.log(chalk.blue(`Running tests in container ${containerName}: ${testCmd}\n`));
  return runDockerExec(containerName, testCmd);
}

/**
 * Run tests for a builder app. DEV: exec in running container; TST: ephemeral container.
 * @param {string} appName - Application name
 * @param {Object} [options] - { env: 'dev'|'tst' }
 * @returns {Promise<void>}
 */
async function runAppTest(appName, options = {}) {
  const env = (options.env || 'dev').toLowerCase();
  if (env !== 'dev' && env !== 'tst') {
    throw new Error('--env must be dev or tst');
  }
  const appConfig = loadAppConfig(appName);
  const testCmd = getTestCommand(appConfig);
  const developerId = await config.getDeveloperId();
  const imageName = composeGenerator.getImageName(appConfig, appName);
  const imageTag = appConfig.image?.tag || 'latest';
  const fullImage = `${imageName}:${imageTag}`;

  if (env === 'dev') {
    const code = await runTestsInDev(appName, developerId, testCmd);
    if (code !== 0) process.exit(code);
    logger.log(chalk.green('✓ Tests completed'));
    return;
  }
  logger.log(chalk.blue(`Running tests in ephemeral container (${fullImage}): ${testCmd}\n`));
  const code = await runDockerRunEphemeral(fullImage, testCmd);
  if (code !== 0) process.exit(code);
  logger.log(chalk.green('✓ Tests completed'));
}

/**
 * Run command in container via docker exec; stream output. Returns exit code.
 * @param {string} containerName - Container name
 * @param {string} testCmd - Shell command
 * @returns {Promise<number>} Exit code
 */
function runDockerExec(containerName, testCmd) {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['exec', containerName, 'sh', '-c', testCmd], {
      stdio: 'inherit',
      shell: false
    });
    proc.on('close', code => resolve(code !== null ? code : 1));
    proc.on('error', () => resolve(1));
  });
}

/**
 * Run command in ephemeral container; stream output. Returns exit code.
 * @param {string} fullImage - Image:tag
 * @param {string} testCmd - Shell command
 * @returns {Promise<number>} Exit code
 */
function runDockerRunEphemeral(fullImage, testCmd) {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['run', '--rm', fullImage, 'sh', '-c', testCmd], {
      stdio: 'inherit',
      shell: false
    });
    proc.on('close', code => resolve(code !== null ? code : 1));
    proc.on('error', () => resolve(1));
  });
}

module.exports = { runAppTest, getTestCommand };
