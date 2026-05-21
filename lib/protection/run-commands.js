/**
 * @fileoverview Single-manifest protection command implementations.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const { resolveProtectionArgument } = require('./resolve');
const { runProtectionValidate } = require('./run-commands-validate');
const { resolveProtectionDataplaneContext } = require('./auth-context');
const {
  uploadProtection,
  getProtection,
  getProtectionStatus,
  deleteProtection,
  findProtectionKeyByDatasource
} = require('../api/protection.api');
const { preflightDatasourceReady } = require('./preflight-datasource-ready');
const { syncDatasourceAfterProtectionUpload } = require('./sync-after-upload');
const {
  formatProtectionListTTY,
  formatProtectionShowTTY,
  formatProtectionDeleteSummaryTTY,
  formatProgress,
  formatSuccessLine,
  formatWarningLine
} = require('./protection-display');
const { listProtectionManifests } = require('../api/protection.api');
const { getProtectionRoot } = require('./paths');

/**
 * @param {string} datasourceKey
 * @param {Object} manifest
 * @param {Object} opts
 * @param {Object} logger
 * @returns {Promise<number>}
 */
async function runProtectionUpload(datasourceKey, manifest, opts, logger) {
  const code = await runProtectionValidate(datasourceKey, manifest, {
    ...opts,
    simulate: false,
    json: false
  }, logger);
  if (code !== 0) {
    return code;
  }

  const ctx = await resolveProtectionDataplaneContext(opts);
  await preflightDatasourceReady(ctx.dataplaneUrl, ctx.authConfig, manifest);

  if (opts.dryRun) {
    logger.log(formatWarningLine('Dry run: would upload protection (no mutation).'));
    logger.log(
      chalk.gray(
        `  key=${manifest?.metadata?.key || '—'} datasource=${datasourceKey} rules=${(manifest?.spec?.rules || []).length}`
      )
    );
    return 0;
  }

  logger.log(formatProgress('Uploading protection manifest...'));
  const uploaded = await uploadProtection(ctx.dataplaneUrl, ctx.authConfig, manifest);
  logger.log(
    formatSuccessLine(
      `Protection for '${datasourceKey}' uploaded (deploymentId ${uploaded?.deploymentId || '—'}, revision ${uploaded?.revision ?? '—'})`
    )
  );

  if (!opts.noSync) {
    logger.log(formatProgress(`Syncing datasource ${datasourceKey}...`));
    const sync = await syncDatasourceAfterProtectionUpload(
      ctx.dataplaneUrl,
      ctx.authConfig,
      datasourceKey
    );
    if (sync.syncJobId) {
      logger.log(formatSuccessLine(`Sync started (syncJobId: ${sync.syncJobId})`));
    } else if (sync.warning) {
      logger.log(formatWarningLine(`Sync warning: ${sync.warning}`));
    }
  } else {
    logger.log(
      chalk.gray(
        'Sync skipped (--no-sync). Protection active on dataplane; projections update on next datasource sync.'
      )
    );
  }
  return 0;
}

/**
 * @param {string} datasourceKey
 * @param {Object} opts
 * @param {Object} logger
 * @returns {Promise<string|null>}
 */
async function resolveProtectionKeyForDatasource(datasourceKey, ctx) {
  try {
    const resolved = resolveProtectionArgument(datasourceKey);
    return String(resolved.manifest?.metadata?.key || '').trim() || null;
  } catch {
    return findProtectionKeyByDatasource(ctx.dataplaneUrl, ctx.authConfig, datasourceKey);
  }
}

/**
 * @param {Object} opts
 * @param {Object} logger
 * @returns {Promise<number>}
 */
async function runProtectionList(opts, logger) {
  const ctx = await resolveProtectionDataplaneContext(opts);
  const params = {};
  if (opts.page !== undefined && opts.page !== null && !Number.isNaN(Number(opts.page))) {
    params.page = Number(opts.page);
  }
  if (
    opts.pageSize !== undefined &&
    opts.pageSize !== null &&
    !Number.isNaN(Number(opts.pageSize))
  ) {
    params.pageSize = Number(opts.pageSize);
  }
  if (opts.filter && String(opts.filter).trim()) {
    params.filter = String(opts.filter).trim();
  }

  const listed = await listProtectionManifests(ctx.dataplaneUrl, ctx.authConfig, params);
  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify(listed.raw ?? { data: listed.items, meta: listed.meta }, null, 2)}\n`
    );
    return 0;
  }

  logger.log(
    formatProtectionListTTY(
      {
        items: listed.items,
        meta: listed.meta,
        environment: ctx.environment,
        dataplaneUrl: ctx.dataplaneUrl
      },
      { verbose: opts.verbose === true }
    )
  );
  return 0;
}

/**
 * @param {string} datasourceKey
 * @param {Object} opts
 * @param {Object} logger
 * @returns {Promise<number>}
 */
async function runProtectionShow(datasourceKey, opts, logger) {
  const ctx = await resolveProtectionDataplaneContext(opts);
  const protectionKey = await resolveProtectionKeyForDatasource(datasourceKey, ctx);
  if (!protectionKey) {
    throw new Error(`No deployed protection found for datasource "${datasourceKey}"`);
  }
  const manifest = await getProtection(ctx.dataplaneUrl, ctx.authConfig, protectionKey);
  const status = await getProtectionStatus(ctx.dataplaneUrl, ctx.authConfig, protectionKey);
  const payload = { manifest, status, environment: ctx.environment, dataplaneUrl: ctx.dataplaneUrl };
  if (opts.json) {
    process.stdout.write(JSON.stringify(payload, null, 2));
    return 0;
  }
  logger.log(formatProtectionShowTTY(payload, { verbose: opts.verbose }));
  return 0;
}

/**
 * @param {string} datasourceKey
 * @param {Object} opts
 * @param {Object} logger
 * @returns {Promise<number>}
 */
async function runProtectionDelete(datasourceKey, opts, logger) {
  const ctx = await resolveProtectionDataplaneContext(opts);
  const protectionKey = await resolveProtectionKeyForDatasource(datasourceKey, ctx);
  if (!protectionKey) {
    throw new Error(`No deployed protection found for datasource "${datasourceKey}"`);
  }

  if (!opts.yes) {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Delete protection for '${datasourceKey}' (${protectionKey})?`,
        default: false
      }
    ]);
    if (!confirmed) {
      logger.log(chalk.gray('Delete cancelled.'));
      return 0;
    }
  }

  const res = await deleteProtection(ctx.dataplaneUrl, ctx.authConfig, protectionKey);
  logger.log(formatProtectionDeleteSummaryTTY(res?.data || res, datasourceKey));
  return 0;
}

module.exports = {
  getProtectionRoot,
  runProtectionValidate,
  runProtectionUpload,
  runProtectionList,
  runProtectionShow,
  runProtectionDelete
};
