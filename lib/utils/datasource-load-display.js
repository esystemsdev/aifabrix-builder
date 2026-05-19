/**
 * @fileoverview TTY display for `datasource load` (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');
const {
  sectionTitle,
  headerKeyValue,
  metadata: metaGray,
  formatSuccessLine,
  formatBlockingError,
  successGlyph,
  failureGlyph
} = require('./cli-test-layout-chalk');
const { emitManifestSourceMetadata } = require('./manifest-source-emit');
const { integrationManifestLabel } = require('../datasource/datasource-load-export-context');

const SEP = '────────────────────────────────────────────────────────';

function logLoadHeader(ctx, envLabel) {
  logger.log(SEP);
  logger.log(sectionTitle(`Load records — ${ctx.datasourceKey}`));
  logger.log(headerKeyValue('Environment:', envLabel || '—'));
  logger.log(headerKeyValue('System:', ctx.systemKey));
  logger.log(SEP);
  logger.log(metaGray('  Layer: dataplane bulk sync'));
  emitManifestSourceMetadata({
    tier: 'int',
    configPath: ctx.manifestPath,
    labelPrefix: integrationManifestLabel(ctx.appKey)
  });
}

function displayLoadDryRun(result) {
  logger.log(chalk.cyan('  Mode: dry-run (no upload)'));
  logger.log('');
  const mb = (result.estimatedPayloadBytes / (1024 * 1024)).toFixed(2);
  const batchCount = Math.ceil(result.recordCount / result.batchSize) || 0;
  logger.log(
    metaGray(
      `  Parsed: ${result.recordCount} records · format ${result.format} · est. payload ~${mb} MB`
    )
  );
  logger.log(
    metaGray(`  Would upload: ${batchCount} batch(es) · syncType ${result.syncType}`)
  );
  logger.log('');
  logger.log(formatSuccessLine('Dry-run passed'));
}

function displayLoadBatchesVerbose(batches) {
  batches.forEach(batch => {
    if (batch.error) {
      logger.log(
        `  Batch ${batch.index}/${batch.total}  ${failureGlyph()} failed (${batch.error})`
      );
      return;
    }
    const failed = Array.isArray(batch.failed) ? batch.failed.length : 0;
    if (failed > 0) {
      logger.log(
        `  Batch ${batch.index}/${batch.total}  ${failureGlyph()} failed ${failed} of ${batch.recordCount || '?'}`
      );
      return;
    }
    logger.log(
      `  Batch ${batch.index}/${batch.total}  ${successGlyph()} inserted ${batch.insertedCount || 0} · updated ${batch.updatedCount || 0} · failed 0`
    );
  });
}

function displayLoadVerdict(result) {
  const failed = result.totals.failedCount || 0;
  const ok = result.recordCount - failed;
  if (failed > 0) {
    logger.log(formatBlockingError(`${ok} ok · ${failed} failed`));
  } else {
    logger.log(
      formatSuccessLine(
        `${result.recordCount} processed · ${result.totals.insertedCount} inserted · ${result.totals.updatedCount} updated · 0 failed`
      )
    );
  }
}

/**
 * @param {Object} result
 * @param {Object} opts
 */
function displayDatasourceLoadTTY(result, opts = {}) {
  const ctx = result.context || {};
  logLoadHeader(ctx, opts.environment);
  logger.log(metaGray(`  Data file: ${result.file}`));
  logger.log('');

  if (result.dryRun) {
    displayLoadDryRun(result);
    logger.log(SEP);
    return;
  }

  const batchCount = Math.ceil(result.recordCount / result.batchSize) || 0;
  logger.log(
    metaGray(
      `  Parsed: ${result.recordCount} records · format ${result.format} · est. ${batchCount} batch(es) @ ${result.batchSize}`
    )
  );
  logger.log('');

  if (opts.verbose) {
    displayLoadBatchesVerbose(result.batches);
    logger.log('');
  }

  displayLoadVerdict(result);
  logger.log(SEP);
}

module.exports = {
  displayDatasourceLoadTTY
};
