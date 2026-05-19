/**
 * @fileoverview Load local fixtures via dataplane bulk record sync (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { resolveDataFilePath } = require('./local-data-paths');
const { parseRecordFile, estimatePayloadBytes } = require('./record-file-parser');
const { normalizeRecordsForBulk } = require('./record-mapper');
const { resolveLoadExportContext } = require('./datasource-load-export-context');
const { uploadRecordBatches } = require('./bulk-loader-run-batches');

const DEFAULT_BATCH_SIZE = 100;

/**
 * @param {Object[]} records
 * @param {number} batchSize
 * @returns {Object[][]}
 */
function chunkRecords(records, batchSize) {
  const size = Math.max(1, batchSize);
  const chunks = [];
  for (let i = 0; i < records.length; i += size) {
    chunks.push(records.slice(i, i + size));
  }
  return chunks;
}

function buildLoadResultBase(ctx, filePath, format, records, batchSize, syncType, dryRun) {
  return {
    datasourceKey: ctx.datasourceKey,
    systemKey: ctx.systemKey,
    appKey: ctx.appKey,
    dryRun,
    file: filePath,
    format,
    recordCount: records.length,
    batchSize,
    syncType,
    estimatedPayloadBytes: estimatePayloadBytes(records),
    batches: [],
    totals: { insertedCount: 0, updatedCount: 0, failedCount: 0 }
  };
}

/**
 * @async
 * @param {string} datasourceKey
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function runDatasourceLoad(datasourceKey, options = {}) {
  const ctx = await resolveLoadExportContext(datasourceKey, options);
  const batchSize = options.batchSize
    ? parseInt(String(options.batchSize), 10)
    : DEFAULT_BATCH_SIZE;
  const syncType = options.syncType || 'incremental';
  const { filePath, format } = resolveDataFilePath({
    systemKey: ctx.systemKey,
    entitySuffix: ctx.entitySuffix,
    file: options.file,
    format: options.format
  });

  const raw = parseRecordFile(filePath, format);
  const records = normalizeRecordsForBulk(raw, ctx.datasource);
  const dryRun = options.dryRun === true;
  const result = buildLoadResultBase(
    ctx,
    filePath,
    format,
    records,
    batchSize,
    syncType,
    dryRun
  );

  if (dryRun) {
    return { ...result, context: ctx };
  }

  const { batches, totals } = await uploadRecordBatches({
    chunks: chunkRecords(records, batchSize),
    syncType,
    dataplaneUrl: ctx.dataplaneUrl,
    datasourceKey: ctx.datasourceKey,
    authConfig: ctx.authConfig
  });

  return { ...result, batches, totals, context: ctx };
}

module.exports = {
  runDatasourceLoad,
  chunkRecords,
  DEFAULT_BATCH_SIZE
};
