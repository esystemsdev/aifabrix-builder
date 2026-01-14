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
const { generateVariablesYaml, generateEnvTemplate, generateRbacYaml } = require('../core/templates');
const { generateEnvTemplate: generateEnvTemplateFromReader } = require('../core/env-reader');
const { generateReadmeMdFile } = require('./readme');
const logger = require('../utils/logger');

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
 * Generates env.template content for external systems based on authentication type
 * @param {Object} config - Application configuration with authType and systemKey
 * @param {string} appName - Application name (used as fallback for systemKey)
 * @returns {string} Environment template content
 */
function generateExternalSystemEnvTemplate(config, appName) {
  const systemKey = config.systemKey || appName;
  const authType = config.authType || 'apikey';
  const lines = [
    `# ${systemKey} ${authType.toUpperCase()} Configuration`,
    '# These values are set via the Miso Controller interface or Dataplane portal',
    '# Values are stored in Key Vault automatically by the platform',
    ''
  ];

  if (authType === 'oauth2') {
    lines.push('CLIENTID=kv://' + systemKey + '-clientidKeyVault');
    lines.push('CLIENTSECRET=kv://' + systemKey + '-clientsecretKeyVault');
    lines.push('TOKENURL=https://api.example.com/oauth/token');
    lines.push('REDIRECT_URI=kv://' + systemKey + '-redirect-uriKeyVault');
  } else if (authType === 'apikey') {
    lines.push('API_KEY=kv://' + systemKey + '-api-keyKeyVault');
  } else if (authType === 'basic') {
    lines.push('USERNAME=kv://' + systemKey + '-usernameKeyVault');
    lines.push('PASSWORD=kv://' + systemKey + '-passwordKeyVault');
  }

  return lines.join('\n');
}

/**
 * Generates env.template file if it doesn't exist
 * @async
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {Object} existingEnv - Existing environment variables
 */
async function generateEnvTemplateFile(appPath, appName, config, existingEnv) {
  const envTemplatePath = path.join(appPath, 'env.template');
  if (!(await fileExists(envTemplatePath))) {
    let envTemplate;

    if (config.type === 'external') {
      // Generate env.template for external systems based on authType
      envTemplate = generateExternalSystemEnvTemplate(config, appName);
    } else if (existingEnv) {
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
 * Generates <app-name>-deploy.json file (consistent naming for all apps)
 * @async
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 */
async function generateDeployJsonFile(appPath, appName, config) {
  // Skip for external type (external system JSON is generated separately)
  if (config.type === 'external') {
    return;
  }

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

  // Use consistent naming: <app-name>-deploy.json
  await fs.writeFile(
    path.join(appPath, `${appName}-deploy.json`),
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
    await generateEnvTemplateFile(appPath, appName, config, existingEnv);
    await generateRbacYamlFile(appPath, appName, config);
    await generateDeployJsonFile(appPath, appName, config);
    await generateReadmeMdFile(appPath, appName, config);
  } catch (error) {
    throw new Error(`Failed to generate configuration files: ${error.message}`);
  }
}

module.exports = {
  generateConfigFiles
};

