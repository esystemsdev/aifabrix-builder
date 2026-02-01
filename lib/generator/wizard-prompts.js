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
 * @param {string} [defaultMode] - Default value ('create-system' | 'add-datasource')
 * @returns {Promise<string>} Selected mode ('create-system' | 'add-datasource')
 */
async function promptForMode(defaultMode) {
  const choices = [
    { name: 'Create a new external system', value: 'create-system' },
    { name: 'Add datasource to existing system', value: 'add-datasource' }
  ];
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'What would you like to do?',
      choices,
      default: defaultMode && choices.some(c => c.value === defaultMode) ? defaultMode : undefined
    }
  ]);
  return mode;
}

/**
 * Prompt for existing system ID or key (for add-datasource mode).
 * Only external systems (OpenAPI, MCP, custom) support add-datasource; webapps do not.
 * @async
 * @function promptForSystemIdOrKey
 * @param {string} [defaultValue] - Default value (e.g. from loaded wizard.yaml)
 * @returns {Promise<string>} System ID or key
 */
async function promptForSystemIdOrKey(defaultValue) {
  const { systemIdOrKey } = await inquirer.prompt([
    {
      type: 'input',
      name: 'systemIdOrKey',
      message: 'Enter the existing external system ID or key (not a webapp):',
      default: defaultValue,
      validate: (input) => {
        if (!input || typeof input !== 'string' || input.trim().length === 0) {
          return 'System ID or key is required';
        }
        return true;
      }
    }
  ]);
  return systemIdOrKey.trim();
}
/**
 * Prompt for source type selection
 * @async
 * @function promptForSourceType
 * @param {Array<{key: string, displayName?: string}>} [platforms] - If provided and non-empty, include "Known platform"; otherwise omit it
 * @returns {Promise<string>} Selected source type
 */
async function promptForSourceType(platforms = []) {
  const choices = [
    { name: 'OpenAPI file (local file)', value: 'openapi-file' },
    { name: 'OpenAPI URL (remote URL)', value: 'openapi-url' },
    { name: 'MCP server', value: 'mcp-server' }
  ];
  if (Array.isArray(platforms) && platforms.length > 0) {
    choices.push({ name: 'Known platform (pre-configured)', value: 'known-platform' });
  }
  const { sourceType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sourceType',
      message: 'What is your source type?',
      choices
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
 * Prompt for credential action (skip / create new / use existing).
 * Choose Skip if you don't have credentials yet; you can add them later in env.template.
 * @async
 * @function promptForCredentialAction
 * @returns {Promise<Object>} Object with action ('skip'|'create'|'select') and optional credentialIdOrKey
 */
async function promptForCredentialAction() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Credential (optional; choose Skip if you don\'t have credentials yet):',
      choices: [
        { name: 'Skip - configure credentials later', value: 'skip' },
        { name: 'Create new', value: 'create' },
        { name: 'Use existing', value: 'select' }
      ]
    }
  ]);
  if (action === 'select') {
    const { credentialIdOrKey } = await inquirer.prompt([
      {
        type: 'input',
        name: 'credentialIdOrKey',
        message: 'Enter credential ID or key (must exist on the dataplane):',
        validate: (input) => {
          if (!input || typeof input !== 'string' || input.trim().length === 0) {
            return 'Credential ID or key is required (or choose Skip at the previous step)';
          }
          return true;
        }
      }
    ]);
    return { action, credentialIdOrKey: credentialIdOrKey.trim() };
  }
  return { action };
}

/**
 * Re-prompt for credential ID/key when validation failed (e.g. not found on dataplane).
 * Empty input means skip.
 * @async
 * @function promptForCredentialIdOrKeyRetry
 * @param {string} [previousError] - Error message from dataplane (e.g. "Credential not found")
 * @returns {Promise<Object>} { credentialIdOrKey: string } or { skip: true } if user leaves empty
 */
async function promptForCredentialIdOrKeyRetry(previousError) {
  const msg = previousError
    ? `Credential not found or invalid (${String(previousError).slice(0, 60)}). Enter ID/key or leave empty to skip:`
    : 'Enter credential ID or key (or leave empty to skip):';
  const { credentialIdOrKey } = await inquirer.prompt([
    {
      type: 'input',
      name: 'credentialIdOrKey',
      message: msg,
      default: ''
    }
  ]);
  const trimmed = (credentialIdOrKey && credentialIdOrKey.trim()) || '';
  return trimmed ? { credentialIdOrKey: trimmed } : { skip: true };
}

/**
 * Prompt for known platform selection
 * @async
 * @function promptForKnownPlatform
 * @param {Array<{key: string, displayName?: string}>} [platforms] - List of available platforms (if provided)
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
      type: 'input',
      name: 'intent',
      message: 'Describe your primary use case (any text):',
      default: 'general integration',
      validate: (input) => {
        if (!input || typeof input !== 'string' || input.trim().length === 0) {
          return 'Intent is required';
        }
        return true;
      }
    }
  ]);
  return intent.trim();
}

/**
 * Prompt for user preferences
 * @async
 * @function promptForUserPreferences
 * @returns {Promise<Object>} User preferences object (fieldOnboardingLevel, mcp, abac, rbac)
 */
async function promptForUserPreferences() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'fieldOnboardingLevel',
      message: 'Field onboarding level:',
      choices: [
        { name: 'full - All fields mapped and indexed', value: 'full' },
        { name: 'standard - Core and important fields only', value: 'standard' },
        { name: 'minimal - Essential fields only', value: 'minimal' }
      ],
      default: 'full'
    },
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
    fieldOnboardingLevel: answers.fieldOnboardingLevel,
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
        { name: 'Cancel', value: 'cancel' }
      ]
    }
  ]);

  if (action === 'cancel') {
    return { action: 'cancel' };
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

/**
 * Prompt: Run with saved config? (Y/n). Used when resuming from existing wizard.yaml.
 * @async
 * @function promptForRunWithSavedConfig
 * @returns {Promise<boolean>} True to run with saved config, false to exit
 */
async function promptForRunWithSavedConfig() {
  const { run } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'run',
      message: 'Run with saved config?',
      default: true
    }
  ]);
  return run;
}

module.exports = {
  promptForMode,
  promptForSystemIdOrKey,
  promptForSourceType,
  promptForOpenApiFile,
  promptForOpenApiUrl,
  promptForMcpServer,
  promptForCredentialAction,
  promptForCredentialIdOrKeyRetry,
  promptForKnownPlatform,
  promptForUserIntent,
  promptForUserPreferences,
  promptForConfigReview,
  promptForAppName,
  promptForRunWithSavedConfig
};

