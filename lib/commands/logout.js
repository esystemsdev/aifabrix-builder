/**
 * AI Fabrix Builder - Logout Command
 *
 * Handles clearing authentication tokens from config.yaml
 * Supports clearing all tokens or specific tokens based on options
 *
 * @fileoverview Logout command implementation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const {
  clearDeviceToken,
  clearAllDeviceTokens,
  clearClientToken,
  clearAllClientTokens,
  clearClientTokensForEnvironment,
  normalizeControllerUrl,
  CONFIG_FILE
} = require('../core/config');
const logger = require('../utils/logger');

/**
 * Validate environment key format
 * @param {string} envKey - Environment key to validate
 * @throws {Error} If environment key format is invalid
 */
function validateEnvironmentKey(envKey) {
  if (!/^[a-z0-9-_]+$/i.test(envKey)) {
    throw new Error('Environment key must contain only letters, numbers, hyphens, and underscores');
  }
}

/**
 * Validate controller URL format
 * @param {string} url - Controller URL to validate
 * @throws {Error} If URL format is invalid
 */
function validateControllerUrl(url) {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    throw new Error('Controller URL is required and must be a non-empty string');
  }
  const normalized = normalizeControllerUrl(url);
  // Check for valid URL format: http:// or https:// followed by valid hostname
  // Hostname should be localhost or contain at least one dot (domain)
  try {
    const urlObj = new URL(normalized);
    const hostname = urlObj.hostname;
    // Allow localhost or hostnames with at least one dot (domain)
    if (hostname !== 'localhost' && !hostname.includes('.')) {
      throw new Error('Controller URL must be a valid HTTP or HTTPS URL');
    }
  } catch (urlError) {
    throw new Error('Controller URL must be a valid HTTP or HTTPS URL');
  }
}

/**
 * Clear device tokens based on options
 * @async
 * @param {Object} options - Logout options
 * @returns {Promise<number>} Number of device tokens cleared
 */
async function clearDeviceTokens(options) {
  if (options.controller) {
    // Clear specific controller device token
    const cleared = await clearDeviceToken(options.controller);
    if (cleared) {
      logger.log(chalk.green(`✓ Cleared device token for controller: ${options.controller}`));
      return 1;
    }
    logger.log(chalk.gray(`  No device token found for controller: ${options.controller}`));
    return 0;
  }

  if (!options.environment && !options.app) {
    // Clear all device tokens (only when no environment/app specified)
    const cleared = await clearAllDeviceTokens();
    if (cleared > 0) {
      logger.log(chalk.green(`✓ Cleared ${cleared} device token(s)`));
    } else {
      logger.log(chalk.gray('  No device tokens found'));
    }
    return cleared;
  }

  return 0;
}

/**
 * Clear client tokens based on options
 * @async
 * @param {Object} options - Logout options
 * @returns {Promise<number>} Number of client tokens cleared
 */
async function clearClientTokens(options) {
  if (options.app && options.environment) {
    // Clear specific app token in environment
    const cleared = await clearClientToken(options.environment, options.app);
    if (cleared) {
      logger.log(chalk.green(`✓ Cleared client token for app '${options.app}' in environment '${options.environment}'`));
      return 1;
    }
    logger.log(chalk.gray(`  No client token found for app '${options.app}' in environment '${options.environment}'`));
    return 0;
  }

  if (options.environment && !options.app) {
    // Clear all client tokens for environment
    const cleared = await clearClientTokensForEnvironment(options.environment);
    if (cleared > 0) {
      logger.log(chalk.green(`✓ Cleared ${cleared} client token(s) for environment '${options.environment}'`));
    } else {
      logger.log(chalk.gray(`  No client tokens found for environment '${options.environment}'`));
    }
    return cleared;
  }

  if (!options.controller && !options.environment && !options.app) {
    // Clear all client tokens (only when no specific options specified)
    const cleared = await clearAllClientTokens();
    if (cleared > 0) {
      logger.log(chalk.green(`✓ Cleared ${cleared} client token(s)`));
    } else {
      logger.log(chalk.gray('  No client tokens found'));
    }
    return cleared;
  }

  return 0;
}

/**
 * Handle logout command action
 * @async
 * @function handleLogout
 * @param {Object} options - Logout options
 * @param {string} [options.controller] - Clear device tokens for specific controller
 * @param {string} [options.environment] - Clear client tokens for specific environment
 * @param {string} [options.app] - Clear client tokens for specific app (requires --environment)
 * @returns {Promise<void>} Resolves when logout completes
 * @throws {Error} If logout fails or options are invalid
 */
async function handleLogout(options) {
  const configPath = CONFIG_FILE;
  logger.log(chalk.blue('\n🔓 Clearing authentication tokens...\n'));

  // Validate options
  if (options.app && !options.environment) {
    throw new Error('--app requires --environment option');
  }

  if ('controller' in options && options.controller !== undefined && options.controller !== null) {
    validateControllerUrl(options.controller);
  }

  if ('environment' in options && options.environment !== undefined && options.environment !== null) {
    validateEnvironmentKey(options.environment);
  }

  // Clear device tokens
  const deviceTokensCleared = await clearDeviceTokens(options);

  // Clear client tokens
  const clientTokensCleared = await clearClientTokens(options);

  // Summary
  const totalCleared = deviceTokensCleared + clientTokensCleared;
  if (totalCleared > 0) {
    logger.log(chalk.green('\n✅ Successfully cleared tokens!'));
    logger.log(chalk.gray(`Config file: ${configPath}\n`));
  } else {
    logger.log(chalk.yellow('\n⚠️  No tokens found to clear'));
    logger.log(chalk.gray(`Config file: ${configPath}\n`));
  }
}

module.exports = { handleLogout };

