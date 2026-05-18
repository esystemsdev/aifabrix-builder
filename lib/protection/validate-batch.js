/**
 * @fileoverview Batch validate all manifests in `{work}/.protection/`.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const { getProtectionRoot } = require('./paths');
const { listProtectionManifestPaths } = require('./resolve');
const { loadProtectionManifest } = require('./load');
const { validateProtectionManifestLocal } = require('./validate-local');
const { resolveProtectionDataplaneContext } = require('./auth-context');
const { validateProtection, simulateProtection } = require('../api/protection.api');
const { exitCodeFromProtectionReport } = require('./report-exit');
const { formatProtectionBatchValidateTTY } = require('./protection-display');

/**
 * @param {string} manifestPath
 * @param {Object|null} ctx
 * @param {Object} opts
 * @returns {Promise<{ ctx: Object|null, row: Object, stop: boolean }>}
 */
async function processProtectionValidateFile(manifestPath, ctx, opts) {
  const manifest = loadProtectionManifest(manifestPath);
  const datasourceKey = String(
    manifest?.spec?.datasourceKey || path.basename(manifestPath, path.extname(manifestPath))
  ).trim();
  const local = validateProtectionManifestLocal(manifest);
  if (!local.valid) {
    return {
      ctx,
      stop: opts.stopOnFirstFailure !== false,
      row: { datasourceKey, manifestPath, ok: false, error: local.errors.join('; ') }
    };
  }

  if (opts.skipDataplane) {
    return { ctx, stop: false, row: { datasourceKey, manifestPath, ok: true } };
  }

  let nextCtx = ctx;
  if (!nextCtx) {
    nextCtx = await resolveProtectionDataplaneContext(opts);
  }
  const report = await validateProtection(nextCtx.dataplaneUrl, nextCtx.authConfig, manifest, {
    strict: opts.warningsAsErrors === true
  });
  if (opts.simulate && exitCodeFromProtectionReport(report, opts) === 0) {
    await simulateProtection(nextCtx.dataplaneUrl, nextCtx.authConfig, manifest, {
      strict: opts.warningsAsErrors === true
    });
  }
  const code = exitCodeFromProtectionReport(report, opts);
  if (code !== 0) {
    const firstFail = (report?.results || []).find((r) => String(r?.status).toUpperCase() === 'FAIL');
    return {
      ctx: nextCtx,
      stop: opts.stopOnFirstFailure !== false,
      row: {
        datasourceKey,
        manifestPath,
        ok: false,
        error: firstFail?.message || 'Dataplane validation failed',
        report
      }
    };
  }
  return { ctx: nextCtx, stop: false, row: { datasourceKey, manifestPath, ok: true, report } };
}

/**
 * @param {Object} opts
 * @returns {Promise<{ valid: boolean, results: Object[], exitCode: number }>}
 */
async function runValidateProtectionBatch(opts = {}) {
  const root = getProtectionRoot();
  const files = listProtectionManifestPaths(root).filter((p) => /\.ya?ml$/i.test(p));
  const results = [];
  let ctx = null;

  for (const manifestPath of files) {
    const outcome = await processProtectionValidateFile(manifestPath, ctx, opts);
    ctx = outcome.ctx;
    results.push(outcome.row);
    if (outcome.stop) break;
  }

  const valid = results.every((r) => r.ok);
  return { valid, results, exitCode: valid ? 0 : 1, root, ctx };
}

/**
 * @param {Object} opts
 * @param {Object} logger
 * @returns {Promise<number>}
 */
async function validateProtectionBatchCommand(opts, logger) {
  const batch = await runValidateProtectionBatch(opts);
  if (opts.json) {
    process.stdout.write(JSON.stringify(batch, null, 2));
    return batch.exitCode;
  }
  logger.log(formatProtectionBatchValidateTTY(batch.results, { folder: batch.root }));
  return batch.exitCode;
}

module.exports = {
  processProtectionValidateFile,
  runValidateProtectionBatch,
  validateProtectionBatchCommand
};
