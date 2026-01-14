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
 * Updates variables.yaml for --app flag
 * @async
 * @function updateVariablesForAppFlag
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @throws {Error} If update fails
 */
async function updateVariablesForAppFlag(appPath, appName) {
  try {
    const yaml = require('js-yaml');
    const variablesPath = path.join(appPath, 'variables.yaml');
    const variablesContent = await fs.readFile(variablesPath, 'utf8');
    const variables = yaml.load(variablesContent);

    if (variables.build) {
      variables.build.context = '../..';
      variables.build.envOutputPath = `../../apps/${appName}/.env`;
    } else {
      variables.build = {
        context: '../..',
        envOutputPath: `../../apps/${appName}/.env`
      };
    }

    await fs.writeFile(variablesPath, yaml.dump(variables, { indent: 2, lineWidth: 120, noRefs: true }));
  } catch (error) {
    logger.warn(chalk.yellow(`⚠️  Warning: Could not update variables.yaml: ${error.message}`));
  }
}

/**
 * Gets language from config or variables.yaml
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

  const yaml = require('js-yaml');
  const variablesPath = path.join(appPath, 'variables.yaml');
  const variablesContent = await fs.readFile(variablesPath, 'utf8');
  const variables = yaml.load(variablesContent);
  const languageFromYaml = variables?.build?.language;

  if (!languageFromYaml) {
    throw new Error('Language not specified and could not be determined from variables.yaml. Use --language flag or ensure variables.yaml contains build.language');
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
  getBaseDirForAppType,
  handleGitHubWorkflows,
  validateAppCreation,
  processTemplateFiles,
  updateVariablesForAppFlag,
  getLanguageForAppFiles,
  setupAppFiles
};

