/**
 * AI Fabrix Builder - Datasource Commands
 *
 * Handles datasource validation, listing, comparison, and deployment
 * Commands: datasource validate, datasource list, datasource diff, datasource upload
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
const { runDatasourceTestIntegration } = require('../datasource/test-integration');
const { runDatasourceTestE2E } = require('../datasource/test-e2e');
const { runLogViewer } = require('../datasource/log-viewer');
const { displayIntegrationTestResults, displayE2EResults } = require('../utils/external-system-display');

const DATASOURCE_HELP_AFTER = `
Subcommands:
  validate <file>              Validate datasource JSON
  list                         List datasources (env from config)
  diff / upload                Compare files or deploy to dataplane
  test-integration / test-e2e  Run pipeline tests for one datasource key
  log-integration / log-e2e    Show saved test logs
`;

function setupDatasourceValidateCommand(datasource) {
  datasource.command('validate <file>')
    .description('Validate datasource JSON file')
    .action(async(file) => {
      try {
        const result = await validateDatasourceFile(file);
        if (result.valid) {
          logger.log(chalk.green(`\n✓ Datasource file is valid: ${file}`));
        } else {
          logger.log(chalk.red(`\n✗ Datasource file has errors: ${file}`));
          result.errors.forEach(error => logger.log(chalk.red(`  • ${error}`)));
          process.exit(1);
        }
      } catch (error) {
        logger.error(chalk.red('❌ Validation failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceListCommand(datasource) {
  datasource.command('list')
    .description('List datasources for environment in config')
    .action(async() => {
      try {
        await listDatasources({});
      } catch (error) {
        logger.error(chalk.red('❌ Failed to list datasources:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceDiffCommand(datasource) {
  datasource.command('diff <file1> <file2>')
    .description('Diff two datasource JSON files')
    .action(async(file1, file2) => {
      try {
        await compareDatasources(file1, file2);
      } catch (error) {
        logger.error(chalk.red('❌ Diff failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceUploadCommand(datasource) {
  datasource.command('upload <myapp> <file>')
    .description('Deploy datasource file to dataplane')
    .action(async(myapp, file, options) => {
      try {
        await deployDatasource(myapp, file, options);
      } catch (error) {
        logger.error(chalk.red('❌ Upload failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceTestIntegrationCommand(datasource) {
  datasource.command('test-integration <datasourceKey>')
    .description('Integration test one datasource via dataplane')
    .option('-a, --app <appKey>', 'App key (optional: resolve from cwd or datasource key if single match)')
    .option('-p, --payload <file>', 'Path to custom test payload file')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro')
    .option('-v, --verbose', 'Show detailed step and validation output')
    .option('--debug', 'Include debug output and write log to integration/<appKey>/logs/')
    .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
    .action(async(datasourceKey, options) => {
      try {
        const result = await runDatasourceTestIntegration(datasourceKey, {
          app: options.app,
          payload: options.payload,
          environment: options.env,
          debug: options.debug,
          timeout: options.timeout
        });
        displayIntegrationTestResults({
          systemKey: result.systemKey || 'unknown',
          datasourceResults: [result],
          success: result.success
        }, options.verbose);
        if (!result.success) process.exit(1);
      } catch (error) {
        logger.error(chalk.red('❌ Integration test failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceTestE2ECommand(datasource) {
  datasource.command('test-e2e <datasourceKey>')
    .description('E2E test one datasource via dataplane (full pipeline)')
    .option('-a, --app <appKey>', 'App key (default: resolve from cwd if inside integration/<appKey>/)')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro')
    .option('-v, --verbose', 'Show detailed step output and poll progress')
    .option('--debug', 'Include debug output and write log to integration/<appKey>/logs/')
    .option('--test-crud', 'Enable CRUD lifecycle test (body testCrud: true)')
    .option('--record-id <id>', 'Record ID for test (body recordId)')
    .option('--no-cleanup', 'Disable cleanup after test (body cleanup: false)')
    .option('--primary-key-value <value|@path>', 'Primary key value or path to JSON file (e.g. @pk.json) for body primaryKeyValue')
    .option('--no-async', 'Use sync mode (no polling); single POST, no asyncRun')
    .action(async(datasourceKey, options) => {
      try {
        const data = await runDatasourceTestE2E(datasourceKey, {
          app: options.app,
          environment: options.env,
          debug: options.debug,
          verbose: options.verbose,
          async: options.async !== false,
          testCrud: options.testCrud,
          recordId: options.recordId,
          cleanup: options.cleanup,
          primaryKeyValue: options.primaryKeyValue
        });
        displayE2EResults(data, options.verbose);
        const steps = data.steps || data.completedActions || [];
        const failed = data.success === false || steps.some(s => s.success === false || s.error);
        if (failed) process.exit(1);
      } catch (error) {
        logger.error(chalk.red('❌ E2E test failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceLogE2ECommand(datasource) {
  datasource.command('log-e2e <datasourceKey>')
    .description('Show E2E test log (latest or --file)')
    .option('-a, --app <appKey>', 'App key (optional: resolve from cwd or datasource key if single match)')
    .option('-f, --file <path>', 'Path to log file (default: latest in app logs folder)')
    .action(async(datasourceKey, options) => {
      try {
        await runLogViewer(datasourceKey, {
          app: options.app,
          file: options.file,
          logType: 'test-e2e'
        });
      } catch (error) {
        logger.error(chalk.red('❌ log-e2e failed:'), error.message);
        process.exit(1);
      }
    });
}

function setupDatasourceLogIntegrationCommand(datasource) {
  datasource.command('log-integration <datasourceKey>')
    .description('Show integration test log (latest or --file)')
    .option('-a, --app <appKey>', 'App key (optional: resolve from cwd or datasource key if single match)')
    .option('-f, --file <path>', 'Path to log file (default: latest in app logs folder)')
    .action(async(datasourceKey, options) => {
      try {
        await runLogViewer(datasourceKey, {
          app: options.app,
          file: options.file,
          logType: 'test-integration'
        });
      } catch (error) {
        logger.error(chalk.red('❌ log-integration failed:'), error.message);
        process.exit(1);
      }
    });
}

/**
 * Setup datasource management commands
 * @param {Command} program - Commander program instance
 */
function setupDatasourceCommands(program) {
  const datasource = program
    .command('datasource')
    .description('Datasource JSON: validate, list, deploy, test, logs')
    .addHelpText('after', DATASOURCE_HELP_AFTER);
  if (typeof datasource.alias === 'function') {
    datasource.alias('ds');
  }
  setupDatasourceValidateCommand(datasource);
  setupDatasourceListCommand(datasource);
  setupDatasourceDiffCommand(datasource);
  setupDatasourceUploadCommand(datasource);
  setupDatasourceTestIntegrationCommand(datasource);
  setupDatasourceTestE2ECommand(datasource);
  setupDatasourceLogE2ECommand(datasource);
  setupDatasourceLogIntegrationCommand(datasource);
}

module.exports = { setupDatasourceCommands };

