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

        // 1. Load variables.yaml from builder/{appKey}/variables.yaml
        const variablesPath = path.join(process.cwd(), 'builder', appKey, 'variables.yaml');

        let variables;
        let createNeeded = false;

        // Check if variables.yaml exists
        try {
          const variablesContent = await fs.readFile(variablesPath, 'utf-8');
          variables = yaml.load(variablesContent);
        } catch (error) {
          if (error.code === 'ENOENT') {
            // File doesn't exist - create minimal configuration
            logger.log(chalk.yellow(`⚠️  variables.yaml not found for ${appKey}`));
            logger.log(chalk.yellow('📝 Creating minimal configuration...\n'));
            createNeeded = true;
          } else {
            throw new Error(`Failed to read variables.yaml: ${error.message}`);
          }
        }

        // 2. If no variables.yaml, create minimal app first
        if (createNeeded) {
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

          // Re-read variables.yaml after creation
          const variablesContent = await fs.readFile(variablesPath, 'utf-8');
          variables = yaml.load(variablesContent);
        }

        // 3. Extract and validate required information from variables.yaml
        const appKeyFromFile = variables.app?.key || appKey;
        const displayName = variables.app?.name || options.name || appKey;
        const description = variables.app?.description || '';
        const appType = variables.build?.language === 'typescript' ? 'webapp' : 'service';
        const registryMode = 'external'; // Default for new apps
        const port = variables.build?.port || options.port || 3000;
        const language = variables.build?.language || 'typescript';

        // Check for missing required fields
        const missingFields = [];
        if (!appKeyFromFile) missingFields.push('app.key');
        if (!displayName) missingFields.push('app.name');

        if (missingFields.length > 0) {
          logger.error(chalk.red('❌ Missing required fields in variables.yaml:'));
          missingFields.forEach(field => logger.error(chalk.red(`   - ${field}`)));
          logger.error(chalk.red(`\n   Please update builder/${appKey}/variables.yaml and try again.`));
          process.exit(1);
        }

        // 4. Validate configuration
        try {
          registerApplicationSchema.key(appKeyFromFile);
          registerApplicationSchema.displayName(displayName);
          registerApplicationSchema.configuration({
            type: appType,
            registryMode: registryMode,
            port: port
          });
        } catch (error) {
          logger.error(chalk.red(`❌ Invalid configuration: ${error.message}`));
          process.exit(1);
        }

        // 5. Get stored config (API URL, token) for registration
        const config = await getConfig();
        if (!config.apiUrl || !config.token) {
          logger.error(chalk.red('❌ Not logged in. Run: aifabrix login'));
          process.exit(1);
        }

        // 6. Prepare registration data with validated fields from variables.yaml
        const registrationData = {
          environmentId: registerApplicationSchema.environmentId(options.environment),
          key: appKeyFromFile,
          displayName: displayName,
          description: description || options.description,
          configuration: {
            type: appType,
            registryMode: registryMode,
            port: port,
            language: language
          }
        };

        // 7. Call registration API to miso-controller
        const response = await authenticatedApiCall(
          `${config.apiUrl}/api/applications/register`,
          {
            method: 'POST',
            body: JSON.stringify(registrationData)
          },
          config.token
        );

        if (!response.success) {
          logger.error(chalk.red(`❌ Registration failed: ${response.error}`));
          process.exit(1);
        }

        // Display success + credentials
        logger.log(chalk.green('✅ Application registered successfully!\n'));
        logger.log(chalk.bold('📋 Application Details:'));
        logger.log(`   ID:           ${response.data.application.id}`);
        logger.log(`   Key:          ${response.data.application.key}`);
        logger.log(`   Display Name: ${response.data.application.displayName}\n`);

        logger.log(chalk.bold.yellow('🔑 CREDENTIALS (save these immediately):'));
        logger.log(chalk.yellow(`   Client ID:     ${response.data.credentials.clientId}`));
        logger.log(chalk.yellow(`   Client Secret: ${response.data.credentials.clientSecret}\n`));

        logger.log(chalk.red('⚠️  IMPORTANT: Client Secret will not be shown again!\n'));

        logger.log(chalk.bold('📝 Add to GitHub Secrets:'));
        logger.log(chalk.cyan(`   AIFABRIX_CLIENT_ID = ${response.data.credentials.clientId}`));
        logger.log(chalk.cyan(`   AIFABRIX_CLIENT_SECRET = ${response.data.credentials.clientSecret}`));
        logger.log(chalk.cyan(`   AIFABRIX_API_URL = ${config.apiUrl}\n`));

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
          `${config.apiUrl}/api/applications?environmentId=${options.environment}`,
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
          `${config.apiUrl}/api/applications/${options.app}/rotate-secret?environmentId=${options.environment}`,
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

