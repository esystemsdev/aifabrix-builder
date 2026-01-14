/**
 * @fileoverview Wizard prompt utilities for interactive external system creation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs').promises;

/**
 * Prompt for wizard mode selection
 * @async
 * @function promptForMode
 * @returns {Promise<string>} Selected mode ('create-system' | 'add-datasource')
 */
async function promptForMode() {
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'What would you like to do?',
      choices: [
        { name: 'Create a new external system', value: 'create-system' },
        { name: 'Add datasource to existing system', value: 'add-datasource' }
      ]
    }
  ]);
  return mode;
}

/**
 * Prompt for source type selection
 * @async
 * @function promptForSourceType
 * @returns {Promise<string>} Selected source type
 */
async function promptForSourceType() {
  const { sourceType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sourceType',
      message: 'What is your source type?',
      choices: [
        { name: 'OpenAPI file (local file)', value: 'openapi-file' },
        { name: 'OpenAPI URL (remote URL)', value: 'openapi-url' },
        { name: 'MCP server', value: 'mcp-server' },
        { name: 'Known platform (pre-configured)', value: 'known-platform' }
      ]
    }
  ]);
  return sourceType;
}

/**
 * Prompt for OpenAPI file path
 * @async
 * @function promptForOpenApiFile
 * @returns {Promise<string>} File path
 */
async function promptForOpenApiFile() {
  const { filePath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filePath',
      message: 'Enter the path to your OpenAPI file:',
      validate: async(input) => {
        if (!input || typeof input !== 'string' || input.trim().length === 0) {
          return 'File path is required';
        }
        const resolvedPath = path.resolve(input);
        try {
          const stats = await fs.stat(resolvedPath);
          if (!stats.isFile()) {
            return 'Path must be a file';
          }
          return true;
        } catch (error) {
          return `File not found: ${input}`;
        }
      }
    }
  ]);
  return path.resolve(filePath);
}

/**
 * Prompt for OpenAPI URL
 * @async
 * @function promptForOpenApiUrl
 * @returns {Promise<string>} URL
 */
async function promptForOpenApiUrl() {
  const { url } = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter the OpenAPI URL:',
      validate: (input) => {
        if (!input || typeof input !== 'string' || input.trim().length === 0) {
          return 'URL is required';
        }
        try {
          new URL(input);
          return true;
        } catch (error) {
          return 'Invalid URL format';
        }
      }
    }
  ]);
  return url.trim();
}

/**
 * Prompt for MCP server details
 * @async
 * @function promptForMcpServer
 * @returns {Promise<Object>} Object with serverUrl and token
 */
async function promptForMcpServer() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'serverUrl',
      message: 'Enter MCP server URL:',
      validate: (input) => {
        if (!input || typeof input !== 'string' || input.trim().length === 0) {
          return 'Server URL is required';
        }
        try {
          new URL(input);
          return true;
        } catch (error) {
          return 'Invalid URL format';
        }
      }
    },
    {
      type: 'password',
      name: 'token',
      message: 'Enter MCP server authentication token:',
      validate: (input) => {
        if (!input || typeof input !== 'string' || input.trim().length === 0) {
          return 'Token is required';
        }
        return true;
      }
    }
  ]);
  return {
    serverUrl: answers.serverUrl.trim(),
    token: answers.token
  };
}

/**
 * Prompt for known platform selection
 * @async
 * @function promptForKnownPlatform
 * @param {string[]} [platforms] - List of available platforms (if provided)
 * @returns {Promise<string>} Selected platform key
 */
async function promptForKnownPlatform(platforms = []) {
  // Default platforms if none provided
  const defaultPlatforms = [
    { name: 'HubSpot', value: 'hubspot' },
    { name: 'Salesforce', value: 'salesforce' },
    { name: 'Zendesk', value: 'zendesk' },
    { name: 'Slack', value: 'slack' },
    { name: 'Microsoft 365', value: 'microsoft365' }
  ];

  const choices = platforms.length > 0
    ? platforms.map(p => ({ name: p.displayName || p.key, value: p.key }))
    : defaultPlatforms;

  const { platform } = await inquirer.prompt([
    {
      type: 'list',
      name: 'platform',
      message: 'Select a platform:',
      choices
    }
  ]);
  return platform;
}

/**
 * Prompt for user intent
 * @async
 * @function promptForUserIntent
 * @returns {Promise<string>} User intent
 */
async function promptForUserIntent() {
  const { intent } = await inquirer.prompt([
    {
      type: 'list',
      name: 'intent',
      message: 'What is your primary use case?',
      choices: [
        { name: 'Sales-focused (CRM, leads, deals)', value: 'sales-focused' },
        { name: 'Support-focused (tickets, customers)', value: 'support-focused' },
        { name: 'Marketing-focused (campaigns, contacts)', value: 'marketing-focused' },
        { name: 'General integration', value: 'general' }
      ],
      default: 'general'
    }
  ]);
  return intent;
}

/**
 * Prompt for user preferences
 * @async
 * @function promptForUserPreferences
 * @returns {Promise<Object>} User preferences object
 */
async function promptForUserPreferences() {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'mcp',
      message: 'Enable MCP (Model Context Protocol)?',
      default: false
    },
    {
      type: 'confirm',
      name: 'abac',
      message: 'Enable ABAC (Attribute-Based Access Control)?',
      default: false
    },
    {
      type: 'confirm',
      name: 'rbac',
      message: 'Enable RBAC (Role-Based Access Control)?',
      default: false
    }
  ]);
  return {
    mcp: answers.mcp,
    abac: answers.abac,
    rbac: answers.rbac
  };
}

/**
 * Prompt for configuration review and editing
 * @async
 * @function promptForConfigReview
 * @param {Object} systemConfig - System configuration
 * @param {Object[]} datasourceConfigs - Array of datasource configurations
 * @returns {Promise<Object>} Object with review decision and optionally edited configs
 */
async function promptForConfigReview(systemConfig, datasourceConfigs) {
  // eslint-disable-next-line no-console
  console.log('\n📋 Generated Configuration:');
  // eslint-disable-next-line no-console
  console.log('\nSystem Configuration:');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(systemConfig, null, 2));
  // eslint-disable-next-line no-console
  console.log('\nDatasource Configurations:');
  datasourceConfigs.forEach((ds, index) => {
    // eslint-disable-next-line no-console
    console.log(`\nDatasource ${index + 1}:`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(ds, null, 2));
  });

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Accept and save', value: 'accept' },
        { name: 'Edit configuration manually', value: 'edit' },
        { name: 'Cancel', value: 'cancel' }
      ]
    }
  ]);

  if (action === 'cancel') {
    return { action: 'cancel' };
  }

  if (action === 'edit') {
    const { editedConfig } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'editedConfig',
        message: 'Edit the configuration (JSON format):',
        default: JSON.stringify({ systemConfig, datasourceConfigs }, null, 2),
        validate: (input) => {
          try {
            JSON.parse(input);
            return true;
          } catch (error) {
            return `Invalid JSON: ${error.message}`;
          }
        }
      }
    ]);

    const parsed = JSON.parse(editedConfig);
    return {
      action: 'edit',
      systemConfig: parsed.systemConfig,
      datasourceConfigs: parsed.datasourceConfigs
    };
  }

  return { action: 'accept' };
}

/**
 * Prompt for application name
 * @async
 * @function promptForAppName
 * @param {string} [defaultName] - Default application name
 * @returns {Promise<string>} Application name
 */
async function promptForAppName(defaultName) {
  const { appName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'appName',
      message: 'Enter application name:',
      default: defaultName,
      validate: (input) => {
        if (!input || typeof input !== 'string' || input.trim().length === 0) {
          return 'Application name is required';
        }
        if (!/^[a-z0-9-_]+$/.test(input)) {
          return 'Application name must contain only lowercase letters, numbers, hyphens, and underscores';
        }
        return true;
      }
    }
  ]);
  return appName.trim();
}

module.exports = {
  promptForMode,
  promptForSourceType,
  promptForOpenApiFile,
  promptForOpenApiUrl,
  promptForMcpServer,
  promptForKnownPlatform,
  promptForUserIntent,
  promptForUserPreferences,
  promptForConfigReview,
  promptForAppName
};

