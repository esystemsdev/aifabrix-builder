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
 * Generate all configuration files for the application
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {Object} existingEnv - Existing environment variables
 */
async function generateConfigFiles(appPath, appName, config, existingEnv) {
  try {
    // Check if variables.yaml already exists (from template)
    const variablesPath = path.join(appPath, 'variables.yaml');
    let variablesExist = false;
    try {
      await fs.access(variablesPath);
      variablesExist = true;
    } catch {
      // File doesn't exist, will generate it
    }

    // Generate variables.yaml only if it doesn't exist (wasn't copied from template)
    if (!variablesExist) {
      const variablesYaml = generateVariablesYaml(appName, config);
      await fs.writeFile(variablesPath, variablesYaml);
    }

    // Generate env.template only if it doesn't exist (from template)
    const envTemplatePath = path.join(appPath, 'env.template');
    let envTemplateExist = false;
    try {
      await fs.access(envTemplatePath);
      envTemplateExist = true;
    } catch {
      // File doesn't exist, will generate it
    }

    // Generate env.template only if it doesn't exist (wasn't copied from template)
    if (!envTemplateExist) {
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

    // Generate rbac.yaml if authentication is enabled and file doesn't exist (from template)
    if (config.authentication) {
      const rbacPath = path.join(appPath, 'rbac.yaml');
      let rbacExist = false;
      try {
        await fs.access(rbacPath);
        rbacExist = true;
      } catch {
        // File doesn't exist, will generate it
      }

      // Generate rbac.yaml only if it doesn't exist (wasn't copied from template)
      if (!rbacExist) {
        const rbacYaml = generateRbacYaml(appName, config);
        if (rbacYaml) {
          await fs.writeFile(rbacPath, rbacYaml);
        }
      }
    }

    // Generate aifabrix-deploy.json template
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

  } catch (error) {
    throw new Error(`Failed to generate configuration files: ${error.message}`);
  }
}

module.exports = {
  generateConfigFiles
};

