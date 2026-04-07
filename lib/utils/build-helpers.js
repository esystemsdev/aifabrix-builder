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

  // Prefer application.yaml `build.dockerfile` over a stale Dockerfile copied into ~/.aifabrix/.../Dockerfile
  const customDockerfile = dockerfileUtils.checkProjectDockerfile(
    searchPath,
    appName,
    options.buildConfig,
    options.contextPath,
    options.forceTemplate
  );
  if (customDockerfile) {
    logger.log(chalk.green(`✓ Using custom Dockerfile: ${options.buildConfig.dockerfile}`));
    return customDockerfile;
  }

  const templateDockerfile = dockerfileUtils.checkTemplateDockerfile(searchPath, appName, options.forceTemplate);
  if (templateDockerfile) {
    const relativePath = path.relative(process.cwd(), templateDockerfile);
    logger.log(chalk.green(`✓ Using existing Dockerfile: ${relativePath}`));
    return templateDockerfile;
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
  const config = require('../core/config');
  const { resolveBuildImageRepositoryName } = require('./build-resolve-image');

  const variables = await loadVariablesYaml(appName);

  // Validate configuration
  const validation = await validator.validateVariables(appName);
  if (!validation.valid) {
    throw new Error(`Configuration validation failed:\n${validation.errors.join('\n')}`);
  }

  const developerId = await config.getDeveloperId();
  const imageName = await resolveBuildImageRepositoryName(appName, variables, developerId);

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

