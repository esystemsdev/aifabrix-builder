/**
 * Install command – run install (dependencies) inside app container (dev: running; tst: ephemeral with .env).
 *
 * @fileoverview App install command for builder apps (plan 73)
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

/** Env set so install/test/lint use a writable temp dir in the container (e.g. when /app is read-only). */
const TMPDIR_VALUE = '/tmp';

/** pnpm store in /tmp when /app is read-only (avoids EACCES on _tmp_ files in project root). */
const PNPM_STORE_DIR = '/tmp/.pnpm-store';

/**
 * Ensure install command can run when /app is read-only: use TMPDIR and pnpm --store-dir.
 * @param {string} cmd - Raw install command (e.g. "pnpm install")
 * @returns {string} Command (possibly with --store-dir for pnpm)
 */
function installCommandForReadOnlyApp(cmd) {
  const t = typeof cmd === 'string' ? cmd.trim() : '';
  if (t === 'pnpm install' || t.startsWith('pnpm install ') ||
      t === 'pnpm i' || t.startsWith('pnpm i ')) {
    return t.includes('--store-dir') ? t : `${t} --store-dir ${PNPM_STORE_DIR}`;
  }
  return t;
}

/**
 * Resolve install command from application config (language or build.scripts).
 * @param {Object} appConfig - Application config
 * @returns {string} Shell command to run install (e.g. "pnpm install" or "make install")
 */
function getInstallCommand(appConfig) {
  const build = appConfig.build;
  const scripts = (build && build.scripts) || appConfig.scripts;
  if (scripts && typeof scripts.install === 'string' && scripts.install.trim()) {
    return scripts.install.trim();
  }
  const lang = (build && build.language || appConfig.language || 'typescript').toLowerCase();
  return lang === 'python' ? 'make install' : 'pnpm install';
}

/**
 * Run install in dev (exec in running container).
 * Resolves app .env (including NPM_TOKEN/PYPI_TOKEN from kv://) and passes it so install has registry tokens.
 * @param {string} appName - Application name
 * @param {string|number} developerId - Developer ID
 * @param {string} installCmd - Install command
 * @returns {Promise<number>} Exit code
 */
async function runInstallInDev(appName, developerId, installCmd) {
  const containerName = containerHelpers.getContainerName(appName, developerId);
  const isRunning = await containerHelpers.checkContainerRunning(appName, developerId);
  if (!isRunning) {
    throw new Error(
      `Container ${containerName} is not running.\nRun 'aifabrix run ${appName}' first.`
    );
  }
  logger.log(chalk.blue(`Running install in container ${containerName}: ${installCmd}\n`));
  const cmd = installCommandForReadOnlyApp(installCmd);
  const envFilePath = await secretsEnvWrite.resolveAndWriteEnvFile(appName, {});
  return runDockerExec(containerName, cmd, envFilePath);
}

/**
 * Run command in container via docker exec; stream output. Returns exit code.
 * Uses -e TMPDIR, pnpm store, CI; when envFilePath is set passes --env-file so NPM_TOKEN/PYPI_TOKEN (from kv://) are available.
 * @param {string} containerName - Container name
 * @param {string} cmd - Shell command
 * @param {string|null} [envFilePath] - Path to resolved .env for --env-file (optional; when set, install has registry tokens)
 * @returns {Promise<number>} Exit code
 */
function runDockerExec(containerName, cmd, envFilePath = null) {
  return new Promise((resolve) => {
    const args = [
      'exec',
      '-e', `TMPDIR=${TMPDIR_VALUE}`,
      '-e', `npm_config_store_dir=${PNPM_STORE_DIR}`,
      '-e', 'CI=true'
    ];
    if (envFilePath) {
      args.push('--env-file', envFilePath);
    }
    args.push(containerName, 'sh', '-c', cmd);
    const proc = spawn('docker', args, {
      stdio: 'inherit',
      shell: false
    });
    proc.on('close', code => resolve(code !== null ? code : 1));
    proc.on('error', () => resolve(1));
  });
}

/**
 * Run command in ephemeral container with optional env file; stream output. Returns exit code.
 * @param {string} fullImage - Image:tag
 * @param {string} cmd - Shell command
 * @param {string|null} [envFilePath] - Path to .env file for --env-file (optional)
 * @returns {Promise<number>} Exit code
 */
function runDockerRunEphemeral(fullImage, cmd, envFilePath = null) {
  return new Promise((resolve) => {
    const args = ['run', '--rm', '-e', `TMPDIR=${TMPDIR_VALUE}`, '-e', `npm_config_store_dir=${PNPM_STORE_DIR}`, '-e', 'CI=true'];
    if (envFilePath) {
      args.push('--env-file', envFilePath);
    }
    args.push(fullImage, 'sh', '-c', cmd);
    const proc = spawn('docker', args, {
      stdio: 'inherit',
      shell: false
    });
    proc.on('close', code => resolve(code !== null ? code : 1));
    proc.on('error', () => resolve(1));
  });
}

/**
 * Run install for a builder app. DEV: exec in running container; TST: ephemeral with resolved .env.
 * @param {string} appName - Application name
 * @param {Object} [options] - { env: 'dev'|'tst' }
 * @returns {Promise<void>}
 */
async function runAppInstall(appName, options = {}) {
  const env = (options.env || 'dev').toLowerCase();
  if (env !== 'dev' && env !== 'tst') {
    throw new Error('--env must be dev or tst');
  }
  const appConfig = loadAppConfig(appName);
  const installCmd = getInstallCommand(appConfig);
  const developerId = await config.getDeveloperId();
  const imageName = composeGenerator.getImageName(appConfig, appName);
  const imageTag = (appConfig.image && appConfig.image.tag) ? appConfig.image.tag : 'latest';
  const fullImage = `${imageName}:${imageTag}`;

  if (env === 'dev') {
    const code = await runInstallInDev(appName, developerId, installCmd);
    if (code !== 0) process.exit(code);
    logger.log(chalk.green('✓ Install completed'));
    return;
  }

  logger.log(chalk.blue(`Running install in ephemeral container (${fullImage}): ${installCmd}\n`));
  const envFilePath = await secretsEnvWrite.resolveAndWriteEnvFile(appName, {});
  const cmd = installCommandForReadOnlyApp(installCmd);
  const code = await runDockerRunEphemeral(fullImage, cmd, envFilePath);
  if (code !== 0) process.exit(code);
  logger.log(chalk.green('✓ Install completed'));
}

module.exports = { runAppInstall, getInstallCommand };
