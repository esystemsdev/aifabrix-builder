/**
 * AI Fabrix Builder - Application Registration Commands
 *
 * Handles application registration, listing, and credential rotation
 * Commands: app register, app list, app rotate-secret
 *
 * @fileoverview Application management commands for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const yaml = require('js-yaml');
const { getConfig } = require('../config');
const { authenticatedApiCall } = require('../utils/api');
const logger = require('../utils/logger');

// Import createApp to auto-generate config if missing
let createApp;
try {
  createApp = require('../app').createApp;
} catch {
  createApp = null;
}

/**
 * Validation schema for application registration
 */
const registerApplicationSchema = {
  environmentId: (val) => {
    if (!val || val.length < 1) {
      throw new Error('Invalid environment ID format');
    }
    return val;
  },
  key: (val) => {
    if (!val || val.length < 1) {
      throw new Error('Application key is required');
    }
    if (val.length > 50) {
      throw new Error('Application key must be at most 50 characters');
    }
    if (!/^[a-z0-9-]+$/.test(val)) {
      throw new Error('Application key must contain only lowercase letters, numbers, and hyphens');
    }
    return val;
  },
  displayName: (val) => {
    if (!val || val.length < 1) {
      throw new Error('Display name is required');
    }
    if (val.length > 100) {
      throw new Error('Display name must be at most 100 characters');
    }
    return val;
  },
  description: (val) => val || undefined,
  configuration: (val) => {
    const validTypes = ['webapp', 'api', 'service', 'functionapp'];
    const validRegistryModes = ['acr', 'external', 'public'];

    if (!val || !val.type || !validTypes.includes(val.type)) {
      throw new Error('Configuration type must be one of: webapp, api, service, functionapp');
    }
    if (!val.registryMode || !validRegistryModes.includes(val.registryMode)) {
      throw new Error('Registry mode must be one of: acr, external, public');
    }
    if (val.port !== undefined) {
      if (!Number.isInteger(val.port) || val.port < 1 || val.port > 65535) {
        throw new Error('Port must be an integer between 1 and 65535');
      }
    }
    return val;
  }
};

/**
 * Load variables.yaml file for an application
 * @async
 * @param {string} appKey - Application key
 * @returns {Promise<{variables: Object, created: boolean}>} Variables and creation flag
 */
async function loadVariablesYaml(appKey) {
  const variablesPath = path.join(process.cwd(), 'builder', appKey, 'variables.yaml');

  try {
    const variablesContent = await fs.readFile(variablesPath, 'utf-8');
    return { variables: yaml.load(variablesContent), created: false };
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.log(chalk.yellow(`⚠️  variables.yaml not found for ${appKey}`));
      logger.log(chalk.yellow('📝 Creating minimal configuration...\n'));
      return { variables: null, created: true };
    }
    throw new Error(`Failed to read variables.yaml: ${error.message}`);
  }
}

/**
 * Create minimal application configuration if needed
 * @async
 * @param {string} appKey - Application key
 * @param {Object} options - Registration options
 * @returns {Promise<Object>} Variables after creation
 */
async function createMinimalAppIfNeeded(appKey, options) {
  if (!createApp) {
    throw new Error('Cannot auto-create application: createApp function not available');
  }

  await createApp(appKey, {
    port: options.port,
    language: 'typescript',
    database: false,
    redis: false,
    storage: false,
    authentication: false
  });

  const variablesPath = path.join(process.cwd(), 'builder', appKey, 'variables.yaml');
  const variablesContent = await fs.readFile(variablesPath, 'utf-8');
  return yaml.load(variablesContent);
}

/**
 * Extract application configuration from variables.yaml
 * @param {Object} variables - Variables from YAML file
 * @param {string} appKey - Application key
 * @param {Object} options - Registration options
 * @returns {Object} Extracted configuration
 */
function extractAppConfiguration(variables, appKey, options) {
  const appKeyFromFile = variables.app?.key || appKey;
  const displayName = variables.app?.name || options.name || appKey;
  const description = variables.app?.description || '';
  const appType = variables.build?.language === 'typescript' ? 'webapp' : 'service';
  const registryMode = 'external';
  const port = variables.build?.port || options.port || 3000;
  const language = variables.build?.language || 'typescript';

  return {
    appKey: appKeyFromFile,
    displayName,
    description,
    appType,
    registryMode,
    port,
    language
  };
}

/**
 * Validate application registration data
 * @param {Object} config - Application configuration
 * @param {string} originalAppKey - Original app key for error messages
 * @throws {Error} If validation fails
 */
function validateAppRegistrationData(config, originalAppKey) {
  const missingFields = [];
  if (!config.appKey) missingFields.push('app.key');
  if (!config.displayName) missingFields.push('app.name');

  if (missingFields.length > 0) {
    logger.error(chalk.red('❌ Missing required fields in variables.yaml:'));
    missingFields.forEach(field => logger.error(chalk.red(`   - ${field}`)));
    logger.error(chalk.red(`\n   Please update builder/${originalAppKey}/variables.yaml and try again.`));
    process.exit(1);
  }

  try {
    registerApplicationSchema.key(config.appKey);
    registerApplicationSchema.displayName(config.displayName);
    registerApplicationSchema.configuration({
      type: config.appType,
      registryMode: config.registryMode,
      port: config.port
    });
  } catch (error) {
    logger.error(chalk.red(`❌ Invalid configuration: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Check if user is authenticated
 * @async
 * @returns {Promise<Object>} Configuration with API URL and token
 */
async function checkAuthentication() {
  const config = await getConfig();
  if (!config.apiUrl || !config.token) {
    logger.error(chalk.red('❌ Not logged in. Run: aifabrix login'));
    process.exit(1);
  }
  return config;
}

/**
 * Call registration API
 * @async
 * @param {string} apiUrl - API URL
 * @param {string} token - Authentication token
 * @param {string} environment - Environment ID
 * @param {Object} registrationData - Registration data
 * @returns {Promise<Object>} API response
 */
async function registerApplication(apiUrl, token, environment, registrationData) {
  const response = await authenticatedApiCall(
    `${apiUrl}/api/v1/environments/${encodeURIComponent(environment)}/applications/register`,
    {
      method: 'POST',
      body: JSON.stringify(registrationData)
    },
    token
  );

  if (!response.success) {
    logger.error(chalk.red(`❌ Registration failed: ${response.error}`));
    process.exit(1);
  }

  return response.data;
}

/**
 * Display registration success and credentials
 * @param {Object} data - Registration response data
 * @param {string} apiUrl - API URL
 */
function displayRegistrationResults(data, apiUrl) {
  logger.log(chalk.green('✅ Application registered successfully!\n'));
  logger.log(chalk.bold('📋 Application Details:'));
  logger.log(`   ID:           ${data.application.id}`);
  logger.log(`   Key:          ${data.application.key}`);
  logger.log(`   Display Name: ${data.application.displayName}\n`);

  logger.log(chalk.bold.yellow('🔑 CREDENTIALS (save these immediately):'));
  logger.log(chalk.yellow(`   Client ID:     ${data.credentials.clientId}`));
  logger.log(chalk.yellow(`   Client Secret: ${data.credentials.clientSecret}\n`));

  logger.log(chalk.red('⚠️  IMPORTANT: Client Secret will not be shown again!\n'));

  logger.log(chalk.bold('📝 Add to GitHub Secrets:'));
  logger.log(chalk.cyan(`   AIFABRIX_CLIENT_ID = ${data.credentials.clientId}`));
  logger.log(chalk.cyan(`   AIFABRIX_CLIENT_SECRET = ${data.credentials.clientSecret}`));
  logger.log(chalk.cyan(`   AIFABRIX_API_URL = ${apiUrl}\n`));
}

/**
 * Setup application management commands
 * @param {Command} program - Commander program instance
 */
function setupAppCommands(program) {
  const app = program
    .command('app')
    .description('Manage applications');

  // Register command
  app
    .command('register <appKey>')
    .description('Register application and get pipeline credentials')
    .requiredOption('-e, --environment <env>', 'Environment ID or key')
    .option('-p, --port <port>', 'Application port (default: from variables.yaml)')
    .option('-n, --name <name>', 'Override display name')
    .option('-d, --description <desc>', 'Override description')
    .action(async(appKey, options) => {
      try {
        logger.log(chalk.blue('📋 Registering application...\n'));

        // Load variables.yaml
        const { variables, created } = await loadVariablesYaml(appKey);
        let finalVariables = variables;

        // Create minimal app if needed
        if (created) {
          finalVariables = await createMinimalAppIfNeeded(appKey, options);
        }

        // Extract configuration
        const appConfig = extractAppConfiguration(finalVariables, appKey, options);

        // Validate configuration (pass original appKey for error messages)
        validateAppRegistrationData(appConfig, appKey);

        // Check authentication
        const config = await checkAuthentication();

        // Validate environment
        const environment = registerApplicationSchema.environmentId(options.environment);

        // Prepare registration data
        const registrationData = {
          environmentId: environment,
          key: appConfig.appKey,
          displayName: appConfig.displayName,
          description: appConfig.description || options.description,
          configuration: {
            type: appConfig.appType,
            registryMode: appConfig.registryMode,
            port: appConfig.port,
            language: appConfig.language
          }
        };

        // Register application
        const responseData = await registerApplication(
          config.apiUrl,
          config.token,
          environment,
          registrationData
        );

        // Display results
        displayRegistrationResults(responseData, config.apiUrl);

      } catch (error) {
        logger.error(chalk.red('❌ Registration failed:'), error.message);
        process.exit(1);
      }
    });

  // List command
  app
    .command('list')
    .description('List applications')
    .requiredOption('-e, --environment <env>', 'Environment ID or key')
    .action(async(options) => {
      try {
        const config = await getConfig();
        if (!config.apiUrl || !config.token) {
          logger.error(chalk.red('❌ Not logged in. Run: aifabrix login'));
          process.exit(1);
        }

        const response = await authenticatedApiCall(
          `${config.apiUrl}/api/v1/applications?environmentId=${options.environment}`,
          {},
          config.token
        );

        if (!response.success || !response.data) {
          logger.error(chalk.red('❌ Failed to fetch applications'));
          process.exit(1);
        }

        logger.log(chalk.bold('\n📱 Applications:\n'));
        response.data.forEach((app) => {
          const hasPipeline = app.configuration?.pipeline?.isActive ? '✓' : '✗';
          logger.log(`${hasPipeline} ${chalk.cyan(app.key)} - ${app.displayName} (${app.status})`);
        });
        logger.log('');

      } catch (error) {
        logger.error(chalk.red('❌ Failed to list applications:'), error.message);
        process.exit(1);
      }
    });

  // Rotate secret command
  app
    .command('rotate-secret')
    .description('Rotate pipeline ClientSecret for an application')
    .requiredOption('-a, --app <appKey>', 'Application key')
    .requiredOption('-e, --environment <env>', 'Environment ID or key')
    .action(async(options) => {
      try {
        logger.log(chalk.yellow('⚠️  This will invalidate the old ClientSecret!\n'));

        const config = await getConfig();
        if (!config.apiUrl || !config.token) {
          logger.error(chalk.red('❌ Not logged in. Run: aifabrix login'));
          process.exit(1);
        }

        // Validate environment
        if (!options.environment || options.environment.length < 1) {
          logger.error(chalk.red('❌ Environment is required'));
          process.exit(1);
        }

        const response = await authenticatedApiCall(
          `${config.apiUrl}/api/v1/applications/${options.app}/rotate-secret?environmentId=${options.environment}`,
          {
            method: 'POST'
          },
          config.token
        );

        if (!response.success) {
          logger.error(chalk.red(`❌ Rotation failed: ${response.error}`));
          process.exit(1);
        }

        logger.log(chalk.green('✅ Secret rotated successfully!\n'));
        logger.log(chalk.bold('📋 Application Details:'));
        logger.log(`   Key:         ${response.data.application?.key || options.app}`);
        logger.log(`   Environment: ${options.environment}\n`);

        logger.log(chalk.bold.yellow('🔑 NEW CREDENTIALS:'));
        logger.log(chalk.yellow(`   Client ID:     ${response.data.credentials.clientId}`));
        logger.log(chalk.yellow(`   Client Secret: ${response.data.credentials.clientSecret}\n`));
        logger.log(chalk.red('⚠️  Old secret is now invalid. Update GitHub Secrets!\n'));

      } catch (error) {
        logger.error(chalk.red('❌ Rotation failed:'), error.message);
        process.exit(1);
      }
    });
}

module.exports = { setupAppCommands };

