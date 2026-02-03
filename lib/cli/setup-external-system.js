/**
 * CLI external system command setup (download, delete, test, test-integration).
 *
 * @fileoverview External system command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { handleCommandError } = require('../utils/cli-utils');

/**
 * Sets up external system commands
 * @param {Command} program - Commander program instance
 */
function setupExternalSystemCommands(program) {
  program.command('download <system-key>')
    .description('Download external system from dataplane to local development structure')
    .option('--dry-run', 'Show what would be downloaded without actually downloading')
    .action(async(systemKey, options) => {
      try {
        const download = require('../external-system/download');
        await download.downloadExternalSystem(systemKey, options);
      } catch (error) {
        handleCommandError(error, 'download');
        process.exit(1);
      }
    });

  program.command('delete <system-key>')
    .description('Delete external system from dataplane (also deletes all associated datasources)')
    .option('--type <type>', 'Application type (external) - required for external systems')
    .option('--yes', 'Skip confirmation prompt')
    .option('--force', 'Skip confirmation prompt (alias for --yes)')
    .action(async(systemKey, options) => {
      try {
        if (options.type !== 'external') {
          throw new Error('Delete command for external systems requires --type external');
        }
        const externalDelete = require('../external-system/delete');
        await externalDelete.deleteExternalSystem(systemKey, options);
      } catch (error) {
        handleCommandError(error, 'delete');
        process.exit(1);
      }
    });

  program.command('test <app>')
    .description('Run unit tests for external system (local validation, no API calls)')
    .option('-d, --datasource <key>', 'Test specific datasource only')
    .option('-v, --verbose', 'Show detailed validation output')
    .action(async(appName, options) => {
      try {
        const test = require('../external-system/test');
        const results = await test.testExternalSystem(appName, options);
        test.displayTestResults(results, options.verbose);
        if (!results.valid) {
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'test');
        process.exit(1);
      }
    });

  program.command('test-integration <app>')
    .description('Run integration tests via dataplane pipeline API')
    .option('-d, --datasource <key>', 'Test specific datasource only')
    .option('-p, --payload <file>', 'Path to custom test payload file')
    .option('--dataplane <url>', 'Dataplane URL (default: discovered from controller)')
    .option('-v, --verbose', 'Show detailed test output')
    .option('--timeout <ms>', 'Request timeout in milliseconds', '30000')
    .action(async(appName, options) => {
      try {
        const test = require('../external-system/test');
        const results = await test.testExternalSystemIntegration(appName, options);
        test.displayIntegrationTestResults(results, options.verbose);
        if (!results.success) {
          process.exit(1);
        }
      } catch (error) {
        handleCommandError(error, 'test-integration');
        process.exit(1);
      }
    });
}

module.exports = { setupExternalSystemCommands };
