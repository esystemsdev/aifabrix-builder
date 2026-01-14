/**
 * Build Helper Functions
 *
 * Helper functions for build operations.
 * Separated from build.js to maintain file size limits.
 *
 * @fileoverview Build helper functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const dockerfileUtils = require('./dockerfile-utils');
const logger = require('./logger');
const chalk = require('chalk');

/**
 * Determine Dockerfile path (template, custom, or generate)
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Options with language, config, buildConfig, contextPath, forceTemplate, devDir
 * @param {Function} generateDockerfileFn - Function to generate Dockerfile
 * @returns {Promise<string>} Path to Dockerfile
 */
async function determineDockerfile(appName, options, generateDockerfileFn) {
  // Use dev directory if provided, otherwise fall back to builder directory
  const searchPath = options.devDir || path.join(process.cwd(), 'builder', appName);

  const templateDockerfile = dockerfileUtils.checkTemplateDockerfile(searchPath, appName, options.forceTemplate);
  if (templateDockerfile) {
    const relativePath = path.relative(process.cwd(), templateDockerfile);
    logger.log(chalk.green(`✓ Using existing Dockerfile: ${relativePath}`));
    return templateDockerfile;
  }

  const customDockerfile = dockerfileUtils.checkProjectDockerfile(searchPath, appName, options.buildConfig, options.contextPath, options.forceTemplate);
  if (customDockerfile) {
    logger.log(chalk.green(`✓ Using custom Dockerfile: ${options.buildConfig.dockerfile}`));
    return customDockerfile;
  }

  // Generate Dockerfile in dev directory if provided
  const dockerfilePath = await generateDockerfileFn(appName, options.language, options.config, options.buildConfig, options.devDir);
  const relativePath = path.relative(process.cwd(), dockerfilePath);
  logger.log(chalk.green(`✓ Generated Dockerfile from template: ${relativePath}`));
  return dockerfilePath;
}

/**
 * Loads and validates configuration for build
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Configuration object with config, imageName, and buildConfig
 * @throws {Error} If configuration cannot be loaded or validated
 */
async function loadAndValidateConfig(appName) {
  const { loadVariablesYaml } = require('../build');
  const validator = require('../validation/validator');

  const variables = await loadVariablesYaml(appName);

  // Validate configuration
  const validation = await validator.validateVariables(appName);
  if (!validation.valid) {
    throw new Error(`Configuration validation failed:\n${validation.errors.join('\n')}`);
  }

  // Extract image name
  let imageName;
  if (typeof variables.image === 'string') {
    imageName = variables.image.split(':')[0];
  } else if (variables.image?.name) {
    imageName = variables.image.name;
  } else if (variables.app?.key) {
    imageName = variables.app.key;
  } else {
    imageName = appName;
  }

  // Extract build config
  const buildConfig = variables.build || {};

  return {
    config: variables,
    imageName,
    buildConfig
  };
}

module.exports = {
  determineDockerfile,
  loadAndValidateConfig
};

