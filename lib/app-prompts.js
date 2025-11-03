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

/**
 * Builds basic questions (port, language)
 * @param {Object} options - Provided options
 * @returns {Array} Array of question objects
 */
function buildBasicQuestions(options) {
  const questions = [];

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
 * @returns {Array} Array of question objects
 */
function buildServiceQuestions(options) {
  const questions = [];

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

/**
 * Builds workflow questions (GitHub, Controller)
 * @param {Object} options - Provided options
 * @returns {Array} Array of question objects
 */
function buildWorkflowQuestions(options) {
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
    questions.push({
      type: 'input',
      name: 'controllerUrl',
      message: 'Enter Controller URL:',
      default: `http://${misoHost}:3000`,
      when: (answers) => answers.controller === true
    });
  }

  return questions;
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
    port: parseInt(options.port || answers.port || 3000, 10),
    language: options.language || answers.language || 'typescript',
    database: options.database || answers.database || false,
    redis: options.redis || answers.redis || false,
    storage: options.storage || answers.storage || false,
    authentication: options.authentication || answers.authentication || false,
    github: options.github !== undefined ? options.github : answers.github || false,
    controller: options.controller !== undefined ? options.controller : answers.controller || false,
    controllerUrl: options.controllerUrl || answers.controllerUrl
  };
}

/**
 * Prompt for missing configuration options
 * @param {string} appName - Application name
 * @param {Object} options - Provided options
 * @returns {Promise<Object>} Complete configuration
 */
async function promptForOptions(appName, options) {
  // Default github to false if not provided (make it truly optional)
  if (!Object.prototype.hasOwnProperty.call(options, 'github')) {
    options.github = false;
  }

  const questions = [
    ...buildBasicQuestions(options),
    ...buildServiceQuestions(options),
    ...buildWorkflowQuestions(options)
  ];

  // Prompt for missing options
  const answers = questions.length > 0 ? await inquirer.prompt(questions) : {};

  // Merge provided options with answers
  return mergePromptAnswers(appName, options, answers);
}

module.exports = {
  promptForOptions
};

