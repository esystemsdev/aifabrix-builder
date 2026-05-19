/**
 * @fileoverview TTY display for `datasource export` (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const logger = require('./logger');
const {
  sectionTitle,
  headerKeyValue,
  metadata: metaGray,
  formatSuccessLine,
  formatWarningLine
} = require('./cli-test-layout-chalk');
const { emitManifestSourceMetadata } = require('./manifest-source-emit');
const { integrationManifestLabel } = require('../datasource/datasource-load-export-context');

const SEP = '────────────────────────────────────────────────────────';

function logExportHeader(ctx, envLabel) {
  logger.log(SEP);
  logger.log(sectionTitle(`Export records — ${ctx.datasourceKey}`));
  logger.log(headerKeyValue('Environment:', envLabel || '—'));
  logger.log(headerKeyValue('System:', ctx.systemKey));
  logger.log(SEP);
  logger.log(metaGray('  Layer: governed records search (ABAC applied)'));
  logger.log(metaGray('  Not used: direct database access'));
  logger.log('');
}

function logExportVerboseStats(result) {
  const excluded = result.meta?.excluded || {};
  const abac = excluded.abac !== undefined && excluded.abac !== null ? excluded.abac : 0;
  const filterEx =
    excluded.filter !== undefined && excluded.filter !== null ? excluded.filter : 0;
  logger.log(
    metaGray(
      `  Fetched: ${result.recordCount} records · excluded abac ${abac} · filter ${filterEx}`
    )
  );
  const stat = fs.statSync(result.outputFile);
  const mb = (stat.size / (1024 * 1024)).toFixed(2);
  logger.log(
    metaGray(`  Wrote: ${result.recordCount} line(s) (${result.format}) · ${mb} MB`)
  );
  logger.log('');
}

/**
 * @param {Object} result
 * @param {Object} opts
 */
function displayDatasourceExportTTY(result, opts = {}) {
  const ctx = result.context || {};
  logExportHeader(ctx, opts.environment);

  const filterLabel = result.filters ? 'filters (set)' : 'filters (none)';
  logger.log(
    metaGray(`  Search: intent ${result.intent} · limit ${result.limit} · ${filterLabel}`)
  );
  emitManifestSourceMetadata({
    tier: 'int',
    configPath: ctx.manifestPath,
    labelPrefix: integrationManifestLabel(ctx.appKey)
  });
  logger.log(metaGray(`  Output: ${result.outputFile}`));
  logger.log('');

  if (opts.verbose) {
    logExportVerboseStats(result);
  }

  if (result.hitLimitCap) {
    logger.log(
      formatWarningLine(
        `Fetched ${result.recordCount} records (limit cap). More rows may exist.`
      )
    );
    logger.log(
      metaGray('  Re-run with --filter or wait for dataplane search pagination.')
    );
    logger.log('');
  }

  logger.log(formatSuccessLine('Export complete'));
  logger.log(SEP);
}

module.exports = {
  displayDatasourceExportTTY
};
