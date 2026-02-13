/**
 * External System Delete Module
 *
 * Deletes external systems from dataplane and confirms before removal.
 *
 * @fileoverview External system delete functionality for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const logger = require('../utils/logger');
const { getDeploymentAuth } = require('../utils/token-manager');
const { resolveControllerUrl } = require('../utils/controller-url');
const { getExternalSystemConfig, deleteExternalSystem } = require('../api/external-systems.api');

/**
 * Validates system key format
 * @param {string} systemKey - System key to validate
 */
function validateSystemKey(systemKey) {
  if (!systemKey || typeof systemKey !== 'string') {
    throw new Error('System key is required and must be a string');
  }
  if (!/^[a-z0-9-_]+$/.test(systemKey)) {
    throw new Error('System key must contain only lowercase letters, numbers, hyphens, and underscores');
  }
}

/**
 * Gets dataplane URL and authentication configuration
 * @async
 * @param {string} systemKey - System key
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Auth and dataplane details
 */
async function getAuthAndDataplane(systemKey, _options) {
  const { resolveEnvironment } = require('../core/config');
  const environment = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const authConfig = await getDeploymentAuth(controllerUrl, environment, systemKey);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
  }

  const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
  logger.log(chalk.blue('🌐 Resolving dataplane URL...'));
  const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);

  return { authConfig, dataplaneUrl, environment, controllerUrl };
}

/**
 * Fetches external system configuration for warning display
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} systemKey - System key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<Object>} System config response data
 */
async function fetchExternalSystemConfig(dataplaneUrl, systemKey, authConfig) {
  const response = await getExternalSystemConfig(dataplaneUrl, systemKey, authConfig);
  if (!response || response.success === false) {
    throw new Error(response?.error || response?.formattedError || `External system '${systemKey}' not found`);
  }
  return response.data?.data || response.data || {};
}

/**
 * Formats datasources for warning output
 * @param {Array} dataSources - Datasource objects
 * @returns {string[]} Datasource labels
 */
function formatDatasourceList(dataSources) {
  if (!Array.isArray(dataSources)) {
    return [];
  }
  return dataSources
    .map(ds => ds.key || ds.displayName || 'unknown-datasource')
    .filter(Boolean);
}

/**
 * Prompts for delete confirmation if needed
 * @async
 * @param {string} systemKey - System key
 * @param {string[]} datasources - Datasource keys
 * @param {Object} options - Command options
 * @returns {Promise<boolean>} True if confirmed
 */
async function confirmDeletion(systemKey, datasources, options) {
  if (options.yes || options.force) {
    return true;
  }

  logger.log(chalk.yellow(`\n⚠️  Warning: Deleting external system '${systemKey}' will also delete all associated datasources:`));
  if (datasources.length > 0) {
    datasources.forEach(ds => logger.log(chalk.yellow(` - ${ds}`)));
  } else {
    logger.log(chalk.yellow(' - (no datasources found)'));
  }

  const answer = await inquirer.prompt([{
    type: 'input',
    name: 'confirm',
    message: `Are you sure you want to delete external system '${systemKey}'? (yes/no):`,
    default: 'no'
  }]);

  return String(answer.confirm).trim().toLowerCase() === 'yes';
}

/**
 * Deletes an external system from dataplane
 * @async
 * @function deleteExternalSystemCommand
 * @param {string} systemKey - System key
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 * @throws {Error} If deletion fails or is cancelled
 */
async function deleteExternalSystemCommand(systemKey, options = {}) {
  validateSystemKey(systemKey);

  const { authConfig, dataplaneUrl } = await getAuthAndDataplane(systemKey, options);
  const configData = await fetchExternalSystemConfig(dataplaneUrl, systemKey, authConfig);
  const dataSources = formatDatasourceList(configData.dataSources || []);

  const confirmed = await confirmDeletion(systemKey, dataSources, options);
  if (!confirmed) {
    logger.log(chalk.yellow('Deletion cancelled.'));
    return;
  }

  const response = await deleteExternalSystem(dataplaneUrl, systemKey, authConfig);
  if (!response || response.success === false) {
    throw new Error(response?.error || response?.formattedError || `Failed to delete external system '${systemKey}'`);
  }

  logger.log(chalk.green(`✓ External system '${systemKey}' deleted successfully`));
  logger.log(chalk.green('✓ All associated datasources have been removed'));
}

module.exports = {
  deleteExternalSystem: deleteExternalSystemCommand
};
