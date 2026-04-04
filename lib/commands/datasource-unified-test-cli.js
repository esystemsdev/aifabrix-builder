/**
 * @fileoverview CLI wiring for `datasource test`, `test-integration`, and `test-e2e` (unified validation + watch).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { runDatasourceTestIntegration } = require('../datasource/test-integration');
const { runDatasourceTestE2E } = require('../datasource/test-e2e');
const { runUnifiedDatasourceValidation } = require('../datasource/unified-validation-run');
const { displayIntegrationTestResults, displayE2EResults } = require('../utils/external-system-display');
const {
  exitFromUnifiedValidationResult,
  finalizeUnifiedValidationResult,
  unifiedCliResultFromIntegrationReturn,
  exitAfterIntegrationDisplay,
  finalizeAfterIntegrationDisplay,
  emitCapabilityScopeDiagnostics
} = require('./datasource-validation-cli');
const { resolveAppKeyForDatasource } = require('../datasource/resolve-app');
const { runDatasourceValidationWatchLoop } = require('../utils/datasource-validation-watch');
const { computeExitCodeFromDatasourceTestRun } = require('../utils/datasource-test-run-exit');
const { analyzeCapabilityScope } = require('../utils/datasource-test-run-capability-scope');
const {
  resolveDebugDisplayMode,
  formatDatasourceTestRunDebugBlock
} = require('../utils/datasource-test-run-debug-display');
const { formatCapabilityFocusSection } = require('../utils/datasource-test-run-display');

function logDatasourceTestRunDebugAppendix(envelope, debugOpt) {
  const mode = resolveDebugDisplayMode(debugOpt);
  if (!mode || !envelope) return;
  const block = formatDatasourceTestRunDebugBlock(envelope, mode, process.stdout.isTTY);
  if (block) logger.log(block);
}

function logE2eCapabilityFocusFromEnvelope(env, capabilityOpt) {
  if (!env) return;
  const capKey =
    capabilityOpt !== undefined && capabilityOpt !== null
      ? String(capabilityOpt).trim()
      : '';
  if (!capKey) return;
  const sec = formatCapabilityFocusSection(env, capKey);
  if (sec) logger.log(sec);
}

/**
 * Legacy E2E display + exit code (no process.exit; plan §3.14 watch).
 * @param {Object} data
 * @param {Object} options
 * @returns {number}
 */
function finalizeDatasourceTestE2ELegacyPath(data, options) {
  displayE2EResults(data, options.verbose);
  logDatasourceTestRunDebugAppendix(data.datasourceTestRun, options.debug);
  logE2eCapabilityFocusFromEnvelope(data.datasourceTestRun, options.capability);
  const env = data.datasourceTestRun;
  if (env) {
    emitCapabilityScopeDiagnostics(env, { requestedCapabilityKey: options.capability });
    let code = computeExitCodeFromDatasourceTestRun(env, {
      warningsAsErrors: false,
      requireCert: false
    });
    const scope = analyzeCapabilityScope(env, options.capability);
    if (options.strictCapabilityScope === true && scope.violated) {
      code = Math.max(code, 1);
    }
    return code;
  }
  const steps = data.steps || data.completedActions || [];
  const failed = data.success === false || steps.some(s => s.success === false || s.error);
  return failed ? 1 : 0;
}

/**
 * @param {object} cmd - Commander command (chainable)
 * @returns {object}
 */
function attachDatasourceWatchOptions(cmd) {
  return cmd
    .option(
      '--watch',
      'Re-run when watched files change (debounced; integration tree + optional paths)'
    )
    .option(
      '--watch-path <path>',
      'Extra file or directory to watch (repeatable)',
      (value, previous) => (Array.isArray(previous) ? previous : []).concat(value),
      []
    )
    .option('--watch-application-yaml', 'Include integration/<app>/application.yaml in the watch set')
    .option('--watch-ci', 'Exit after the first run with the normal exit code (CI one-shot)')
    .option('--watch-full-diff', 'Print full before/after fingerprint lines when the result changes');
}

function buildDatasourceTestRunOpts(options) {
  return {
    app: options.app,
    environment: options.env,
    runType: 'test',
    payload: options.payload,
    debug: options.debug,
    verbose: options.verbose,
    timeout: options.timeout,
    async: options.async !== false,
    noAsync: options.async === false
  };
}

function buildDatasourceTestDisplayOpts(options) {
  return {
    json: options.json,
    summary: options.summary,
    warningsAsErrors: options.warningsAsErrors,
    requireCert: options.requireCert,
    debug: options.debug
  };
}

async function runDatasourceUnifiedTestOnceForWatch(datasourceKey, runOpts, displayOpts) {
  try {
    const result = await runUnifiedDatasourceValidation(datasourceKey, runOpts);
    return {
      exitCode: finalizeUnifiedValidationResult(result, displayOpts),
      envelope: result.envelope
    };
  } catch (err) {
    logger.error(chalk.red('❌ Datasource test failed:'), err.message);
    return { exitCode: 4, envelope: null };
  }
}

async function datasourceTestCommandAction(datasourceKey, options) {
  const runOpts = buildDatasourceTestRunOpts(options);
  const displayOpts = buildDatasourceTestDisplayOpts(options);
  try {
    if (options.watch) {
      const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
      await runDatasourceValidationWatchLoop({
        appKey,
        extraPaths: options.watchPath || [],
        includeApplicationYaml: options.watchApplicationYaml === true,
        watchCi: options.watchCi === true,
        watchFullDiff: options.watchFullDiff === true,
        runOnce: () => runDatasourceUnifiedTestOnceForWatch(datasourceKey, runOpts, displayOpts)
      });
      return;
    }
    const result = await runUnifiedDatasourceValidation(datasourceKey, runOpts);
    exitFromUnifiedValidationResult(result, displayOpts);
  } catch (error) {
    logger.error(chalk.red('❌ Datasource test failed:'), error.message);
    process.exit(4);
  }
}

function chainDatasourceTestCommand(datasource) {
  return datasource
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
    .option('--require-cert', 'Exit 2 when certificate missing or not_passed');
}

function setupDatasourceTestCommand(datasource) {
  attachDatasourceWatchOptions(chainDatasourceTestCommand(datasource)).action(datasourceTestCommandAction);
}

function buildIntegrationTestOpts(options) {
  return {
    app: options.app,
    payload: options.payload,
    environment: options.env,
    debug: options.debug,
    verbose: options.verbose,
    timeout: options.timeout
  };
}

function buildIntegrationUnifiedDisplayOpts(options) {
  return {
    json: options.json,
    summary: options.summary,
    warningsAsErrors: options.warningsAsErrors,
    requireCert: options.requireCert,
    debug: options.debug
  };
}

async function runIntegrationOnceForWatch(datasourceKey, integOpts, options, unifiedDisplayOpts) {
  try {
    const result = await runDatasourceTestIntegration(datasourceKey, integOpts);
    const unifiedModes =
      options.json || options.summary || options.warningsAsErrors || options.requireCert;
    if (unifiedModes) {
      const uni = unifiedCliResultFromIntegrationReturn(result);
      const exitCode = finalizeUnifiedValidationResult(uni, unifiedDisplayOpts);
      return { exitCode, envelope: uni.envelope };
    }
    displayIntegrationTestResults(
      {
        systemKey: result.systemKey || 'unknown',
        datasourceResults: [result],
        success: result.success
      },
      options.verbose
    );
    logDatasourceTestRunDebugAppendix(result.datasourceTestRun, options.debug);
    const exitCode = finalizeAfterIntegrationDisplay(result, {});
    return { exitCode, envelope: result.datasourceTestRun || null };
  } catch (err) {
    logger.error(chalk.red('❌ Integration test failed:'), err.message);
    return { exitCode: 4, envelope: null };
  }
}

async function integrationTestCommandAction(datasourceKey, options) {
  const integOpts = buildIntegrationTestOpts(options);
  const unifiedDisplayOpts = buildIntegrationUnifiedDisplayOpts(options);
  try {
    if (options.watch) {
      const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
      await runDatasourceValidationWatchLoop({
        appKey,
        extraPaths: options.watchPath || [],
        includeApplicationYaml: options.watchApplicationYaml === true,
        watchCi: options.watchCi === true,
        watchFullDiff: options.watchFullDiff === true,
        runOnce: () => runIntegrationOnceForWatch(datasourceKey, integOpts, options, unifiedDisplayOpts)
      });
      return;
    }
    const result = await runDatasourceTestIntegration(datasourceKey, integOpts);
    const unifiedModes =
      options.json || options.summary || options.warningsAsErrors || options.requireCert;
    if (unifiedModes) {
      exitFromUnifiedValidationResult(unifiedCliResultFromIntegrationReturn(result), unifiedDisplayOpts);
      return;
    }
    displayIntegrationTestResults(
      {
        systemKey: result.systemKey || 'unknown',
        datasourceResults: [result],
        success: result.success
      },
      options.verbose
    );
    logDatasourceTestRunDebugAppendix(result.datasourceTestRun, options.debug);
    exitAfterIntegrationDisplay(result, {});
  } catch (error) {
    logger.error(chalk.red('❌ Integration test failed:'), error.message);
    process.exit(4);
  }
}

function chainDatasourceTestIntegrationCommand(datasource) {
  return datasource
    .command('test-integration <datasourceKey>')
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
    .option('--require-cert', 'Exit 2 when certificate missing or not_passed');
}

function setupDatasourceTestIntegrationCommand(datasource) {
  attachDatasourceWatchOptions(chainDatasourceTestIntegrationCommand(datasource)).action(
    integrationTestCommandAction
  );
}

/**
 * @param {string} datasourceKey
 * @param {Object} options
 * @returns {Promise<{ exitCode: number, envelope: Object|null }>}
 */
async function runDatasourceTestE2ECliOnce(datasourceKey, options) {
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
    const exitCode = finalizeUnifiedValidationResult(
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
        debug: options.debug,
        requestedCapabilityKey: options.capability,
        strictCapabilityScope: options.strictCapabilityScope === true
      }
    );
    return { exitCode, envelope: data.datasourceTestRun };
  }
  const exitCode = finalizeDatasourceTestE2ELegacyPath(data, options);
  return { exitCode, envelope: data.datasourceTestRun || null };
}

async function runDatasourceTestE2ECliAction(datasourceKey, options) {
  const { exitCode } = await runDatasourceTestE2ECliOnce(datasourceKey, options);
  process.exit(exitCode);
}

async function e2eTestCommandAction(datasourceKey, options) {
  try {
    if (options.watch) {
      const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
      await runDatasourceValidationWatchLoop({
        appKey,
        extraPaths: options.watchPath || [],
        includeApplicationYaml: options.watchApplicationYaml === true,
        watchCi: options.watchCi === true,
        watchFullDiff: options.watchFullDiff === true,
        runOnce: async() => {
          try {
            return await runDatasourceTestE2ECliOnce(datasourceKey, options);
          } catch (err) {
            logger.error(chalk.red('❌ E2E test failed:'), err.message);
            return { exitCode: 3, envelope: null };
          }
        }
      });
      return;
    }
    await runDatasourceTestE2ECliAction(datasourceKey, options);
  } catch (error) {
    logger.error(chalk.red('❌ E2E test failed:'), error.message);
    process.exit(3);
  }
}

function chainDatasourceTestE2ECommand(datasource) {
  return datasource
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
    .option(
      '--strict-capability-scope',
      'Exit 1 if --capability is set but the report lists more than one capabilities[] row (plan §2.3)'
    )
    .option('--json', 'Print raw DatasourceTestRun JSON to stdout')
    .option('--summary', 'Print compact summary line')
    .option('--warnings-as-errors', 'Exit 1 when root status is warn')
    .option('--require-cert', 'Exit 2 when certificate missing or not_passed');
}

function setupDatasourceTestE2ECommand(datasource) {
  attachDatasourceWatchOptions(chainDatasourceTestE2ECommand(datasource)).action(e2eTestCommandAction);
}

module.exports = {
  setupDatasourceTestCommand,
  setupDatasourceTestIntegrationCommand,
  setupDatasourceTestE2ECommand
};
