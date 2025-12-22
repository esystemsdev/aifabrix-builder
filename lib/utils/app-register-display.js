/**
 * AI Fabrix Builder - App Register Display Utilities
 *
 * Display and formatting utilities for application registration results
 *
 * @fileoverview Display utilities for app registration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('./logger');

/**
 * Get environment prefix for GitHub Secrets
 * @param {string} environment - Environment key (e.g., 'dev', 'tst', 'pro', 'miso')
 * @returns {string} Uppercase prefix (e.g., 'DEV', 'TST', 'PRO', 'MISO')
 */
function getEnvironmentPrefix(environment) {
  if (!environment) {
    return 'DEV';
  }
  // Convert to uppercase and handle common variations
  const env = environment.toLowerCase();
  if (env === 'dev' || env === 'development') {
    return 'DEV';
  }
  if (env === 'tst' || env === 'test' || env === 'staging') {
    return 'TST';
  }
  if (env === 'pro' || env === 'prod' || env === 'production') {
    return 'PRO';
  }
  // For other environments (e.g., 'miso'), uppercase the entire string
  // Use full string if 4 characters or less, otherwise use first 4 characters
  const upper = environment.toUpperCase();
  return upper.length <= 4 ? upper : upper.substring(0, 4);
}

/**
 * Display registration success and credentials
 * @param {Object} data - Registration response data
 * @param {string} apiUrl - API URL
 * @param {string} environment - Environment key
 */
function displayRegistrationResults(data, apiUrl, environment) {
  logger.log(chalk.green('✅ Application registered successfully!\n'));
  logger.log(chalk.bold('📋 Application Details:'));
  logger.log(`   ID:           ${data.application.id}`);
  logger.log(`   Key:          ${data.application.key}`);
  logger.log(`   Display Name: ${data.application.displayName}\n`);

  logger.log(chalk.bold.yellow('🔑 CREDENTIALS (save these immediately):'));
  logger.log(chalk.yellow(`   Client ID:     ${data.credentials.clientId}`));
  logger.log(chalk.yellow(`   Client Secret: ${data.credentials.clientSecret}\n`));

  logger.log(chalk.red('⚠️  IMPORTANT: Client Secret will not be shown again!\n'));

  const envPrefix = getEnvironmentPrefix(environment);
  logger.log(chalk.bold('📝 Add to GitHub Secrets:'));
  logger.log(chalk.cyan('   Repository level:'));
  logger.log(chalk.cyan(`     MISO_CONTROLLER_URL = ${apiUrl}`));
  logger.log(chalk.cyan(`\n   Environment level (${environment}):`));
  logger.log(chalk.cyan(`     ${envPrefix}_MISO_CLIENTID = ${data.credentials.clientId}`));
  logger.log(chalk.cyan(`     ${envPrefix}_MISO_CLIENTSECRET = ${data.credentials.clientSecret}\n`));
}

module.exports = { displayRegistrationResults, getEnvironmentPrefix };

