const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');
/**
 * AI Fabrix Builder - Up Commands Shared Helpers
 *
 * Shared logic for up-miso and up-dataplane (ensure app from template).
 *
 * @fileoverview Shared helpers for up-miso and up-dataplane commands
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const logger = require('../utils/logger');
const config = require('../core/config');
const { getDefaultControllerUrl } = require('../utils/controller-url');
const pathsUtil = require('../utils/paths');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');
const { isYamlPath } = require('../utils/config-format');
const { copyTemplateFiles } = require('../validation/template');
const { ensureReadmeForAppPath, ensureReadmeForApp } = require('../app/readme');
const { refreshUrlsLocalRegistryFromBuilder } = require('../utils/urls-local-registry');

/**
 * Copy template to a target path if application config is missing there.
 * After copy, generates README.md from templates/applications/README.md.hbs.
 * @param {string} appName - Application name
 * @param {string} targetAppPath - Target directory (e.g. builder/keycloak)
 * @returns {Promise<boolean>} True if template was copied, false if already present
 */
async function ensureTemplateAtPath(appName, targetAppPath) {
  try {
    pathsUtil.resolveApplicationConfigPath(targetAppPath);
    return false;
  } catch {
    // No application config; copy template
  }
  await copyTemplateFiles(appName, targetAppPath);
  await ensureReadmeForAppPath(targetAppPath, appName);
  return true;
}

/**
 * Resolve the directory (folder) that would contain the .env file for envOutputPath.
 * @param {string} envOutputPath - Value from build.envOutputPath (e.g. ../../.env)
 * @param {string} configPath - Path to application config file
 * @returns {string} Absolute path to the folder that would contain the output .env file
 */
function getEnvOutputPathFolder(envOutputPath, configPath) {
  const configDir = path.dirname(configPath);
  const resolvedFile = path.resolve(configDir, envOutputPath);
  return path.dirname(resolvedFile);
}

/**
 * Patches envOutputPath to null in raw YAML content so comments and formatting are preserved.
 * Only touches the line that sets envOutputPath under build.
 *
 * @param {string} content - Raw file content (YAML)
 * @returns {string|null} Patched content, or null if no change
 */
function patchEnvOutputPathInYamlContent(content) {
  const re = /^(\s*)envOutputPath\s*:\s*.+$/m;
  const match = content.match(re);
  if (!match) return null;
  const indent = match[1];
  return content.replace(re, `${indent}envOutputPath: null`);
}

/**
 * Patches config file to set build.envOutputPath to null, preserving comments (YAML only).
 * For JSON or when in-place patch fails, falls back to full write.
 *
 * @param {string} configPath - Path to application config file
 * @returns {boolean} True if file was modified
 */
function patchEnvOutputPathInFile(configPath) {
  if (!isYamlPath(configPath)) {
    const variables = loadConfigFile(configPath);
    const updated = { ...variables, build: { ...(variables.build || {}), envOutputPath: null } };
    writeConfigFile(configPath, updated);
    return true;
  }
  const content = fs.readFileSync(configPath, 'utf8');
  const patched = patchEnvOutputPathInYamlContent(content);
  if (patched === null) return false;
  fs.writeFileSync(configPath, patched, 'utf8');
  return true;
}

/**
 * Validates envOutputPath: if the target folder does not exist, patches application config to set envOutputPath to null.
 * Used by up-platform, up-miso, up-dataplane so we do not keep a path that points outside an existing tree.
 * Patches in place for YAML to preserve comments.
 *
 * @param {string} appName - Application name (e.g. keycloak, miso-controller, dataplane)
 */
function validateEnvOutputPathFolderOrNull(appName) {
  if (!appName || typeof appName !== 'string') return;
  const pathsToPatch = [pathsUtil.getBuilderPath(appName)];
  const envBuilderRoot = process.env.AIFABRIX_BUILDER_DIR && String(process.env.AIFABRIX_BUILDER_DIR).trim();
  const cwdBuilderPath = path.join(process.cwd(), 'builder', appName);
  if (envBuilderRoot && path.resolve(cwdBuilderPath) !== path.resolve(pathsToPatch[0])) {
    pathsToPatch.push(cwdBuilderPath);
  }
  for (const appPath of pathsToPatch) {
    let configPath;
    try {
      configPath = pathsUtil.resolveApplicationConfigPath(appPath);
    } catch {
      continue;
    }
    try {
      const variables = loadConfigFile(configPath);
      const value = variables?.build?.envOutputPath;
      if (value === null || value === undefined || value === '') continue;
      const folder = getEnvOutputPathFolder(String(value).trim(), configPath);
      if (fs.existsSync(folder)) continue;
      patchEnvOutputPathInFile(configPath);
    } catch (err) {
      logger.warn(chalk.yellow(`Could not validate envOutputPath in ${configPath}: ${err.message}`));
    }
  }
}

/**
 * Patches a single application config file to set build.envOutputPath to null for deploy-only.
 * Only writes when a change is needed (value is set and target folder does not exist).
 * Uses in-place YAML patch when possible to preserve comments.
 *
 * @param {string} configPath - Path to application config file
 */
function patchOneVariablesFileForDeployOnly(configPath) {
  const variables = loadConfigFile(configPath);
  const value = variables?.build?.envOutputPath;
  if (value === null || value === undefined || value === '') return;
  const folder = getEnvOutputPathFolder(String(value).trim(), configPath);
  if (fs.existsSync(folder)) return;
  patchEnvOutputPathInFile(configPath);
}

/**
 * Patches application config to set build.envOutputPath to null for deploy-only (no local code).
 * Only patches when the target folder does NOT exist; when folder exists, keeps the value.
 * Use when running up-miso/up-platform so we do not copy .env to repo paths or show that message.
 * Patches both primary builder path and cwd/builder if different.
 *
 * @param {string} appName - Application name (e.g. miso-controller, dataplane)
 */
function patchEnvOutputPathForDeployOnly(appName) {
  if (!appName || typeof appName !== 'string') return;
  const pathsToPatch = [pathsUtil.getBuilderPath(appName)];
  const cwdBuilderPath = path.join(process.cwd(), 'builder', appName);
  if (path.resolve(cwdBuilderPath) !== path.resolve(pathsToPatch[0])) {
    pathsToPatch.push(cwdBuilderPath);
  }
  for (const appPath of pathsToPatch) {
    let configPath;
    try {
      configPath = pathsUtil.resolveApplicationConfigPath(appPath);
    } catch {
      continue;
    }
    try {
      patchOneVariablesFileForDeployOnly(configPath);
    } catch (err) {
      logger.warn(chalk.yellow(`Could not patch envOutputPath in ${configPath}: ${err.message}`));
    }
  }
}

/**
 * For ``up-platform --force`` only: clear all stored auth tokens, set ``environment`` to ``dev``,
 * set ``controller`` to the default URL for the current ``developer-id`` (``http://localhost`` +
 * app port = 3000 + developerId × 100), and persist config. Does not change ``developer-id``.
 * Builder dirs (keycloak, miso-controller, dataplane) are cleaned separately.
 *
 * @returns {Promise<void>}
 */
async function applyUpPlatformForceConfig(opts = {}) {
  const silent = Boolean(opts.silent);
  const deviceCleared = await config.clearAllDeviceTokens();
  const clientCleared = await config.clearAllClientTokens();
  await config.setCurrentEnvironment('dev');
  const defaultControllerUrl = await getDefaultControllerUrl();
  await config.setControllerUrl(defaultControllerUrl);

  const summary = { deviceCleared, clientCleared, defaultControllerUrl, environment: 'dev' };
  if (!silent) {
    logger.log(
      chalk.blue(
        `--force: cleared ${deviceCleared} device token(s) and ${clientCleared} client token(s); ` +
          `environment set to dev; default controller set to ${defaultControllerUrl} (run aifabrix login after platform is up)`
      )
    );
  }
  return summary;
}

/**
 * True when resolved path is the root itself or a subdirectory of an allowed builder root.
 * @param {string} resolvedAppPath
 * @param {string[]} allowedRoots - Absolute resolved directory roots
 * @returns {boolean}
 */
function isUnderAllowedBuilderRoot(resolvedAppPath, allowedRoots) {
  for (const root of allowedRoots) {
    const r = path.resolve(root);
    if (resolvedAppPath === r || resolvedAppPath.startsWith(r + path.sep)) {
      return true;
    }
  }
  return false;
}

/**
 * Removes builder app directories for the given app names. Only removes paths under an allowed
 * builder root (project `builder/` or `~/.aifabrix/builder/`) to prevent path traversal.
 * Uses {@link pathsUtil.getBuilderPath} for each app (system apps may resolve under the config dir).
 *
 * @param {string[]} appNames - Application names (e.g. ['keycloak', 'miso-controller', 'dataplane'])
 * @returns {Promise<void>}
 * @throws {Error} If any path is outside allowed builder roots (path traversal attempt)
 */
async function cleanBuilderAppDirs(appNames, opts = {}) {
  const silent = Boolean(opts.silent);
  if (!Array.isArray(appNames) || appNames.length === 0) return;
  const allowedRoots = [path.resolve(pathsUtil.getBuilderRoot()), path.resolve(pathsUtil.getSystemBuilderRoot())];
  const cleaned = [];
  for (const appName of appNames) {
    if (!appName || typeof appName !== 'string') continue;
    const appPath = path.resolve(pathsUtil.getBuilderPath(appName));
    if (!isUnderAllowedBuilderRoot(appPath, allowedRoots)) {
      throw new Error(
        `Path ${appPath} is outside allowed builder roots (${allowedRoots.join(', ')}); refusing to clean`
      );
    }
    if (fs.existsSync(appPath)) {
      fs.rmSync(appPath, { recursive: true });
      cleaned.push(appName);
      if (!silent) {
        logger.log(chalk.blue(`Cleaned builder/${appName}`));
      }
    }
  }
  return cleaned;
}

/**
 * Ensures builder app directory exists from template if application config is missing.
 * If builder/<appName>/application config does not exist, copies from templates/applications/<appName>.
 * Uses AIFABRIX_BUILDER_DIR when set (e.g. by up-miso/up-dataplane from config aifabrix-env-config).
 * When `process.env.AIFABRIX_BUILDER_DIR` is set and the primary app path differs from
 * `cwd/builder/<appName>`, also copies into `cwd/builder/<appName>` so the repo tree is not empty
 * while using a custom builder root. Skips that extra copy for platform apps (`keycloak`,
 * `miso-controller`, `dataplane`) so they materialize only under the system builder root, and when
 * no custom dir is in use.
 *
 * @async
 * @function ensureAppFromTemplate
 * @param {string} appName - Application name (keycloak, miso-controller, dataplane)
 * @returns {Promise<boolean>} True if template was copied (in either location), false if both already existed
 * @throws {Error} If template copy fails
 *
 * @example
 * await ensureAppFromTemplate('keycloak');
 */
async function ensureAppFromTemplate(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('Application name is required and must be a string');
  }

  const appPath = pathsUtil.getBuilderPath(appName);
  const primaryCopied = await ensureTemplateAtPath(appName, appPath);
  if (primaryCopied) {
    logger.log(chalk.blue(`Creating builder/${appName} from template...`));
    logger.log(formatSuccessLine(`Copied template for ${appName}`));
  }

  const envBuilderRoot = process.env.AIFABRIX_BUILDER_DIR && String(process.env.AIFABRIX_BUILDER_DIR).trim();
  const cwdBuilderPath = path.join(process.cwd(), 'builder', appName);
  if (
    envBuilderRoot &&
    path.resolve(cwdBuilderPath) !== path.resolve(appPath) &&
    !pathsUtil.isSystemBuilderAppName(appName)
  ) {
    const cwdCopied = await ensureTemplateAtPath(appName, cwdBuilderPath);
    if (cwdCopied) {
      logger.log(chalk.blue(`Creating builder/${appName} in project (from template)...`));
      logger.log(formatSuccessLine(`Copied template for ${appName} into builder/`));
    }
  }

  await ensureReadmeForApp(appName);
  return primaryCopied;
}

/**
 * Merge builder/packages `application.yaml` into `~/.aifabrix/urls.local.yaml`.
 * Same scan as the end of {@link prepareUrlsLocalRegistryForUpPlatform}; call after platform app
 * templates exist (e.g. `up-miso`, `up-dataplane`) so declarative `url://` and tooling see ports/patterns.
 */
function refreshUrlsLocalRegistryForCurrentProject() {
  try {
    refreshUrlsLocalRegistryFromBuilder(pathsUtil.getProjectRoot());
  } catch (error) {
    logger.warn(chalk.yellow(`⚠  Could not refresh URLs registry: ${error.message}`));
  }
}

/**
 * For `aifabrix up-platform` only: align builder dir env with up-miso/up-dataplane, materialize all three
 * platform apps from templates if missing, then refresh `~/.aifabrix/urls.local.yaml` so declarative
 * `url://` expansion (e.g. cross-references between miso-controller, dataplane, keycloak) sees every
 * app's port and pattern before Keycloak or Miso resolve their `.env` files.
 *
 * @returns {Promise<void>}
 */
async function prepareUrlsLocalRegistryForUpPlatform() {
  const builderDir = await config.getAifabrixBuilderDir();
  if (builderDir) {
    process.env.AIFABRIX_BUILDER_DIR = path.resolve(builderDir);
  }
  await ensureAppFromTemplate('keycloak');
  await ensureAppFromTemplate('miso-controller');
  await ensureAppFromTemplate('dataplane');
  refreshUrlsLocalRegistryForCurrentProject();
}

module.exports = {
  applyUpPlatformForceConfig,
  cleanBuilderAppDirs,
  ensureAppFromTemplate,
  patchEnvOutputPathForDeployOnly,
  validateEnvOutputPathFolderOrNull,
  getEnvOutputPathFolder,
  prepareUrlsLocalRegistryForUpPlatform,
  refreshUrlsLocalRegistryForCurrentProject
};
