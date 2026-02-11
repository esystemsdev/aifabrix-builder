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
const yaml = require('js-yaml');
const chalk = require('chalk');
const logger = require('../utils/logger');
const pathsUtil = require('../utils/paths');
const { copyTemplateFiles } = require('../validation/template');
const { ensureReadmeForAppPath, ensureReadmeForApp } = require('../app/readme');

/**
 * Copy template to a target path if variables.yaml is missing there.
 * After copy, generates README.md from templates/applications/README.md.hbs.
 * @param {string} appName - Application name
 * @param {string} targetAppPath - Target directory (e.g. builder/keycloak)
 * @returns {Promise<boolean>} True if template was copied, false if already present
 */
async function ensureTemplateAtPath(appName, targetAppPath) {
  const variablesPath = path.join(targetAppPath, 'variables.yaml');
  if (fs.existsSync(variablesPath)) {
    return false;
  }
  await copyTemplateFiles(appName, targetAppPath);
  await ensureReadmeForAppPath(targetAppPath, appName);
  return true;
}

/**
 * Resolve the directory (folder) that would contain the .env file for envOutputPath.
 * @param {string} envOutputPath - Value from build.envOutputPath (e.g. ../../.env)
 * @param {string} variablesPath - Path to variables.yaml
 * @returns {string} Absolute path to the folder that would contain the output .env file
 */
function getEnvOutputPathFolder(envOutputPath, variablesPath) {
  const variablesDir = path.dirname(variablesPath);
  const resolvedFile = path.resolve(variablesDir, envOutputPath);
  return path.dirname(resolvedFile);
}

/**
 * Validates envOutputPath: if the target folder does not exist, patches variables.yaml to set envOutputPath to null.
 * Used by up-platform, up-miso, up-dataplane so we do not keep a path that points outside an existing tree.
 *
 * @param {string} appName - Application name (e.g. keycloak, miso-controller, dataplane)
 */
function validateEnvOutputPathFolderOrNull(appName) {
  if (!appName || typeof appName !== 'string') return;
  const pathsToPatch = [pathsUtil.getBuilderPath(appName)];
  const cwdBuilderPath = path.join(process.cwd(), 'builder', appName);
  if (path.resolve(cwdBuilderPath) !== path.resolve(pathsToPatch[0])) {
    pathsToPatch.push(cwdBuilderPath);
  }
  const envOutputPathLine = /^(\s*envOutputPath:)\s*.*$/m;
  const replacement = '$1 null  # deploy only, no copy';
  for (const appPath of pathsToPatch) {
    const variablesPath = path.join(appPath, 'variables.yaml');
    if (!fs.existsSync(variablesPath)) continue;
    try {
      const content = fs.readFileSync(variablesPath, 'utf8');
      const variables = yaml.load(content);
      const value = variables?.build?.envOutputPath;
      if (value === null || value === undefined || value === '') continue;
      const folder = getEnvOutputPathFolder(String(value).trim(), variablesPath);
      if (fs.existsSync(folder)) continue;
      const newContent = content.replace(envOutputPathLine, replacement);
      fs.writeFileSync(variablesPath, newContent, 'utf8');
    } catch (err) {
      logger.warn(chalk.yellow(`Could not validate envOutputPath in ${variablesPath}: ${err.message}`));
    }
  }
}

/**
 * Patches a single variables.yaml to set build.envOutputPath to null for deploy-only.
 *
 * @param {string} variablesPath - Path to variables.yaml
 * @param {RegExp} envOutputPathLine - Regex for envOutputPath line
 * @param {string} replacement - Replacement string
 */
function patchOneVariablesFileForDeployOnly(variablesPath, envOutputPathLine, replacement) {
  const content = fs.readFileSync(variablesPath, 'utf8');
  if (!envOutputPathLine.test(content)) return;
  const variables = yaml.load(content);
  const value = variables?.build?.envOutputPath;
  if (value !== null && value !== undefined && value !== '') {
    const folder = getEnvOutputPathFolder(String(value).trim(), variablesPath);
    if (fs.existsSync(folder)) return;
  }
  const newContent = content.replace(envOutputPathLine, replacement);
  fs.writeFileSync(variablesPath, newContent, 'utf8');
}

/**
 * Patches variables.yaml to set build.envOutputPath to null for deploy-only (no local code).
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
  const envOutputPathLine = /^(\s*envOutputPath:)\s*.*$/m;
  const replacement = '$1 null  # deploy only, no copy';
  for (const appPath of pathsToPatch) {
    const variablesPath = path.join(appPath, 'variables.yaml');
    if (!fs.existsSync(variablesPath)) continue;
    try {
      patchOneVariablesFileForDeployOnly(variablesPath, envOutputPathLine, replacement);
    } catch (err) {
      logger.warn(chalk.yellow(`Could not patch envOutputPath in ${variablesPath}: ${err.message}`));
    }
  }
}

/**
 * Ensures builder app directory exists from template if variables.yaml is missing.
 * If builder/<appName>/variables.yaml does not exist, copies from templates/applications/<appName>.
 * Uses AIFABRIX_BUILDER_DIR when set (e.g. by up-miso/up-dataplane from config aifabrix-env-config).
 * When using a custom builder dir, also populates cwd/builder/<appName> so the repo's builder/ is not empty.
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
    logger.log(chalk.green(`✓ Copied template for ${appName}`));
  }

  const cwdBuilderPath = path.join(process.cwd(), 'builder', appName);
  if (path.resolve(cwdBuilderPath) !== path.resolve(appPath)) {
    const cwdCopied = await ensureTemplateAtPath(appName, cwdBuilderPath);
    if (cwdCopied) {
      logger.log(chalk.blue(`Creating builder/${appName} in project (from template)...`));
      logger.log(chalk.green(`✓ Copied template for ${appName} into builder/`));
    }
  }

  await ensureReadmeForApp(appName);
  return primaryCopied;
}

module.exports = {
  ensureAppFromTemplate,
  patchEnvOutputPathForDeployOnly,
  validateEnvOutputPathFolderOrNull,
  getEnvOutputPathFolder
};
