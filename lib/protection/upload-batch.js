/**
 * @fileoverview Batch upload all manifests in `integration/.protection/` (yaml, yml, json).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const { getProtectionRoot } = require('./paths');
const { loadProtectionManifest } = require('./load');
const { validateProtectionManifestLocal } = require('./validate-local');
const { resolveProtectionDataplaneContext } = require('./auth-context');
const { validateProtection, uploadProtection } = require('../api/protection.api');
const { exitCodeFromProtectionReport } = require('./report-exit');
const { preflightDatasourceReady } = require('./preflight-datasource-ready');
const { syncUniqueDatasourcesAfterUpload } = require('./sync-after-upload');
const { formatProtectionBatchUploadTTY } = require('./protection-display');

/**
 * @param {string} manifestPath
 * @param {Object} ctx
 * @param {Object} opts
 * @returns {Promise<{ stop: boolean, row: Object, uploadedKey?: string }>}
 */
async function processProtectionUploadFile(manifestPath, ctx, opts) {
  const manifest = loadProtectionManifest(manifestPath);
  const datasourceKey = String(manifest?.spec?.datasourceKey || '').trim();
  const local = validateProtectionManifestLocal(manifest);
  if (!local.valid) {
    return {
      stop: true,
      row: {
        datasourceKey: datasourceKey || path.basename(manifestPath),
        ok: false,
        error: local.errors.join('; ')
      }
    };
  }

  try {
    await preflightDatasourceReady(ctx.dataplaneUrl, ctx.authConfig, manifest);
  } catch (err) {
    return { stop: true, row: { datasourceKey, ok: false, error: err.message } };
  }

  const report = await validateProtection(ctx.dataplaneUrl, ctx.authConfig, manifest, {
    strict: opts.warningsAsErrors === true
  });
  if (exitCodeFromProtectionReport(report, opts) !== 0) {
    const firstFail = (report?.results || []).find((r) => String(r?.status).toUpperCase() === 'FAIL');
    return {
      stop: true,
      row: {
        datasourceKey,
        ok: false,
        error: firstFail?.message || 'Dataplane validation failed'
      }
    };
  }

  if (opts.dryRun) {
    return { stop: false, row: { datasourceKey, ok: true, dryRun: true } };
  }

  await uploadProtection(ctx.dataplaneUrl, ctx.authConfig, manifest);
  return { stop: false, row: { datasourceKey, ok: true }, uploadedKey: datasourceKey };
}

/**
 * @param {Object} opts
 * @returns {Promise<{ ok: boolean, results: Object[], exitCode: number, syncResults: Object[] }>}
 */
async function runUploadProtectionBatch(opts = {}) {
  const root = getProtectionRoot();
  const { listProtectionManifestPaths } = require('./resolve');
  const files = listProtectionManifestPaths(root);
  const ctx = await resolveProtectionDataplaneContext(opts);
  const results = [];
  const uploadedDatasourceKeys = [];

  for (const manifestPath of files) {
    const { stop, row, uploadedKey } = await processProtectionUploadFile(manifestPath, ctx, opts);
    results.push(row);
    if (uploadedKey) uploadedDatasourceKeys.push(uploadedKey);
    if (stop) break;
  }

  let syncResults = [];
  if (!opts.dryRun && !opts.noSync && uploadedDatasourceKeys.length) {
    syncResults = await syncUniqueDatasourcesAfterUpload(
      ctx.dataplaneUrl,
      ctx.authConfig,
      uploadedDatasourceKeys
    );
  }

  const ok = results.length > 0 && results.every((r) => r.ok);
  return {
    ok,
    results,
    exitCode: ok ? 0 : 1,
    root,
    ctx,
    syncResults
  };
}

/**
 * @param {Object} opts
 * @param {Object} logger
 * @returns {Promise<number>}
 */
async function uploadProtectionBatchCommand(opts, logger) {
  const batch = await runUploadProtectionBatch(opts);
  if (opts.json) {
    process.stdout.write(JSON.stringify(batch, null, 2));
    return batch.exitCode;
  }
  logger.log(formatProtectionBatchUploadTTY(batch.results, { folder: batch.root }));
  return batch.exitCode;
}

module.exports = {
  runUploadProtectionBatch,
  uploadProtectionBatchCommand
};
