/**
 * Application Helper Utilities
 *
 * Helper functions for application creation and validation
 *
 * @fileoverview Helper utilities for application management
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { validateTemplate, copyTemplateFiles, copyAppFiles } = require('../validation/template');
const logger = require('../utils/logger');
const { getIntegrationPath, getBuilderPath } = require('../utils/paths');

/**
 * Validates that no app or external system with this name exists in integration/ or builder/.
 * Call before create so we do not overwrite existing directories.
 *
 * @async
 * @param {string} appName - Application or external system name
 * @throws {Error} If integration/<appName> or builder/<appName> already exists
 */
async function validateAppOrExternalNameNotExists(appName) {
  const integrationPath = getIntegrationPath(appName);
  const builderPath = getBuilderPath(appName);
  try {
    await fs.access(integrationPath);
    throw new Error(
      `App or external system '${appName}' already exists in integration/. ` +
      `Use a different name or remove integration/${appName} if you intend to replace it.`
    );
  } catch (err) {
    if (err.code !== 'ENOENT' && err.message.includes('already exists')) throw err;
    if (err.code !== 'ENOENT') throw err;
  }
  try {
    await fs.access(builderPath);
    throw new Error(
      `App or external system '${appName}' already exists in builder/. ` +
      `Use a different name or remove builder/${appName} if you intend to replace it.`
    );
  } catch (err) {
    if (err.code !== 'ENOENT' && err.message.includes('already exists')) throw err;
    if (err.code !== 'ENOENT') throw err;
  }
}

/**
 * Validates that app directory doesn't already exist
 * @async
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @param {string} baseDir - Base directory name
 * @throws {Error} If directory already exists
 */
async function validateAppDirectoryNotExists(appPath, appName, baseDir = 'builder') {
  try {
    await fs.access(appPath);
    throw new Error(`Application '${appName}' already exists in ${baseDir}/${appName}/`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Gets the base directory path for an app based on its type
 * @param {string} appType - Application type ('external' or other)
 * @returns {string} Base directory path ('integration' or 'builder')
 */
function getBaseDirForAppType(appType) {
  return appType === 'external' ? 'integration' : 'builder';
}

/**
 * Handles GitHub workflow generation if requested
 * @async
 * @param {Object} options - Creation options
 * @param {Object} config - Final configuration
 */
async function handleGitHubWorkflows(options, config) {
  if (!options.github) {
    return;
  }

  const githubGen = require('../generator/github');

  // Parse github-steps if provided
  const githubSteps = options.githubSteps
    ? options.githubSteps.split(',').map(s => s.trim()).filter(s => s.length > 0)
    : [];

  const workflowFiles = await githubGen.generateGithubWorkflows(
    process.cwd(),
    config,
    {
      mainBranch: options.mainBranch || 'main',
      uploadCoverage: true,
      githubSteps: githubSteps
    }
  );

  logger.log(chalk.green('✓ Generated GitHub Actions workflows:'));
  workflowFiles.forEach(file => logger.log(chalk.gray(`  - ${file}`)));
}

/**
 * Validates app creation prerequisites
 * @async
 * @function validateAppCreation
 * @param {string} appName - Application name
 * @param {Object} options - Creation options
 * @param {string} appPath - Application directory path
 * @param {string} baseDir - Base directory name
 * @throws {Error} If validation fails
 */
async function validateAppCreation(appName, options, appPath, baseDir = 'builder') {
  const { validateAppName } = require('./push');
  validateAppName(appName);
  await validateAppOrExternalNameNotExists(appName);
  await validateAppDirectoryNotExists(appPath, appName, baseDir);

  if (!options.app) {
    return;
  }

  const appsPath = path.join(process.cwd(), 'apps', appName);
  try {
    await fs.access(appsPath);
    throw new Error(`Application '${appName}' already exists in apps/${appName}/`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Processes template files if template is specified
 * @async
 * @function processTemplateFiles
 * @param {string} template - Template name
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @param {Object} options - Creation options
 * @param {Object} config - Final configuration
 * @throws {Error} If template processing fails
 */
async function processTemplateFiles(template, appPath, appName, options, config) {
  if (!template) {
    return;
  }

  await validateTemplate(template);
  const copiedFiles = await copyTemplateFiles(template, appPath);
  logger.log(chalk.green(`✓ Copied ${copiedFiles.length} file(s) from template '${template}'`));
  const { updateTemplateVariables } = require('../utils/template-helpers');
  await updateTemplateVariables(appPath, appName, options, config);
}

/**
 * Updates application config for --app flag
 * @async
 * @function updateVariablesForAppFlag
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @throws {Error} If update fails
 */
async function updateVariablesForAppFlag(appPath, appName) {
  const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
  const { loadConfigFile, writeConfigFile } = require('../utils/config-format');
  try {
    const variablesPath = resolveApplicationConfigPath(appPath);
    const variables = loadConfigFile(variablesPath) || {};

    if (variables.build) {
      variables.build.context = '../..';
      variables.build.envOutputPath = `../../apps/${appName}/.env`;
    } else {
      variables.build = {
        context: '../..',
        envOutputPath: `../../apps/${appName}/.env`
      };
    }

    writeConfigFile(variablesPath, variables);
  } catch (error) {
    if (!error.message.includes('not found')) {
      logger.warn(chalk.yellow(`⚠️  Warning: Could not update application config: ${error.message}`));
    }
  }
}

/**
 * Gets language from config or application.yaml
 * @async
 * @function getLanguageForAppFiles
 * @param {string} language - Language from config
 * @param {string} appPath - Application directory path
 * @returns {Promise<string>} Language to use
 * @throws {Error} If language cannot be determined
 */
async function getLanguageForAppFiles(language, appPath) {
  if (language) {
    return language;
  }

  const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
  const { loadConfigFile } = require('../utils/config-format');
  const configPath = resolveApplicationConfigPath(appPath);
  const variables = loadConfigFile(configPath) || {};
  const languageFromYaml = variables?.build?.language;

  if (!languageFromYaml) {
    throw new Error('Language not specified and could not be determined from application.yaml. Use --language flag or ensure application.yaml contains build.language');
  }

  return languageFromYaml;
}

/**
 * Sets up apps directory and copies application files
 * @async
 * @function setupAppFiles
 * @param {string} appName - Application name
 * @param {string} appPath - Application directory path
 * @param {Object} config - Final configuration
 * @param {Object} options - Creation options
 * @throws {Error} If setup fails
 */
async function setupAppFiles(appName, appPath, config, options) {
  const appsPath = path.join(process.cwd(), 'apps', appName);
  await fs.mkdir(appsPath, { recursive: true });
  await updateVariablesForAppFlag(appPath, appName);

  const language = await getLanguageForAppFiles(config.language || options.language, appPath);
  const copiedFiles = await copyAppFiles(language, appsPath);
  logger.log(chalk.green(`✓ Copied ${copiedFiles.length} application file(s) to apps/${appName}/`));
}

module.exports = {
  validateAppDirectoryNotExists,
  validateAppOrExternalNameNotExists,
  getBaseDirForAppType,
  handleGitHubWorkflows,
  validateAppCreation,
  processTemplateFiles,
  updateVariablesForAppFlag,
  getLanguageForAppFiles,
  setupAppFiles
};

