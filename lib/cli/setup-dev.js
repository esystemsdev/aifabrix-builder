/**
 * CLI developer configuration command setup (dev config, dev set-id).
 *
 * @fileoverview Developer command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const config = require('../core/config');
const devConfig = require('../utils/dev-config');
const logger = require('../utils/logger');
const { handleCommandError } = require('../utils/cli-utils');

/**
 * Display developer configuration
 * @param {string} devId - Developer ID
 * @returns {Promise<void>}
 */
async function displayDevConfig(devId) {
  const devIdNum = parseInt(devId, 10);
  const ports = devConfig.getDevPorts(devIdNum);
  const configVars = [
    { key: 'aifabrix-home', value: await config.getAifabrixHomeOverride() },
    { key: 'aifabrix-secrets', value: await config.getAifabrixSecretsPath() },
    { key: 'aifabrix-env-config', value: await config.getAifabrixEnvConfigPath() }
  ].filter(v => v.value);

  logger.log('\n🔧 Developer Configuration\n');
  logger.log(`Developer ID: ${devId}`);
  logger.log('\nPorts:');
  logger.log(`  App: ${ports.app}`);
  logger.log(`  Postgres: ${ports.postgres}`);
  logger.log(`  Redis: ${ports.redis}`);
  logger.log(`  pgAdmin: ${ports.pgadmin}`);
  logger.log(`  Redis Commander: ${ports.redisCommander}`);

  if (configVars.length > 0) {
    logger.log('\nConfiguration:');
    configVars.forEach(v => logger.log(`  ${v.key}: ${v.value}`));
  }
  logger.log('');
}

/**
 * Sets up developer configuration commands
 * @param {Command} program - Commander program instance
 */
function setupDevCommands(program) {
  const dev = program
    .command('dev')
    .description('Developer configuration and isolation');

  dev
    .command('config')
    .description('Show or set developer configuration')
    .option('--set-id <id>', 'Set developer ID')
    .action(async(options) => {
      try {
        const setIdValue = options.setId || options['set-id'];
        if (setIdValue) {
          const digitsOnly = /^[0-9]+$/.test(setIdValue);
          if (!digitsOnly) {
            throw new Error('Developer ID must be a non-negative digit string (0 = default infra, > 0 = developer-specific)');
          }
          await config.setDeveloperId(setIdValue);
          process.env.AIFABRIX_DEVELOPERID = setIdValue;
          logger.log(chalk.green(`✓ Developer ID set to ${setIdValue}`));
          await displayDevConfig(setIdValue);
          return;
        }

        const devId = await config.getDeveloperId();
        await displayDevConfig(devId);
      } catch (error) {
        handleCommandError(error, 'dev config');
        process.exit(1);
      }
    });

  dev
    .command('set-id <id>')
    .description('Set developer ID (convenience alias for "dev config --set-id")')
    .action(async(id) => {
      try {
        const digitsOnly = /^[0-9]+$/.test(id);
        if (!digitsOnly) {
          throw new Error('Developer ID must be a non-negative digit string (0 = default infra, > 0 = developer-specific)');
        }
        await config.setDeveloperId(id);
        process.env.AIFABRIX_DEVELOPERID = id;
        logger.log(chalk.green(`✓ Developer ID set to ${id}`));
        await displayDevConfig(id);
      } catch (error) {
        handleCommandError(error, 'dev set-id');
        process.exit(1);
      }
    });
}

module.exports = { setupDevCommands };
