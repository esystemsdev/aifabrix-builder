/**
 * Template Helper Utilities
 *
 * Handles template variable loading, updating, and merging
 *
 * @fileoverview Template helper utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const logger = require('./logger');

/**
 * Loads template variables from template's variables.yaml file
 * @async
 * @function loadTemplateVariables
 * @param {string} templateName - Template name
 * @returns {Promise<Object|null>} Template variables or null if not found
 */
async function loadTemplateVariables(templateName) {
  if (!templateName) {
    return null;
  }

  const yaml = require('js-yaml');
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'applications', templateName);
  const templateVariablesPath = path.join(templatePath, 'variables.yaml');

  try {
    const templateContent = await fs.readFile(templateVariablesPath, 'utf8');
    return yaml.load(templateContent);
  } catch (error) {
    // Template variables.yaml not found or invalid, continue without it
    if (error.code !== 'ENOENT') {
      logger.warn(chalk.yellow(`⚠️  Warning: Could not load template variables.yaml: ${error.message}`));
    }
    return null;
  }
}

/**
 * Updates app key and display name in variables
 * @function updateAppMetadata
 * @param {Object} variables - Variables object
 * @param {string} appName - Application name
 */
function updateAppMetadata(variables, appName) {
  if (variables.app) {
    variables.app.key = appName;
  }

  if (variables.app?.displayName && variables.app.displayName.toLowerCase().includes('miso')) {
    variables.app.displayName = appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

/**
 * Updates port in variables if provided
 * @function updatePort
 * @param {Object} variables - Variables object
 * @param {Object} options - CLI options
 * @param {Object} config - Final configuration
 */
function updatePort(variables, options, config) {
  if (options.port && config.port && variables.port !== config.port) {
    variables.port = config.port;
  }
}

/**
 * Updates build configuration
 * @function updateBuildConfig
 * @param {Object} variables - Variables object
 */
function updateBuildConfig(variables) {
  if (variables.build && variables.build.envOutputPath) {
    variables.build.envOutputPath = null;
  }
}

/**
 * Updates database configuration for --app flag
 * @function updateDatabaseConfig
 * @param {Object} variables - Variables object
 * @param {Object} options - CLI options
 * @param {string} appName - Application name
 */
function updateDatabaseConfig(variables, options, appName) {
  if (!options.app || !variables.requires) {
    return;
  }

  if (variables.requires.databases) {
    variables.requires.databases = [{ name: appName }];
  } else if (variables.requires.database && !variables.requires.databases) {
    variables.requires.databases = [{ name: appName }];
  }
}

/**
 * Updates variables.yaml file after copying from template
 * Updates app.key, displayName, and port with actual values
 * @async
 * @function updateTemplateVariables
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @param {Object} options - CLI options
 * @param {Object} config - Final configuration
 */
async function updateTemplateVariables(appPath, appName, options, config) {
  const variablesPath = path.join(appPath, 'variables.yaml');
  try {
    const yaml = require('js-yaml');
    const variablesContent = await fs.readFile(variablesPath, 'utf8');
    const variables = yaml.load(variablesContent);

    updateAppMetadata(variables, appName);
    updatePort(variables, options, config);
    updateBuildConfig(variables);
    updateDatabaseConfig(variables, options, appName);

    await fs.writeFile(variablesPath, yaml.dump(variables, { indent: 2, lineWidth: 120, noRefs: true }));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(chalk.yellow(`⚠️  Warning: Could not update variables.yaml: ${error.message}`));
    }
  }
}

/**
 * Merges port from template variables if not in options
 * @function mergePort
 * @param {Object} merged - Merged options object
 * @param {Object} templateVariables - Template variables
 */
function mergePort(merged, templateVariables) {
  if (!merged.port && templateVariables.port) {
    merged.port = templateVariables.port;
  }
}

/**
 * Merges language from template variables if not in options
 * @function mergeLanguage
 * @param {Object} merged - Merged options object
 * @param {Object} templateVariables - Template variables
 */
function mergeLanguage(merged, templateVariables) {
  if (!merged.language && templateVariables.build?.language) {
    merged.language = templateVariables.build.language;
  }
}

/**
 * Merges service requirements from template variables if not in options
 * @function mergeServices
 * @param {Object} merged - Merged options object
 * @param {Object} templateVariables - Template variables
 */
function mergeServices(merged, templateVariables) {
  // Database: use template requires.database if not specified in options
  if (!Object.prototype.hasOwnProperty.call(merged, 'database') &&
      templateVariables.requires?.database !== undefined) {
    merged.database = templateVariables.requires.database;
  }

  // Redis: use template requires.redis if not specified in options
  if (!Object.prototype.hasOwnProperty.call(merged, 'redis') &&
      templateVariables.requires?.redis !== undefined) {
    merged.redis = templateVariables.requires.redis;
  }

  // Storage: use template requires.storage if not specified in options
  if (!Object.prototype.hasOwnProperty.call(merged, 'storage') &&
      templateVariables.requires?.storage !== undefined) {
    merged.storage = templateVariables.requires.storage;
  }
}

/**
 * Merges authentication from template variables if not in options
 * @function mergeAuthentication
 * @param {Object} merged - Merged options object
 * @param {Object} templateVariables - Template variables
 */
function mergeAuthentication(merged, templateVariables) {
  if (!Object.prototype.hasOwnProperty.call(merged, 'authentication') &&
      templateVariables.authentication !== undefined) {
    merged.authentication = !!templateVariables.authentication;
  }
}

/**
 * Merges template variables into options
 * @function mergeTemplateVariables
 * @param {Object} options - User-provided options
 * @param {Object} templateVariables - Template variables from variables.yaml
 * @returns {Object} Merged options object
 */
function mergeTemplateVariables(options, templateVariables) {
  if (!templateVariables) {
    return options;
  }

  const merged = { ...options };

  mergePort(merged, templateVariables);
  mergeLanguage(merged, templateVariables);
  mergeServices(merged, templateVariables);
  mergeAuthentication(merged, templateVariables);

  return merged;
}

module.exports = {
  loadTemplateVariables,
  updateTemplateVariables,
  mergeTemplateVariables
};

