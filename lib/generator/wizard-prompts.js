/**
 * @fileoverview Wizard prompt utilities for interactive external system creation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs').promises;
const { formatCredentialWithStatus } = require('../utils/credential-display');

/**
 * Prompt for wizard mode selection
 * @async
 * @function promptForMode
 * @param {string} [defaultMode] - Default value ('create-system' | 'add-datasource')
 * @param {boolean} [allowAddDatasource=true] - If false, only show "Create a new external system"
 * @returns {Promise<string>} Selected mode ('create-system' | 'add-datasource')
 */
async function promptForMode(defaultMode, allowAddDatasource = true) {
  const choices = [
    { name: 'Create a new external system', value: 'create-system' },
    ...(allowAddDatasource ? [{ name: 'Add datasource to existing system', value: 'add-datasource' }] : [])
  ];
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'What would you like to do?',
      choices,
      pageSize: 10,
      default: defaultMode && choices.some(c => c.value === defaultMode) ? defaultMode : undefined
    }
  ]);
  return mode;
}

/**
 * Prompt for existing system ID or key (for add-datasource mode).
 * Only external systems (OpenAPI, MCP, custom) support add-datasource; webapps do not.
 * When a list is available, use promptForExistingSystem instead to show a selection list.
 * @async
 * @function promptForSystemIdOrKey
 * @param {string} [defaultValue] - Default value (e.g. from loaded wizard.yaml)
 * @returns {Promise<string>} System ID or key
 */
async function promptForSystemIdOrKey(defaultValue) {
  return promptForExistingSystemInput(defaultValue);
}

/**
 * Prompt to select an existing external system: show a list from the dataplane when available, otherwise ask for ID/key.
 * @async
 * @function promptForExistingSystem
 * @param {Array<{key?: string, id?: string, displayName?: string}>} [systemsList] - External systems from GET /api/v1/external/systems (or empty/null on error)
 * @param {string} [defaultValue] - Default value (e.g. from loaded wizard.yaml)
 * @returns {Promise<string>} Selected system ID or key
 */
async function promptForExistingSystem(systemsList = [], defaultValue) {
  const list = Array.isArray(systemsList) ? systemsList : [];
  if (list.length > 0) {
    const choices = list.map((s) => {
      const value = s.key ?? s.id ?? '';
      const displayName = s.displayName ?? s.name ?? value;
      const name = displayName === value ? String(value) : `${displayName} (${value})`;
      return { name: String(name), value };
    }).filter((c) => c.value);
    if (choices.length === 0) {
      return promptForExistingSystemInput(defaultValue);
    }
    const { systemIdOrKey } = await inquirer.prompt([
      {
        type: 'list',
        name: 'systemIdOrKey',
        message: 'Select an existing external system (not a webapp):',
        choices,
        pageSize: 10
      }
    ]);
    return systemIdOrKey;
  }
  return promptForExistingSystemInput(defaultValue);
}

/**
 * Prompt for external system ID or key via free-text input (used when list is empty or API failed).
 * @async
 * @function promptForExistingSystemInput
 * @param {string} [defaultValue] - Default value
 * @returns {Promise<string>} System ID or key
 */
async function promptForExistingSystemInput(defaultValue) {
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
      choices,
      pageSize: 10
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
 * When "Use existing" is chosen, the caller should fetch credentials and call promptForExistingCredential.
 * @async
 * @function promptForCredentialAction
 * @returns {Promise<Object>} Object with action ('skip'|'create'|'select'); credentialIdOrKey only when action is 'select' and chosen via promptForExistingCredential
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
  return { action };
}

/**
 * Prompt to select an existing credential: show a list from the dataplane when available, otherwise ask for ID/key.
 * @async
 * @function promptForExistingCredential
 * @param {Array<{key?: string, id?: string, credentialKey?: string, displayName?: string, name?: string, status?: string}>} [credentialsList] - Credentials from GET /api/v1/wizard/credentials (or empty/null on error)
 * @returns {Promise<{credentialIdOrKey: string}>} Selected credential ID or key
 */
async function promptForExistingCredential(credentialsList = []) {
  const list = Array.isArray(credentialsList) ? credentialsList : [];
  if (list.length > 0) {
    const choices = list.map((c) => {
      const { name: baseName, statusFormatted, statusLabel } = formatCredentialWithStatus(c);
      const name = statusFormatted
        ? `${statusFormatted} ${baseName}${statusLabel}`
        : String(baseName);
      const value = c.key ?? c.id ?? c.credentialKey ?? '';
      return { name, value };
    }).filter((c) => c.value);
    if (choices.length === 0) {
      return promptForExistingCredentialInput();
    }
    const { credentialIdOrKey } = await inquirer.prompt([
      {
        type: 'list',
        name: 'credentialIdOrKey',
        message: 'Select a credential:',
        choices,
        pageSize: 10
      }
    ]);
    return { credentialIdOrKey };
  }
  return promptForExistingCredentialInput();
}

/**
 * Prompt for credential ID or key via free-text input (used when list is empty or API failed).
 * @async
 * @function promptForExistingCredentialInput
 * @returns {Promise<{credentialIdOrKey: string}>}
 */
async function promptForExistingCredentialInput() {
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
  return { credentialIdOrKey: credentialIdOrKey.trim() };
}

/**
 * Prompt for user intent
 * @async
 * @function promptForUserIntent
 * @returns {Promise<string>} User intent
 */
const WIZARD_INTENT_MAX_LENGTH = 1000;

async function promptForUserIntent() {
  const { intent } = await inquirer.prompt([
    {
      type: 'input',
      name: 'intent',
      message: `Describe your primary use case (max ${WIZARD_INTENT_MAX_LENGTH} characters):`,
      default: 'general integration',
      validate: (input) => {
        if (!input || typeof input !== 'string' || input.trim().length === 0) {
          return 'Intent is required';
        }
        if (input.length > WIZARD_INTENT_MAX_LENGTH) {
          return `Intent must be ${WIZARD_INTENT_MAX_LENGTH} characters or fewer`;
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

const secondary = require('./wizard-prompts-secondary');

module.exports = {
  WIZARD_INTENT_MAX_LENGTH,
  promptForMode,
  promptForSystemIdOrKey,
  promptForExistingSystem,
  promptForSourceType,
  promptForOpenApiFile,
  promptForOpenApiUrl,
  promptForMcpServer,
  promptForCredentialAction,
  promptForExistingCredential,
  promptForCredentialIdOrKeyRetry: secondary.promptForCredentialIdOrKeyRetry,
  promptForKnownPlatform: secondary.promptForKnownPlatform,
  promptForEntitySelection: secondary.promptForEntitySelection,
  promptForUserIntent,
  promptForUserPreferences,
  promptForConfigReview: secondary.promptForConfigReview,
  promptForAppName,
  promptForRunWithSavedConfig
};

