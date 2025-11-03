/**
 * Application Configuration File Generation
 *
 * Generates configuration files for applications (variables.yaml, env.template, rbac.yaml, etc.)
 *
 * @fileoverview Configuration file generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { generateVariablesYaml, generateEnvTemplate, generateRbacYaml } = require('./templates');
const { generateEnvTemplate: generateEnvTemplateFromReader } = require('./env-reader');
const logger = require('./utils/logger');

/**
 * Checks if a file exists
 * @async
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates variables.yaml file if it doesn't exist
 * @async
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 */
async function generateVariablesYamlFile(appPath, appName, config) {
  const variablesPath = path.join(appPath, 'variables.yaml');
  if (!(await fileExists(variablesPath))) {
    const variablesYaml = generateVariablesYaml(appName, config);
    await fs.writeFile(variablesPath, variablesYaml);
  }
}

/**
 * Generates env.template file if it doesn't exist
 * @async
 * @param {string} appPath - Path to application directory
 * @param {Object} config - Application configuration
 * @param {Object} existingEnv - Existing environment variables
 */
async function generateEnvTemplateFile(appPath, config, existingEnv) {
  const envTemplatePath = path.join(appPath, 'env.template');
  if (!(await fileExists(envTemplatePath))) {
    let envTemplate;
    if (existingEnv) {
      const envResult = await generateEnvTemplateFromReader(config, existingEnv);
      envTemplate = envResult.template;

      if (envResult.warnings.length > 0) {
        logger.log(chalk.yellow('\n⚠️  Environment conversion warnings:'));
        envResult.warnings.forEach(warning => logger.log(chalk.yellow(`  - ${warning}`)));
      }
    } else {
      envTemplate = generateEnvTemplate(config);
    }
    await fs.writeFile(envTemplatePath, envTemplate);
  }
}

/**
 * Generates rbac.yaml file if authentication is enabled and file doesn't exist
 * @async
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 */
async function generateRbacYamlFile(appPath, appName, config) {
  if (!config.authentication) {
    return;
  }

  const rbacPath = path.join(appPath, 'rbac.yaml');
  if (!(await fileExists(rbacPath))) {
    const rbacYaml = generateRbacYaml(appName, config);
    if (rbacYaml) {
      await fs.writeFile(rbacPath, rbacYaml);
    }
  }
}

/**
 * Generates aifabrix-deploy.json file
 * @async
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 */
async function generateDeployJsonFile(appPath, appName, config) {
  const deployJson = {
    apiVersion: 'v1',
    kind: 'ApplicationDeployment',
    metadata: {
      name: appName,
      namespace: 'default'
    },
    spec: {
      application: {
        name: appName,
        version: '1.0.0',
        language: config.language,
        port: config.port
      },
      services: {
        database: config.database,
        redis: config.redis,
        storage: config.storage,
        authentication: config.authentication
      },
      deployment: {
        replicas: 1,
        strategy: 'RollingUpdate'
      }
    }
  };

  await fs.writeFile(
    path.join(appPath, 'aifabrix-deploy.json'),
    JSON.stringify(deployJson, null, 2)
  );
}

/**
 * Generate all configuration files for the application
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {Object} existingEnv - Existing environment variables
 */
async function generateConfigFiles(appPath, appName, config, existingEnv) {
  try {
    await generateVariablesYamlFile(appPath, appName, config);
    await generateEnvTemplateFile(appPath, config, existingEnv);
    await generateRbacYamlFile(appPath, appName, config);
    await generateDeployJsonFile(appPath, appName, config);
  } catch (error) {
    throw new Error(`Failed to generate configuration files: ${error.message}`);
  }
}

module.exports = {
  generateConfigFiles
};

