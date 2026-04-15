/**
 * Chalk-based CLI output for external system upload readiness (+ upload-time probe).
 * Deploy summary lives in external-system-readiness-deploy-display.js.
 *
 * @fileoverview Readiness display for upload and optional probe after upload
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('./logger');
const {
  summarizeDatasourceTiersA,
  summarizeProbeResults,
  buildNextActionsTierA,
  coerceProbeRunToResultRows
} = require('./external-system-readiness-core');
const {
  logSeparator,
  logSectionTitle,
  logDatasourceTable,
  logIdentityBlock,
  logCredentialIntentBlock,
  logNextActions,
  logDocsBlock,
  verdictLine,
  SEP
} = require('./external-system-readiness-display-internals');

/**
 * @param {Object} publication - PublicationResult
 */
function logPublishResultBlock(publication) {
  const genMcp = publication.generateMcpContract === true;
  logSectionTitle('Publish Result:');
  logger.log(chalk.green('✔ System registered (controller + dataplane)'));
  if (publication.uploadId) {
    logger.log(`${chalk.gray('Upload ID:')} ${chalk.cyan(String(publication.uploadId))}`);
  }
  const sys = publication.system || {};
  if (sys.status) {
    logger.log(`${chalk.gray('System status:')} ${sys.status}`);
  }
  logSeparator();
  logSectionTitle('MCP Contract:');
  logger.log(genMcp ? chalk.green('✔ Generated') : chalk.gray('○ Not requested (generateMcpContract false)'));
}

/**
 * @param {string} systemKey
 * @param {{ ready: number, partial: number, failed: number }} summary
 * @param {boolean} willProbe
 */
function logUploadReadinessSummaryMinimal(systemKey, summary, willProbe) {
  logger.log(chalk.green(`\nUpload complete: ${systemKey}`));
  logger.log(
    chalk.gray('Summary:') +
      ` ${chalk.green('Ready: ' + summary.ready)} · ${chalk.yellow('Partial: ' + summary.partial)} · ${chalk.red('Failed: ' + summary.failed)}`
  );
  if (!willProbe) logger.log(chalk.gray('Use --probe for runtime verification'));
}

/**
 * @param {string} systemKey
 * @param {Object} publication
 * @param {Object} manifest
 * @param {{ rows: Array<{ key: string, tier: string }>, ready: number, partial: number, failed: number }} summary
 * @param {boolean} genMcp
 * @param {boolean} willProbe
 */
function logUploadReadinessSummaryExpanded(systemKey, publication, manifest, summary, genMcp, willProbe) {
  const systemCfg = manifest.system || {};
  logSeparator();
  logPublishResultBlock(publication);
  logSeparator();
  logDatasourceTable(summary.rows, summary);
  logSeparator();
  logIdentityBlock(systemCfg);
  logSeparator();
  logCredentialIntentBlock(systemCfg, false, !!willProbe);
  logSeparator();
  let hints = buildNextActionsTierA(systemKey, summary, genMcp);
  if (willProbe) {
    hints = hints.filter(h => !h.includes(`Run: aifabrix upload ${systemKey} --probe`));
  }
  logNextActions(hints);
}

/**
 * @param {Object} ctx
 * @param {string} ctx.systemKey
 * @param {Object} ctx.publication - PublicationResult
 * @param {Object} ctx.manifest
 * @param {boolean} [ctx.minimal] - One-line summary + probe hint only
 * @param {boolean} [ctx.willProbe] - True when caller will run --probe immediately after this summary
 */
function logUploadReadinessSummary(ctx) {
  const { systemKey, publication, manifest, minimal, willProbe } = ctx;
  const genMcp = publication.generateMcpContract === true;
  const summary = summarizeDatasourceTiersA(publication.datasources || [], genMcp);
  if (minimal) {
    logUploadReadinessSummaryMinimal(systemKey, summary, willProbe);
    return;
  }
  logUploadReadinessSummaryExpanded(systemKey, publication, manifest, summary, genMcp, willProbe);
}

/**
 * @param {Object} validationBody - Unwrapped pipeline/validate response
 */
function logServerValidationWarnings(validationBody) {
  const warnings = validationBody?.warnings;
  if (!Array.isArray(warnings) || warnings.length === 0) return;
  logSeparator();
  logSectionTitle('Server validation:');
  for (const w of warnings) {
    logger.log(chalk.yellow(`⚠ Warning: ${typeof w === 'string' ? w : JSON.stringify(w)}`));
  }
}

/**
 * @param {Object} results - Probe result rows
 * @param {Object} summary - summarizeProbeResults output
 */
function logProbeCredentialLine(results, summary) {
  logSeparator();
  logSectionTitle('Credential Test:');
  const anyEndpointFail = results.some(row => row?.endpointTestResults?.success === false);
  if (anyEndpointFail) {
    logger.log(chalk.red('✖ Failed (see Key Issues / endpoint test)'));
  } else if (summary.failed > 0) {
    logger.log(chalk.red('✖ Some datasource checks failed'));
  } else if (summary.partial > 0) {
    logger.log(chalk.yellow('⚠ Completed with warnings'));
  } else {
    logger.log(chalk.green('✔ Passed'));
  }
}

/**
 * @param {Object} probeRaw - Unwrapped POST /validation/run body
 * @param {string} systemKey
 */
function logProbeRuntimeBlock(probeRaw, systemKey) {
  const results = coerceProbeRunToResultRows(probeRaw);
  const summary = summarizeProbeResults(results);
  logSeparator();
  logger.log(chalk.bold('Runtime Readiness:'));
  if (results.length === 0) {
    logger.log(chalk.yellow('⚠ No runtime datasource results were returned by the dataplane probe.'));
    logger.log(chalk.gray('   Endpoint credential test may still pass even if datasource checks were not reported.'));
  }
  logDatasourceTable(summary.rows, summary);
  if (summary.issues.length > 0) {
    logSeparator();
    logSectionTitle('Key Issues:');
    for (const { key, lines } of summary.issues) {
      logger.log(chalk.white(key));
      for (const line of lines) {
        logger.log(chalk.red(`- ${line}`));
      }
    }
  }
  logProbeCredentialLine(results, summary);
  logSeparator();
  logNextActions(
    ['Fix API credentials or permissions if endpoint tests failed'],
    `Run: aifabrix datasource test-e2e <datasourceKey> --app ${systemKey}`
  );
}

module.exports = {
  logUploadReadinessSummary,
  logServerValidationWarnings,
  logProbeRuntimeBlock,
  SEP,
  logSeparator,
  logSectionTitle,
  logDatasourceTable,
  logIdentityBlock,
  logCredentialIntentBlock,
  logNextActions,
  logDocsBlock,
  verdictLine
};
