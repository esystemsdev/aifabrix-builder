/**
 * Application Configuration File Generation
 *
 * Generates configuration files for applications (application.yaml, env.template, rbac.yaml, etc.)
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
const { systemKeyToKvPrefix } = require('../utils/credential-secrets-env');

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
 * Renames legacy variables.yaml to application.yaml if only variables.yaml exists.
 * Ensures create always results in application.yaml.
 * @async
 * @param {string} appPath - Path to application directory
 */
async function normalizeLegacyVariablesYaml(appPath) {
  const applicationYaml = path.join(appPath, 'application.yaml');
  const applicationYml = path.join(appPath, 'application.yml');
  const applicationJson = path.join(appPath, 'application.json');
  const variablesYaml = path.join(appPath, 'variables.yaml');
  const hasAppYaml = await fileExists(applicationYaml);
  const hasAppYml = await fileExists(applicationYml);
  const hasAppJson = await fileExists(applicationJson);
  const hasVariables = await fileExists(variablesYaml);
  if (hasVariables && !hasAppYaml && !hasAppYml && !hasAppJson) {
    await fs.rename(variablesYaml, applicationYaml);
  }
}

/**
 * Generates application.yaml file if no application config exists
 * @async
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 */
async function generateVariablesYamlFile(appPath, appName, config) {
  await normalizeLegacyVariablesYaml(appPath);
  const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
  try {
    resolveApplicationConfigPath(appPath);
    return;
  } catch {
    // No config file; create application.yaml
  }
  const variablesPath = path.join(appPath, 'application.yaml');
  const variablesYaml = generateVariablesYaml(appName, config);
  await fs.writeFile(variablesPath, variablesYaml);
}

/**
 * Generates env.template content for external systems based on authentication type.
 * Uses KV_<APPKEY>_<VAR> convention (e.g. KV_HUBSPOT_CLIENTID) for credential push.
 * @param {Object} config - Application configuration with authType and systemKey
 * @param {string} appName - Application name (used as fallback for systemKey)
 * @returns {string} Environment template content
 */
function generateExternalSystemEnvTemplate(config, appName) {
  const systemKey = config.systemKey || appName;
  const authType = config.authType || 'apikey';
  const prefix = systemKeyToKvPrefix(systemKey);
  if (!prefix) return '';

  const lines = [
    `# ${systemKey} ${String(authType).toUpperCase()} Configuration`,
    '# Use KV_* variables for credential push (aifabrix credential push).',
    '# Values are stored in Key Vault automatically by the platform.',
    ''
  ];

  if (authType === 'oauth2' || authType === 'aad') {
    lines.push(`KV_${prefix}_CLIENTID=`);
    lines.push(`KV_${prefix}_CLIENTSECRET=`);
    lines.push('TOKEN_URL=https://api.example.com/oauth/token');
  } else if (authType === 'apikey') {
    lines.push(`KV_${prefix}_APIKEY=`);
  } else if (authType === 'basic') {
    lines.push(`KV_${prefix}_USERNAME=`);
    lines.push(`KV_${prefix}_PASSWORD=`);
  } else if (authType === 'queryParam') {
    lines.push(`KV_${prefix}_PARAMVALUE=`);
  } else if (authType === 'oidc') {
    lines.push('# OIDC: variables only (openIdConfigUrl, clientId); no security keys');
  } else if (authType === 'hmac') {
    lines.push(`KV_${prefix}_SIGNINGSECRET=`);
  }
  // none: no security keys

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
        logger.log(chalk.yellow('\n⚠  Environment conversion warnings:'));
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

