/**
 * AI Fabrix Builder - Datasource Commands
 *
 * Handles datasource validation, listing, comparison, deployment, and online validation runs.
 * Subcommands `test`, `test-integration`, and `test-e2e` call the dataplane unified validation API; permissions are summarized in `docs/commands/permissions.md`.
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
const { runUnifiedDatasourceValidation } = require('../datasource/unified-validation-run');
const { runLogViewer } = require('../datasource/log-viewer');
const { displayIntegrationTestResults, displayE2EResults } = require('../utils/external-system-display');
const {
  exitFromUnifiedValidationResult,
  unifiedCliResultFromIntegrationReturn,
  exitAfterIntegrationDisplay
} = require('./datasource-validation-cli');
const { computeExitCodeFromDatasourceTestRun } = require('../utils/datasource-test-run-exit');
const {
  resolveDebugDisplayMode,
  formatDatasourceTestRunDebugBlock
} = require('../utils/datasource-test-run-debug-display');

function logDatasourceTestRunDebugAppendix(envelope, debugOpt) {
  const mode = resolveDebugDisplayMode(debugOpt);
  if (!mode || !envelope) return;
  const block = formatDatasourceTestRunDebugBlock(envelope, mode, process.stdout.isTTY);
  if (block) logger.log(block);
}

const DATASOURCE_HELP_AFTER = `
Subcommands:
  validate <file>              Validate datasource JSON
  list                         List datasources (env from config)
  diff / upload                Compare files or deploy to dataplane
  test <key>                   Structural/policy validation via unified dataplane API (DatasourceTestRun)
  test-integration / test-e2e  Integration or E2E run via the same unified validation API
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
  datasource.command('upload <systemKey> <file>')
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

function setupDatasourceTestCommand(datasource) {
  datasource
    .command('test <datasourceKey>')
    .description('Structural/policy validation for one datasource (unified dataplane API, runType=test)')
    .option(
      '-a, --app <app>',
      'Integration folder name (optional: resolve from cwd or datasource key if single match)'
    )
    .option('-e, --env <env>', 'Environment: dev, tst, or pro')
    .option('-p, --payload <file>', 'Optional custom payload file (sets payloadTemplate on request)')
    .option('-v, --verbose', 'Set explain=true on validation request')
    .option(
      '--debug [level]',
      'includeDebug on request; TTY appendix: summary (default), full, or raw (not with --json)'
    )
    .option('--timeout <ms>', 'Aggregate timeout for POST + polls', '30000')
    .option('--no-async', 'Do not poll; fail if report is not complete in first response')
    .option('--json', 'Print raw DatasourceTestRun JSON to stdout')
    .option('--summary', 'Print compact summary line (plan §16.9 subset)')
    .option('--warnings-as-errors', 'Exit 1 when root status is warn')
    .option('--require-cert', 'Exit 2 when certificate missing or not_passed')
    .action(async(datasourceKey, options) => {
      try {
        const result = await runUnifiedDatasourceValidation(datasourceKey, {
          app: options.app,
          environment: options.env,
          runType: 'test',
          payload: options.payload,
          debug: options.debug,
          verbose: options.verbose,
          timeout: options.timeout,
          async: options.async !== false,
          noAsync: options.async === false
        });
        exitFromUnifiedValidationResult(result, {
          json: options.json,
          summary: options.summary,
          warningsAsErrors: options.warningsAsErrors,
          requireCert: options.requireCert,
          debug: options.debug
        });
      } catch (error) {
        logger.error(chalk.red('❌ Datasource test failed:'), error.message);
        process.exit(4);
      }
    });
}

function setupDatasourceTestIntegrationCommand(datasource) {
  datasource.command('test-integration <datasourceKey>')
    .description('Integration test one datasource (unified validation API, runType=integration)')
    .option(
      '-a, --app <app>',
      'Integration folder name (optional: resolve from cwd or datasource key if single match)'
    )
    .option('-p, --payload <file>', 'Path to custom test payload file')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro')
    .option('-v, --verbose', 'Explain mode and detailed output where available')
    .option(
      '--debug [level]',
      'includeDebug + log under integration/<systemKey>/logs/; TTY appendix: summary, full, or raw'
    )
    .option('--timeout <ms>', 'Aggregate timeout for POST + polls (ms)', '30000')
    .option('--json', 'Print raw DatasourceTestRun JSON to stdout')
    .option('--summary', 'Print compact summary line')
    .option('--warnings-as-errors', 'Exit 1 when root status is warn')
    .option('--require-cert', 'Exit 2 when certificate missing or not_passed')
    .action(async(datasourceKey, options) => {
      try {
        const result = await runDatasourceTestIntegration(datasourceKey, {
          app: options.app,
          payload: options.payload,
          environment: options.env,
          debug: options.debug,
          verbose: options.verbose,
          timeout: options.timeout
        });
        const unifiedModes =
          options.json || options.summary || options.warningsAsErrors || options.requireCert;
        if (unifiedModes) {
          exitFromUnifiedValidationResult(unifiedCliResultFromIntegrationReturn(result), {
            json: options.json,
            summary: options.summary,
            warningsAsErrors: options.warningsAsErrors,
            requireCert: options.requireCert,
            debug: options.debug
          });
          return;
        }
        displayIntegrationTestResults({
          systemKey: result.systemKey || 'unknown',
          datasourceResults: [result],
          success: result.success
        }, options.verbose);
        logDatasourceTestRunDebugAppendix(result.datasourceTestRun, options.debug);
        exitAfterIntegrationDisplay(result, {});
      } catch (error) {
        logger.error(chalk.red('❌ Integration test failed:'), error.message);
        process.exit(4);
      }
    });
}

async function runDatasourceTestE2ECliAction(datasourceKey, options) {
  const data = await runDatasourceTestE2E(datasourceKey, {
    app: options.app,
    environment: options.env,
    debug: options.debug,
    verbose: options.verbose,
    async: options.async !== false,
    testCrud: options.testCrud,
    recordId: options.recordId,
    cleanup: options.cleanup,
    primaryKeyValue: options.primaryKeyValue,
    timeout: options.timeout,
    capabilityKey: options.capability
  });
  const unifiedModes =
    options.json || options.summary || options.warningsAsErrors || options.requireCert;
  if (unifiedModes && data.datasourceTestRun) {
    exitFromUnifiedValidationResult(
      {
        apiError: null,
        pollTimedOut: false,
        incompleteNoAsync: false,
        envelope: data.datasourceTestRun
      },
      {
        json: options.json,
        summary: options.summary,
        warningsAsErrors: options.warningsAsErrors,
        requireCert: options.requireCert,
        debug: options.debug
      }
    );
    return;
  }
  displayE2EResults(data, options.verbose);
  logDatasourceTestRunDebugAppendix(data.datasourceTestRun, options.debug);
  const env = data.datasourceTestRun;
  if (env) {
    process.exit(
      computeExitCodeFromDatasourceTestRun(env, {
        warningsAsErrors: false,
        requireCert: false
      })
    );
  }
  const steps = data.steps || data.completedActions || [];
  const failed = data.success === false || steps.some(s => s.success === false || s.error);
  process.exit(failed ? 1 : 0);
}

function setupDatasourceTestE2ECommand(datasource) {
  datasource
    .command('test-e2e <datasourceKey>')
    .description('E2E test one datasource (unified validation API, runType=e2e)')
    .option(
      '-a, --app <app>',
      'Integration folder name (default: resolve from cwd if inside integration/<systemKey>/)'
    )
    .option('-e, --env <env>', 'Environment: dev, tst, or pro')
    .option('-v, --verbose', 'Audit / explain-oriented request flags where applicable')
    .option(
      '--debug [level]',
      'includeDebug + log under integration/<systemKey>/logs/; TTY appendix: summary, full, or raw'
    )
    .option('--test-crud', 'Enable CRUD lifecycle test (e2eOptions.testCrud)')
    .option('--record-id <id>', 'Record ID for test (e2eOptions.recordId)')
    .option('--no-cleanup', 'Disable cleanup after test (e2eOptions.cleanup: false)')
    .option(
      '--primary-key-value <value|@path>',
      'Primary key value or path to JSON file (e.g. @pk.json) for e2eOptions.primaryKeyValue'
    )
    .option('--no-async', 'Use sync mode (no polling); single POST when server allows')
    .option('--timeout <ms>', 'Aggregate timeout for POST + polls (default 15m)', String(15 * 60 * 1000))
    .option('--capability <key>', 'Optional capability drill-down (forwarded in e2eOptions when supported)')
    .option('--json', 'Print raw DatasourceTestRun JSON to stdout')
    .option('--summary', 'Print compact summary line')
    .option('--warnings-as-errors', 'Exit 1 when root status is warn')
    .option('--require-cert', 'Exit 2 when certificate missing or not_passed')
    .action(async(datasourceKey, options) => {
      try {
        await runDatasourceTestE2ECliAction(datasourceKey, options);
      } catch (error) {
        logger.error(chalk.red('❌ E2E test failed:'), error.message);
        process.exit(3);
      }
    });
}

function setupDatasourceLogE2ECommand(datasource) {
  datasource.command('log-e2e <datasourceKey>')
    .description('Show E2E test log (latest or --file)')
    .option(
      '-a, --app <app>',
      'Integration folder name (optional: resolve from cwd or datasource key if single match)'
    )
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
    .option(
      '-a, --app <app>',
      'Integration folder name (optional: resolve from cwd or datasource key if single match)'
    )
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
  setupDatasourceTestCommand(datasource);
  setupDatasourceTestIntegrationCommand(datasource);
  setupDatasourceTestE2ECommand(datasource);
  setupDatasourceLogE2ECommand(datasource);
  setupDatasourceLogIntegrationCommand(datasource);
}

module.exports = { setupDatasourceCommands };

