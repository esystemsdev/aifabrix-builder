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

/**
 * Generate all configuration files for the application
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @param {Object} existingEnv - Existing environment variables
 */
async function generateConfigFiles(appPath, appName, config, existingEnv) {
  try {
    // Generate variables.yaml
    const variablesYaml = generateVariablesYaml(appName, config);
    await fs.writeFile(path.join(appPath, 'variables.yaml'), variablesYaml);

    // Generate env.template
    let envTemplate;
    if (existingEnv) {
      const envResult = await generateEnvTemplateFromReader(config, existingEnv);
      envTemplate = envResult.template;

      if (envResult.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Environment conversion warnings:'));
        envResult.warnings.forEach(warning => console.log(chalk.yellow(`  - ${warning}`)));
      }
    } else {
      envTemplate = generateEnvTemplate(config);
    }
    await fs.writeFile(path.join(appPath, 'env.template'), envTemplate);

    // Generate rbac.yaml if authentication is enabled
    if (config.authentication) {
      const rbacYaml = generateRbacYaml(appName, config);
      if (rbacYaml) {
        await fs.writeFile(path.join(appPath, 'rbac.yaml'), rbacYaml);
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

