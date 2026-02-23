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
const secretsEnvWrite = require('../core/secrets-env-write');

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
 * Resolve test:e2e command from application config.
 * @param {Object} appConfig - Application config
 * @returns {string} Shell command (e.g. "pnpm test:e2e" or "make test:e2e")
 */
function getTestE2eCommand(appConfig) {
  const scripts = appConfig.build?.scripts || appConfig.scripts;
  const cmd = scripts?.['test:e2e'] || scripts?.testE2e;
  if (typeof cmd === 'string' && cmd.trim()) return cmd.trim();
  const lang = (appConfig.build?.language || appConfig.language || 'typescript').toLowerCase();
  return lang === 'python' ? 'make test:e2e' : 'pnpm test:e2e';
}

/**
 * Resolve test:integration command from application config (aifabrix test-integration <app>).
 * Defaults to test:e2e when not set so builder apps can run integration-style tests.
 * @param {Object} appConfig - Application config
 * @returns {string} Shell command (e.g. "pnpm test:integration" or "make test-integration")
 */
function getTestIntegrationCommand(appConfig) {
  const scripts = appConfig.build?.scripts || appConfig.scripts;
  const cmd = scripts?.['test:integration'] || scripts?.testIntegration;
  if (typeof cmd === 'string' && cmd.trim()) return cmd.trim();
  return getTestE2eCommand(appConfig);
}

/**
 * Resolve lint command from application config.
 * @param {Object} appConfig - Application config
 * @returns {string} Shell command (e.g. "pnpm lint" or "make lint")
 */
function getLintCommand(appConfig) {
  const scripts = appConfig.build?.scripts || appConfig.scripts;
  if (scripts && typeof scripts.lint === 'string' && scripts.lint.trim()) {
    return scripts.lint.trim();
  }
  const lang = (appConfig.build?.language || appConfig.language || 'typescript').toLowerCase();
  return lang === 'python' ? 'make lint' : 'pnpm lint';
}

/**
 * Run tests in dev (exec in running container).
 * Resolves app .env (including NPM_TOKEN/PYPI_TOKEN) and passes it so tests have registry tokens.
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
  const envFilePath = await secretsEnvWrite.resolveAndWriteEnvFile(appName, {});
  return runDockerExec(containerName, testCmd, envFilePath);
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
  const envFilePath = await secretsEnvWrite.resolveAndWriteEnvFile(appName, {});
  const code = await runDockerRunEphemeral(fullImage, testCmd, envFilePath);
  if (code !== 0) process.exit(code);
  logger.log(chalk.green('✓ Tests completed'));
}

/**
 * Run command in container via docker exec; stream output. Returns exit code.
 * When envFilePath is set, passes --env-file so NPM_TOKEN/PYPI_TOKEN (from kv://) are available.
 * @param {string} containerName - Container name
 * @param {string} testCmd - Shell command
 * @param {string|null} [envFilePath] - Path to resolved .env for --env-file (optional)
 * @returns {Promise<number>} Exit code
 */
function runDockerExec(containerName, testCmd, envFilePath = null) {
  return new Promise((resolve) => {
    const args = ['exec'];
    if (envFilePath) args.push('--env-file', envFilePath);
    args.push(containerName, 'sh', '-c', testCmd);
    const proc = spawn('docker', args, {
      stdio: 'inherit',
      shell: false
    });
    proc.on('close', code => resolve(code !== null ? code : 1));
    proc.on('error', () => resolve(1));
  });
}

/**
 * Run command in ephemeral container; optional --env-file. Returns exit code.
 * @param {string} fullImage - Image:tag
 * @param {string} testCmd - Shell command
 * @param {string|null} [envFilePath] - Path to .env for docker run --env-file (optional)
 * @returns {Promise<number>} Exit code
 */
function runDockerRunEphemeral(fullImage, testCmd, envFilePath = null) {
  return new Promise((resolve) => {
    const args = ['run', '--rm'];
    if (envFilePath) args.push('--env-file', envFilePath);
    args.push(fullImage, 'sh', '-c', testCmd);
    const proc = spawn('docker', args, {
      stdio: 'inherit',
      shell: false
    });
    proc.on('close', code => resolve(code !== null ? code : 1));
    proc.on('error', () => resolve(1));
  });
}

/**
 * Run test-e2e for a builder app. DEV: exec in running container; TST: ephemeral with .env.
 * @param {string} appName - Application name
 * @param {Object} [options] - { env: 'dev'|'tst' }
 * @returns {Promise<void>}
 */
async function runAppTestE2e(appName, options = {}) {
  const env = (options.env || 'dev').toLowerCase();
  if (env !== 'dev' && env !== 'tst') {
    throw new Error('--env must be dev or tst');
  }
  const appConfig = loadAppConfig(appName);
  const cmd = getTestE2eCommand(appConfig);
  const developerId = await config.getDeveloperId();
  const imageName = composeGenerator.getImageName(appConfig, appName);
  const imageTag = appConfig.image?.tag || 'latest';
  const fullImage = `${imageName}:${imageTag}`;

  if (env === 'dev') {
    const code = await runTestsInDev(appName, developerId, cmd);
    if (code !== 0) process.exit(code);
    logger.log(chalk.green('✓ Test-e2e completed'));
    return;
  }
  logger.log(chalk.blue(`Running test-e2e in ephemeral container (${fullImage}): ${cmd}\n`));
  const envFilePath = await secretsEnvWrite.resolveAndWriteEnvFile(appName, {});
  const code = await runDockerRunEphemeral(fullImage, cmd, envFilePath);
  if (code !== 0) process.exit(code);
  logger.log(chalk.green('✓ Test-e2e completed'));
}

/**
 * Run test-integration for a builder app (integration tests in container). DEV: exec in running container; TST: ephemeral with .env.
 * Uses build.scripts.testIntegration or test:integration; falls back to test:e2e when not set.
 * @param {string} appName - Application name
 * @param {Object} [options] - { env: 'dev'|'tst' }
 * @returns {Promise<void>}
 */
async function runAppTestIntegration(appName, options = {}) {
  const env = (options.env || 'dev').toLowerCase();
  if (env !== 'dev' && env !== 'tst') {
    throw new Error('--env must be dev or tst');
  }
  const appConfig = loadAppConfig(appName);
  const cmd = getTestIntegrationCommand(appConfig);
  const developerId = await config.getDeveloperId();
  const imageName = composeGenerator.getImageName(appConfig, appName);
  const imageTag = appConfig.image?.tag || 'latest';
  const fullImage = `${imageName}:${imageTag}`;

  if (env === 'dev') {
    const code = await runTestsInDev(appName, developerId, cmd);
    if (code !== 0) process.exit(code);
    logger.log(chalk.green('✓ Test-integration completed'));
    return;
  }
  logger.log(chalk.blue(`Running test-integration in ephemeral container (${fullImage}): ${cmd}\n`));
  const envFilePath = await secretsEnvWrite.resolveAndWriteEnvFile(appName, {});
  const code = await runDockerRunEphemeral(fullImage, cmd, envFilePath);
  if (code !== 0) process.exit(code);
  logger.log(chalk.green('✓ Test-integration completed'));
}

/**
 * Run lint for a builder app. DEV: exec in running container; TST: ephemeral with .env.
 * @param {string} appName - Application name
 * @param {Object} [options] - { env: 'dev'|'tst' }
 * @returns {Promise<void>}
 */
async function runAppLint(appName, options = {}) {
  const env = (options.env || 'dev').toLowerCase();
  if (env !== 'dev' && env !== 'tst') {
    throw new Error('--env must be dev or tst');
  }
  const appConfig = loadAppConfig(appName);
  const cmd = getLintCommand(appConfig);
  const developerId = await config.getDeveloperId();
  const imageName = composeGenerator.getImageName(appConfig, appName);
  const imageTag = appConfig.image?.tag || 'latest';
  const fullImage = `${imageName}:${imageTag}`;

  if (env === 'dev') {
    const code = await runTestsInDev(appName, developerId, cmd);
    if (code !== 0) process.exit(code);
    logger.log(chalk.green('✓ Lint completed'));
    return;
  }
  logger.log(chalk.blue(`Running lint in ephemeral container (${fullImage}): ${cmd}\n`));
  const envFilePath = await secretsEnvWrite.resolveAndWriteEnvFile(appName, {});
  const code = await runDockerRunEphemeral(fullImage, cmd, envFilePath);
  if (code !== 0) process.exit(code);
  logger.log(chalk.green('✓ Lint completed'));
}

module.exports = {
  runAppTest,
  getTestCommand,
  getTestE2eCommand,
  getTestIntegrationCommand,
  getLintCommand,
  runAppTestE2e,
  runAppTestIntegration,
  runAppLint
};
