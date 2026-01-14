/**
 * AI Fabrix Builder - Datasource Commands
 *
 * Handles datasource validation, listing, comparison, and deployment
 * Commands: datasource validate, datasource list, datasource diff, datasource deploy
 *
 * @fileoverview Datasource management commands for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { validateDatasourceFile } = require('../datasource/validate');
const { listDatasources } = require('../datasource/list');
const { compareDatasources } = require('../datasource/diff');
const { deployDatasource } = require('../datasource/deploy');

/**
 * Setup datasource management commands
 * @param {Command} program - Commander program instance
 */
function setupDatasourceCommands(program) {
  const datasource = program
    .command('datasource')
    .description('Manage external data sources');

  // Validate command
  datasource
    .command('validate <file>')
    .description('Validate external datasource JSON file')
    .action(async(file) => {
      try {
        const result = await validateDatasourceFile(file);
        if (result.valid) {
          logger.log(chalk.green(`\n✓ Datasource file is valid: ${file}`));
        } else {
          logger.log(chalk.red(`\n✗ Datasource file has errors: ${file}`));
          result.errors.forEach(error => {
            logger.log(chalk.red(`  • ${error}`));
          });
          process.exit(1);
        }
      } catch (error) {
        logger.error(chalk.red('❌ Validation failed:'), error.message);
        process.exit(1);
      }
    });

  // List command
  datasource
    .command('list')
    .description('List datasources from environment')
    .requiredOption('-e, --environment <env>', 'Environment ID or key')
    .action(async(options) => {
      try {
        await listDatasources(options);
      } catch (error) {
        logger.error(chalk.red('❌ Failed to list datasources:'), error.message);
        process.exit(1);
      }
    });

  // Diff command
  datasource
    .command('diff <file1> <file2>')
    .description('Compare two datasource configuration files (for dataplane)')
    .action(async(file1, file2) => {
      try {
        await compareDatasources(file1, file2);
      } catch (error) {
        logger.error(chalk.red('❌ Diff failed:'), error.message);
        process.exit(1);
      }
    });

  // Deploy command
  datasource
    .command('deploy <myapp> <file>')
    .description('Deploy datasource to dataplane')
    .requiredOption('--controller <url>', 'Controller URL')
    .requiredOption('-e, --environment <env>', 'Environment (miso, dev, tst, pro)')
    .action(async(myapp, file, options) => {
      try {
        await deployDatasource(myapp, file, options);
      } catch (error) {
        logger.error(chalk.red('❌ Deployment failed:'), error.message);
        process.exit(1);
      }
    });
}

module.exports = { setupDatasourceCommands };

