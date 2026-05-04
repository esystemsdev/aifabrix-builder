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
const { displayIntegrationTestResults } = require('../utils/external-system-display');
const path = require('path');
const { getIntegrationPath } = require('../utils/paths');
const { writeTestLog } = require('../utils/test-log-writer');
const { includeDebugForRequest } = require('../utils/validation-run-request');
const {
  finalizeUnifiedValidationResult,
  unifiedCliResultFromIntegrationReturn,
  finalizeAfterIntegrationDisplay
} = require('./datasource-validation-cli');
const { afterUnifiedValidationCertSync } = require('../certification/post-unified-cert-sync');
const { resolveAppKeyForDatasource } = require('../datasource/resolve-app');
const { runDatasourceValidationWatchLoop } = require('../utils/datasource-validation-watch');
const {
  exitCodeFromDatasourceTestRunEnvelope,
  finalizeDatasourceTestE2ELegacyPath,
  displayDatasourceTestE2EEnvelopeResults
} = require('./datasource-unified-test-e2e-cli-helpers');
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

async function runDatasourceUnifiedTestOnceForWatch(datasourceKey, runOpts, displayOpts, certCliOptions = {}) {
  try {
    const result = await runUnifiedDatasourceValidation(datasourceKey, runOpts);
    const exitCode = finalizeUnifiedValidationResult(result, displayOpts);
    await afterUnifiedValidationCertSync(exitCode, datasourceKey, certCliOptions, 'datasource test', result.envelope);
    return {
      exitCode,
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
          const exitCode = finalizeUnifiedValidationResult(result, displayOpts);
          await afterUnifiedValidationCertSync(exitCode, datasourceKey, options, 'datasource test (watch)', result.envelope);
          return {
            exitCode,
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
    const exitCode = finalizeUnifiedValidationResult(result, displayOpts);
    await afterUnifiedValidationCertSync(exitCode, datasourceKey, options, 'datasource test', result.envelope);
    process.exit(exitCode);
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
      await afterUnifiedValidationCertSync(
        exitCode,
        datasourceKey,
        options,
        'datasource test-integration (watch)',
        uni.envelope
      );
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
    const exitCode = finalizeAfterIntegrationDisplay(result, {
      warningsAsErrors: unifiedDisplayOpts.warningsAsErrors === true,
      requireCert: unifiedDisplayOpts.requireCert === true
    });
    await afterUnifiedValidationCertSync(
      exitCode,
      datasourceKey,
      options,
      'datasource test-integration (watch)',
      result.datasourceTestRun || null
    );
    return { exitCode, envelope: result.datasourceTestRun || null };
  } catch (err) {
    logger.error(formatBlockingError('Integration test failed:'), err.message);
    return { exitCode: 4, envelope: null };
  }
}

async function integrationTestCommandActionWatch(datasourceKey, options, integOpts, unifiedDisplayOpts) {
  const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
  await runDatasourceValidationWatchLoop({
    appKey,
    extraPaths: options.watchPath || [],
    includeApplicationYaml: options.watchApplicationYaml === true,
    watchCi: options.watchCi === true,
    watchFullDiff: options.watchFullDiff === true,
    runOnce: () => runIntegrationOnceForWatch(datasourceKey, integOpts, options, unifiedDisplayOpts)
  });
}

async function integrationTestCommandActionNonWatch(datasourceKey, integOpts, options, unifiedDisplayOpts) {
  const result = await runDatasourceTestIntegration(datasourceKey, integOpts);
  const unifiedModes =
    options.json || options.summary || options.warningsAsErrors || options.requireCert;
  if (unifiedModes) {
    const uni = unifiedCliResultFromIntegrationReturn(result);
    const exitCode = finalizeUnifiedValidationResult(uni, unifiedDisplayOpts);
    await afterUnifiedValidationCertSync(
      exitCode,
      datasourceKey,
      options,
      'datasource test-integration',
      uni.envelope
    );
    process.exit(exitCode);
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
  const integExit = finalizeAfterIntegrationDisplay(result, {
    warningsAsErrors: unifiedDisplayOpts.warningsAsErrors === true,
    requireCert: unifiedDisplayOpts.requireCert === true
  });
  await afterUnifiedValidationCertSync(
    integExit,
    datasourceKey,
    options,
    'datasource test-integration',
    result.datasourceTestRun || null
  );
  process.exit(integExit);
}

async function integrationTestCommandAction(datasourceKey, options) {
  const integOpts = buildIntegrationTestOpts(options);
  const unifiedDisplayOpts = buildIntegrationUnifiedDisplayOpts(options);
  try {
    if (options.watch) {
      await integrationTestCommandActionWatch(datasourceKey, options, integOpts, unifiedDisplayOpts);
      return;
    }
    await integrationTestCommandActionNonWatch(datasourceKey, integOpts, options, unifiedDisplayOpts);
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
    cleanup: options.cleanup,
    runScenarios: options.runScenarios,
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
  const { exitCode, envelope } = await runDatasourceTestE2ECliOnce(datasourceKey, options);
  await afterUnifiedValidationCertSync(exitCode, datasourceKey, options, 'datasource test-e2e', envelope);
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
            const r = await runDatasourceTestE2ECliOnce(datasourceKey, mergedOptions);
            await afterUnifiedValidationCertSync(
              r.exitCode,
              datasourceKey,
              mergedOptions,
              'datasource test-e2e (watch)',
              r.envelope
            );
            return r;
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
    timeoutHelp:
      'Wall-clock budget for validation (ms); also raises per-request HTTP wait for slow E2E POST/polls (default 15m)',
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
