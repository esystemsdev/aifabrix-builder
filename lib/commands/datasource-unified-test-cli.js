const { formatBlockingError } = require('../utils/cli-test-layout-chalk');
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
const path = require('path');
const { getIntegrationPath } = require('../utils/paths');
const { writeTestLog } = require('../utils/test-log-writer');
const { includeDebugForRequest } = require('../utils/validation-run-request');
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
const {
  datasourceTestHelpAfter,
  datasourceTestIntegrationHelpAfter,
  datasourceTestE2eHelpAfter,
  attachDatasourceWatchOptions,
  attachDatasourceTestCommonOptions,
  attachDatasourceTestE2eExclusiveOptions
} = require('./datasource-unified-test-cli.options');

function integrationBaseDirForLogs(appKey) {
  return path.dirname(getIntegrationPath(appKey));
}

async function writeDatasourceTestDebugLogIfRequested(appKey, datasourceKey, result, options) {
  if (!options || !options.debug) return;
  const requestMeta = {
    datasourceKey,
    runType: 'test',
    includeDebug: includeDebugForRequest(options.debug)
  };
  const envelope = result && typeof result === 'object' ? result.envelope : null;
  const apiError = result && typeof result === 'object' ? result.apiError : null;
  const errorMessage = apiError
    ? apiError.formattedError || apiError.error || 'Request failed'
    : null;
  const data = errorMessage
    ? { request: requestMeta, error: errorMessage }
    : { request: requestMeta, response: envelope };
  const logPath = await writeTestLog(
    appKey,
    data,
    'test',
    integrationBaseDirForLogs(appKey)
  );
  logger.log(chalk.gray(`  Debug log: ${logPath}`));
}

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
 * Exit code from envelope only (no stderr diagnostics; use when TTY output already ran emit via logEnvelope).
 * @param {Object|null|undefined} env
 * @param {Object} options
 * @returns {number|null} null if no envelope
 */
function exitCodeFromDatasourceTestRunEnvelope(env, options) {
  if (!env || typeof env !== 'object') return null;
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

/**
 * Legacy E2E display + exit code (no process.exit; watch mode).
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
    const code = exitCodeFromDatasourceTestRunEnvelope(env, options);
    return code === null ? 1 : code;
  }
  const steps = data.steps || data.completedActions || [];
  const failed = data.success === false || steps.some(s => s.success === false || s.error);
  return failed ? 1 : 0;
}

/**
 * Human TTY for single-datasource E2E when DatasourceTestRun envelope is present.
 * @param {string} datasourceKey
 * @param {Object} env
 * @param {Object} options
 */
function displayDatasourceTestE2EEnvelopeResults(datasourceKey, env, options) {
  const success = env.status !== 'fail';
  displayIntegrationTestResults(
    {
      systemKey: env.systemKey || 'unknown',
      success,
      datasourceResults: [{ key: datasourceKey, success, datasourceTestRun: env }]
    },
    options.verbose,
    {
      debug: options.debug,
      runType: 'e2e',
      requestedCapabilityKey: options.capability
    }
  );
  logE2eCapabilityFocusFromEnvelope(env, options.capability);
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
    noAsync: options.async === false,
    sync: options.sync === true
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
    logger.error(formatBlockingError('Datasource test failed:'), err.message);
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
        runOnce: async() => {
          const result = await runUnifiedDatasourceValidation(datasourceKey, runOpts);
          await writeDatasourceTestDebugLogIfRequested(appKey, datasourceKey, result, options);
          return {
            exitCode: finalizeUnifiedValidationResult(result, displayOpts),
            envelope: result.envelope
          };
        }
      });
      return;
    }
    const result = await runUnifiedDatasourceValidation(datasourceKey, runOpts);
    if (options.debug) {
      try {
        const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
        await writeDatasourceTestDebugLogIfRequested(appKey, datasourceKey, result, options);
      } catch (e) {
        logger.warn(chalk.yellow(`⚠ Could not write debug log: ${e.message}`));
      }
    }
    exitFromUnifiedValidationResult(result, displayOpts);
  } catch (error) {
    logger.error(formatBlockingError('Datasource test failed:'), error.message);
    process.exit(4);
  }
}

function chainDatasourceTestCommand(datasource) {
  const cmd = datasource
    .command('test <datasourceKey>')
    .description('Structural/policy validation for one datasource (unified dataplane API, runType=test)');
  attachDatasourceTestCommonOptions(cmd, {
    includeNoAsync: true,
    verboseHelp: 'Set explain=true on validation request',
    timeoutHelp: 'Aggregate timeout for POST + polls'
  });
  return cmd.addHelpText('after', datasourceTestHelpAfter());
}

function setupDatasourceTestCommand(datasource) {
  // watch flags are already attached by attachDatasourceTestCommonOptions()
  chainDatasourceTestCommand(datasource).action(datasourceTestCommandAction);
}

function buildIntegrationTestOpts(options) {
  return {
    app: options.app,
    payload: options.payload,
    environment: options.env,
    debug: options.debug,
    verbose: options.verbose,
    timeout: options.timeout,
    sync: options.sync === true
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
      options.verbose,
      { debug: options.debug, runType: 'integration' }
    );
    const exitCode = finalizeAfterIntegrationDisplay(result, {});
    return { exitCode, envelope: result.datasourceTestRun || null };
  } catch (err) {
    logger.error(formatBlockingError('Integration test failed:'), err.message);
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
      options.verbose,
      { debug: options.debug, runType: 'integration' }
    );
    exitAfterIntegrationDisplay(result, {});
  } catch (error) {
    logger.error(formatBlockingError('Integration test failed:'), error.message);
    process.exit(4);
  }
}

function chainDatasourceTestIntegrationCommand(datasource) {
  const cmd = datasource
    .command('test-integration <datasourceKey>')
    .description('Integration test one datasource (unified validation API, runType=integration)');
  attachDatasourceTestCommonOptions(cmd, {
    includeNoAsync: false,
    debugHelp: 'includeDebug + log under integration/<systemKey>/logs/; TTY appendix: summary, full, or raw'
  });
  return cmd.addHelpText('after', datasourceTestIntegrationHelpAfter());
}

function setupDatasourceTestIntegrationCommand(datasource) {
  // watch flags are already attached by attachDatasourceTestCommonOptions()
  chainDatasourceTestIntegrationCommand(datasource).action(integrationTestCommandAction);
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
    minVectorHits: options.minVectorHits,
    minProcessed: options.minProcessed,
    minRecordCount: options.minRecordCount,
    timeout: options.timeout,
    capabilityKey: options.capability,
    sync: options.sync === true
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
  const env = data.datasourceTestRun;
  if (env && !unifiedModes) {
    displayDatasourceTestE2EEnvelopeResults(datasourceKey, env, options);
    const exitCode = exitCodeFromDatasourceTestRunEnvelope(env, options);
    return { exitCode: exitCode === null ? 1 : exitCode, envelope: env };
  }
  const exitCode = finalizeDatasourceTestE2ELegacyPath(data, options);
  return { exitCode, envelope: data.datasourceTestRun || null };
}

async function runDatasourceTestE2ECliAction(datasourceKey, options) {
  const { exitCode } = await runDatasourceTestE2ECliOnce(datasourceKey, options);
  process.exit(exitCode);
}

async function e2eTestCommandAction(datasourceKey, capabilityKey, options) {
  const optObj = options && typeof options === 'object' ? options : {};
  const capFromArg = typeof capabilityKey === 'string' ? capabilityKey.trim() : '';
  const capFromFlag = optObj.capability !== undefined && optObj.capability !== null
    ? String(optObj.capability).trim()
    : '';
  const requestedCapability = capFromArg || capFromFlag;
  if (capFromArg && capFromFlag && capFromArg !== capFromFlag) {
    logger.warn(
      chalk.yellow('⚠ Capability mismatch:'),
      `using positional '${capFromArg}' instead of --capability '${capFromFlag}'.`
    );
  }
  const mergedOptions = { ...optObj, capability: requestedCapability || undefined };
  try {
    if (mergedOptions.watch) {
      const { appKey } = await resolveAppKeyForDatasource(datasourceKey, mergedOptions.app);
      await runDatasourceValidationWatchLoop({
        appKey,
        extraPaths: mergedOptions.watchPath || [],
        includeApplicationYaml: mergedOptions.watchApplicationYaml === true,
        watchCi: mergedOptions.watchCi === true,
        watchFullDiff: mergedOptions.watchFullDiff === true,
        runOnce: async() => {
          try {
            return await runDatasourceTestE2ECliOnce(datasourceKey, mergedOptions);
          } catch (err) {
            logger.error(formatBlockingError('E2E test failed:'), err.message);
            return { exitCode: 3, envelope: null };
          }
        }
      });
      return;
    }
    await runDatasourceTestE2ECliAction(datasourceKey, mergedOptions);
  } catch (error) {
    logger.error(formatBlockingError('E2E test failed:'), error.message);
    process.exit(3);
  }
}

function chainDatasourceTestE2ECommand(datasource) {
  const cmd = datasource
    .command('test-e2e <datasourceKey> [capabilityKey]')
    .description('E2E test one datasource (unified validation API, runType=e2e)');
  attachDatasourceTestCommonOptions(cmd, {
    includeNoAsync: true,
    includePayload: false,
    appHelp: 'Integration folder name (default: resolve from cwd if inside integration/<systemKey>/)',
    verboseHelp: 'Audit / explain-oriented request flags where applicable',
    debugHelp: 'includeDebug + log under integration/<systemKey>/logs/; TTY appendix: summary, full, or raw',
    timeoutHelp: 'Aggregate timeout for POST + polls (default 15m)',
    timeoutDefault: String(15 * 60 * 1000)
  });
  return attachDatasourceTestE2eExclusiveOptions(cmd).addHelpText(
    'after',
    datasourceTestE2eHelpAfter()
  );
}

function setupDatasourceTestE2ECommand(datasource) {
  // watch flags are already attached by attachDatasourceTestCommonOptions()
  chainDatasourceTestE2ECommand(datasource).action(e2eTestCommandAction);
}

module.exports = {
  setupDatasourceTestCommand,
  setupDatasourceTestIntegrationCommand,
  setupDatasourceTestE2ECommand,
  attachDatasourceWatchOptions,
  /** @internal Exported for Jest: CLI action coverage without Commander. */
  runDatasourceUnifiedTestOnceForWatch,
  datasourceTestCommandAction,
  runIntegrationOnceForWatch,
  integrationTestCommandAction,
  runDatasourceTestE2ECliOnce,
  e2eTestCommandAction
};
