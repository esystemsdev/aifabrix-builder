/**
 * @fileoverview CLI for `datasource load` and `datasource export` (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { formatBlockingError } = require('../utils/cli-test-layout-chalk');
const { runDatasourceLoad } = require('../datasource/bulk-loader-service');
const { runDatasourceExport } = require('../datasource/datasource-exporter-service');
const { displayDatasourceLoadTTY } = require('../utils/datasource-load-display');
const { displayDatasourceExportTTY } = require('../utils/datasource-export-display');

function loadHelpAfter() {
  return `
Examples:
  $ aifabrix datasource load hubspot-test-company --app hubspot-test
  $ aifabrix datasource load hubspot-test-company --file ./fixtures/rows.ndjson -v
  $ aifabrix datasource load hubspot-test-company --dry-run
  $ af ds load hubspot-test-company --batch-size 50 --sync-type incremental

Notes:
  - Imports local JSON/NDJSON via dataplane bulk record sync (not direct DB).
  - Default file: integration/.data/<systemKey>-data-<entity>.json or .ndjson
  - External integration folders only (integration/<systemKey>/).
`;
}

function exportHelpAfter() {
  return `
Examples:
  $ aifabrix datasource export hubspot-test-company --app hubspot-test
  $ aifabrix datasource export hubspot-test-company --format ndjson --limit 500
  $ aifabrix datasource export hubspot-test-company --filter '{"status":{"eq":"active"}}' -v
  $ af ds export hubspot-test-company --fields email,name --strict

Notes:
  - Exports governed records search results (ABAC applied), not a raw DB dump.
  - Default output: integration/.data/<systemKey>-data-<entity>.json or .ndjson
  - Maximum 10000 rows per run (dataplane search limit).
`;
}

/**
 * @param {Object} result
 * @returns {number}
 */
function computeLoadExitCode(result) {
  if (result.dryRun) {
    return 0;
  }
  return (result.totals.failedCount || 0) > 0 ? 1 : 0;
}

/**
 * @param {Object} result
 * @param {Object} options
 * @returns {number}
 */
function computeExportExitCode(result, options) {
  if (options.strict === true && result.recordCount === 0) {
    return 1;
  }
  return 0;
}

async function datasourceLoadAction(datasourceKey, options) {
  try {
    const result = await runDatasourceLoad(datasourceKey, {
      app: options.app,
      env: options.env,
      file: options.file,
      verbose: options.verbose,
      dryRun: options.dryRun,
      batchSize: options.batchSize,
      syncType: options.syncType,
      format: options.format
    });

    if (options.json) {
      const { context: _ctx, ...payload } = result;
      logger.log(JSON.stringify(payload, null, 2));
    } else {
      displayDatasourceLoadTTY(result, { environment: options.env, verbose: options.verbose });
    }

    process.exit(computeLoadExitCode(result));
  } catch (err) {
    logger.error(formatBlockingError(`Load failed: ${err.message}`));
    const code = err.message && /auth|login|token|version|unreachable/i.test(err.message) ? 3 : 1;
    process.exit(code);
  }
}

async function datasourceExportAction(datasourceKey, options) {
  try {
    const result = await runDatasourceExport(datasourceKey, {
      app: options.app,
      env: options.env,
      file: options.file,
      verbose: options.verbose,
      format: options.format,
      filter: options.filter,
      fields: options.fields,
      limit: options.limit,
      intent: options.intent,
      strict: options.strict
    });

    if (options.json) {
      const { context: _ctx, ...payload } = result;
      logger.log(JSON.stringify(payload, null, 2));
    } else {
      displayDatasourceExportTTY(result, { environment: options.env, verbose: options.verbose });
    }

    process.exit(computeExportExitCode(result, options));
  } catch (err) {
    logger.error(formatBlockingError(`Export failed: ${err.message}`));
    const code = err.message && /auth|login|token|version|unreachable/i.test(err.message) ? 3 : 1;
    process.exit(code);
  }
}

/**
 * @param {import('commander').Command} datasource
 */
function setupDatasourceLoadExportCommands(datasource) {
  datasource
    .command('load <datasourceKey>')
    .description('Import local JSON/NDJSON records via dataplane bulk sync')
    .option('-a, --app <app>', 'Integration folder name')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro')
    .option('--file <path>', 'Input file (default: integration/.data/...)')
    .option('--format <json|ndjson>', 'File format when extension is ambiguous')
    .option('--batch-size <n>', 'Records per bulk request', '100')
    .option(
      '--sync-type <incremental|bulk|validate>',
      'Dataplane syncType',
      'incremental'
    )
    .option('--dry-run', 'Parse and validate only; no upload')
    .option('-v, --verbose', 'Per-batch progress')
    .option('--json', 'Machine-readable result JSON')
    .addHelpText('after', loadHelpAfter())
    .action(datasourceLoadAction);

  datasource
    .command('export <datasourceKey>')
    .description('Export governed records to local JSON/NDJSON via records search')
    .option('-a, --app <app>', 'Integration folder name')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro')
    .option('--file <path>', 'Output file (default: integration/.data/...)')
    .option('--format <json|ndjson>', 'Output format')
    .option('--filter <json>', 'Records search filters (JSON object)')
    .option('--fields <csv>', 'Project metadata keys in export rows')
    .option('--limit <n>', 'Max records (1–10000)', '1000')
    .option(
      '--intent <retrieval|grounding|analytics|validation>',
      'Search intent',
      'validation'
    )
    .option('--strict', 'Exit 1 when zero rows are exported')
    .option('-v, --verbose', 'Search stats and file size')
    .option('--json', 'Machine-readable result JSON')
    .addHelpText('after', exportHelpAfter())
    .action(datasourceExportAction);
}

module.exports = {
  setupDatasourceLoadExportCommands,
  datasourceLoadAction,
  datasourceExportAction,
  computeLoadExitCode,
  computeExportExitCode
};
