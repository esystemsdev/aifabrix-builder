/**
 * Application Prompting Utilities
 *
 * Handles interactive prompts for application configuration
 *
 * @fileoverview Prompt utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const inquirer = require('inquirer');
const { getDefaultControllerUrl } = require('../utils/controller-url');

/**
 * Builds basic questions (port, language)
 * @param {Object} options - Provided options
 * @param {string} [appType] - Application type (webapp, api, service, functionapp, external)
 * @returns {Array} Array of question objects
 */
function buildBasicQuestions(options, appType) {
  const questions = [];

  // Skip port and language for external type
  if (appType === 'external') {
    return questions;
  }

  // Port validation
  if (!options.port) {
    questions.push({
      type: 'input',
      name: 'port',
      message: 'What port should the application run on?',
      default: '3000',
      validate: (input) => {
        const port = parseInt(input, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return 'Port must be a number between 1 and 65535';
        }
        return true;
      }
    });
  }

  // Language selection
  if (!options.language) {
    questions.push({
      type: 'list',
      name: 'language',
      message: 'What language is your application written in?',
      choices: [
        { name: 'TypeScript/Node.js', value: 'typescript' },
        { name: 'Python', value: 'python' }
      ],
      default: 'typescript'
    });
  }

  return questions;
}

/**
 * Builds service questions (database, redis, storage, authentication)
 * @param {Object} options - Provided options
 * @param {string} [appType] - Application type (webapp, api, service, functionapp, external)
 * @returns {Array} Array of question objects
 */
function buildServiceQuestions(options, appType) {
  const questions = [];

  // Skip service questions for external type
  if (appType === 'external') {
    return questions;
  }

  if (!Object.prototype.hasOwnProperty.call(options, 'database')) {
    questions.push({
      type: 'confirm',
      name: 'database',
      message: 'Does your application need a database?',
      default: false
    });
  }

  if (!Object.prototype.hasOwnProperty.call(options, 'redis')) {
    questions.push({
      type: 'confirm',
      name: 'redis',
      message: 'Does your application need Redis?',
      default: false
    });
  }

  if (!Object.prototype.hasOwnProperty.call(options, 'storage')) {
    questions.push({
      type: 'confirm',
      name: 'storage',
      message: 'Does your application need file storage?',
      default: false
    });
  }

  if (!Object.prototype.hasOwnProperty.call(options, 'authentication')) {
    questions.push({
      type: 'confirm',
      name: 'authentication',
      message: 'Does your application need authentication/RBAC?',
      default: false
    });
  }

  return questions;
}

function buildExternalSystemIdentityQuestions(options, appName) {
  const questions = [];
  if (!options.systemKey) {
    questions.push({
      type: 'input',
      name: 'systemKey',
      message: 'What is the system key?',
      default: appName,
      validate: (input) => {
        if (!input || input.trim().length === 0) return 'System key is required';
        if (!/^[a-z0-9-]+$/.test(input)) return 'System key must contain only lowercase letters, numbers, and hyphens';
        return true;
      }
    });
  }
  if (!options.systemDisplayName) {
    questions.push({
      type: 'input',
      name: 'systemDisplayName',
      message: 'What is the system display name?',
      default: appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      validate: (input) => {
        if (!input || input.trim().length === 0) return 'System display name is required';
        return true;
      }
    });
  }
  if (!options.systemDescription) {
    questions.push({
      type: 'input',
      name: 'systemDescription',
      message: 'What is the system description?',
      default: `External system integration for ${appName}`,
      validate: (input) => {
        if (!input || input.trim().length === 0) return 'System description is required';
        return true;
      }
    });
  }
  return questions;
}

function buildExternalSystemTypeQuestions(options) {
  const questions = [];
  if (!options.systemType) {
    questions.push({
      type: 'list',
      name: 'systemType',
      message: 'What is the system type?',
      choices: [
        { name: 'OpenAPI', value: 'openapi' },
        { name: 'MCP (Model Context Protocol)', value: 'mcp' },
        { name: 'Custom', value: 'custom' }
      ],
      default: 'openapi'
    });
  }
  if (!options.authType) {
    questions.push({
      type: 'list',
      name: 'authType',
      message: 'What authentication type does the system use?',
      choices: [
        { name: 'OAuth2', value: 'oauth2' },
        { name: 'API Key', value: 'apikey' },
        { name: 'Basic Auth', value: 'basic' }
      ],
      default: 'apikey'
    });
  }
  return questions;
}

function buildExternalSystemDatasourceQuestion(options) {
  if (options.datasourceCount) return [];
  return [{
    type: 'input',
    name: 'datasourceCount',
    message: 'How many datasources do you want to create?',
    default: '1',
    validate: (input) => {
      const count = parseInt(input, 10);
      if (isNaN(count) || count < 1 || count > 10) return 'Datasource count must be a number between 1 and 10';
      return true;
    }
  }];
}

/**
 * Builds external system configuration questions
 * @param {Object} options - Provided options
 * @param {string} appName - Application name
 * @returns {Array} Array of question objects
 */
function buildExternalSystemQuestions(options, appName) {
  return [
    ...buildExternalSystemIdentityQuestions(options, appName),
    ...buildExternalSystemTypeQuestions(options),
    ...buildExternalSystemDatasourceQuestion(options)
  ];
}

/**
 * Builds workflow questions (GitHub, Controller)
 * @async
 * @param {Object} options - Provided options
 * @returns {Promise<Array>} Array of question objects
 */
async function buildWorkflowQuestions(options) {
  const questions = [];

  // GitHub workflows
  if (!Object.prototype.hasOwnProperty.call(options, 'github')) {
    questions.push({
      type: 'confirm',
      name: 'github',
      message: 'Do you need GitHub Actions workflows?',
      default: false
    });
  }

  // Controller deployment
  if (!Object.prototype.hasOwnProperty.call(options, 'controller') &&
      options.github !== false) {
    questions.push({
      type: 'confirm',
      name: 'controller',
      message: 'Do you need Controller deployment workflow?',
      default: false,
      when: (answers) => answers.github !== false
    });
  }

  // Controller URL
  if (!options.controllerUrl && options.controller &&
      !Object.prototype.hasOwnProperty.call(options, 'controllerUrl')) {
    const misoHost = process.env.MISO_HOST || 'localhost';
    const defaultControllerUrl = await getDefaultControllerUrl();
    const defaultUrl = defaultControllerUrl.replace('http://localhost:', `http://${misoHost}:`);
    questions.push({
      type: 'input',
      name: 'controllerUrl',
      message: 'Enter Controller URL:',
      default: defaultUrl,
      when: (answers) => answers.controller === true
    });
  }

  return questions;
}

/**
 * Resolves conflicts between options and answers for a specific field
 * @function resolveField
 * @param {*} optionValue - Value from options
 * @param {*} answerValue - Value from answers
 * @param {*} defaultValue - Default value
 * @returns {*} Resolved value
 */
function resolveField(optionValue, answerValue, defaultValue) {
  if (optionValue !== undefined && optionValue !== null) {
    return optionValue;
  }
  if (answerValue !== undefined && answerValue !== null) {
    return answerValue;
  }
  return defaultValue;
}

/**
 * Resolves conflicts between options and answers for optional boolean fields
 * @function resolveOptionalBoolean
 * @param {*} optionValue - Value from options
 * @param {*} answerValue - Value from answers
 * @param {*} defaultValue - Default value
 * @returns {*} Resolved value
 */
function resolveOptionalBoolean(optionValue, answerValue, defaultValue) {
  if (optionValue !== undefined) {
    return optionValue;
  }
  return answerValue !== undefined ? answerValue : defaultValue;
}

/**
 * Resolve a single config field from options or answers
 * @function resolveConfigField
 * @param {Object} options - Provided options
 * @param {Object} answers - Prompt answers
 * @param {string} fieldName - Field name to resolve
 * @param {*} defaultValue - Default value
 * @returns {*} Resolved value
 */
function resolveConfigField(options, answers, fieldName, defaultValue) {
  return resolveField(options[fieldName], answers[fieldName], defaultValue);
}

/**
 * Resolve a single external system field if present
 * @function resolveExternalSystemField
 * @param {Object} options - Provided options
 * @param {Object} answers - Prompt answers
 * @param {string} fieldName - Field name to resolve
 * @param {*} defaultValue - Default value
 * @returns {*|null} Resolved value or null if not present
 */
function resolveExternalSystemField(options, answers, fieldName, defaultValue) {
  if (answers[fieldName] || options[fieldName]) {
    return resolveField(options[fieldName], answers[fieldName], defaultValue);
  }
  return null;
}

/**
 * Resolve external system fields and add to config
 * @function resolveExternalSystemFields
 * @param {Object} options - Provided options
 * @param {Object} answers - Prompt answers
 * @param {Object} config - Configuration object to update
 * @returns {void}
 */
function resolveExternalSystemFields(options, answers, config) {
  const systemKey = resolveExternalSystemField(options, answers, 'systemKey', undefined);
  if (systemKey !== null) {
    config.systemKey = systemKey;
  }

  const systemDisplayName = resolveExternalSystemField(options, answers, 'systemDisplayName', undefined);
  if (systemDisplayName !== null) {
    config.systemDisplayName = systemDisplayName;
  }

  const systemDescription = resolveExternalSystemField(options, answers, 'systemDescription', undefined);
  if (systemDescription !== null) {
    config.systemDescription = systemDescription;
  }

  const systemType = resolveExternalSystemField(options, answers, 'systemType', 'openapi');
  if (systemType !== null) {
    config.systemType = systemType;
  }

  const authType = resolveExternalSystemField(options, answers, 'authType', 'apikey');
  if (authType !== null) {
    config.authType = authType;
  }

  const datasourceCount = resolveExternalSystemField(options, answers, 'datasourceCount', 1);
  if (datasourceCount !== null) {
    config.datasourceCount = parseInt(datasourceCount, 10);
  }
}

/**
 * Resolves conflicts between options and answers
 * @function resolveConflicts
 * @param {Object} options - Provided options
 * @param {Object} answers - Prompt answers
 * @returns {Object} Resolved configuration
 */
function resolveConflicts(options, answers) {
  const config = {
    port: parseInt(resolveConfigField(options, answers, 'port', 3000), 10),
    language: resolveConfigField(options, answers, 'language', 'typescript'),
    database: resolveConfigField(options, answers, 'database', false),
    redis: resolveConfigField(options, answers, 'redis', false),
    storage: resolveConfigField(options, answers, 'storage', false),
    authentication: resolveConfigField(options, answers, 'authentication', false),
    github: resolveOptionalBoolean(options.github, answers.github, false),
    controller: resolveOptionalBoolean(options.controller, answers.controller, false),
    controllerUrl: resolveConfigField(options, answers, 'controllerUrl', undefined)
  };

  resolveExternalSystemFields(options, answers, config);

  return config;
}

/**
 * Merges provided options with prompt answers
 * @param {string} appName - Application name
 * @param {Object} options - Provided options
 * @param {Object} answers - Prompt answers
 * @returns {Object} Complete configuration
 */
function mergePromptAnswers(appName, options, answers) {
  return {
    appName,
    ...resolveConflicts(options, answers)
  };
}

/**
 * Prompt for missing configuration options
 * @param {string} appName - Application name
 * @param {Object} options - Provided options
 * @returns {Promise<Object>} Complete configuration
 */
async function promptForOptions(appName, options) {
  // Get app type from options (default to webapp)
  const appType = options.type || 'webapp';

  // Build questions based on app type
  let questions = [];
  if (appType === 'external') {
    // For external type, prompt for external system configuration
    questions = [
      ...buildExternalSystemQuestions(options, appName),
      ...(await buildWorkflowQuestions(options))
    ];
  } else {
    // For regular apps, use standard prompts
    questions = [
      ...buildBasicQuestions(options, appType),
      ...buildServiceQuestions(options, appType),
      ...(await buildWorkflowQuestions(options))
    ];
  }

  // Prompt for missing options
  const answers = questions.length > 0 ? await inquirer.prompt(questions) : {};

  // Merge provided options with answers
  const merged = mergePromptAnswers(appName, options, answers);

  // Add type to merged config
  merged.type = appType;

  // For external type, remove port and language as they're not applicable
  if (appType === 'external') {
    delete merged.port;
    delete merged.language;
  }

  return merged;
}

module.exports = {
  promptForOptions
};

