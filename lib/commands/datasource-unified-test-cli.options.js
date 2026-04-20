/**
 * @fileoverview Shared option builders + help text for datasource test CLI commands.
 */

'use strict';

function datasourceTestHelpAfter() {
  return `
Examples:
  $ aifabrix datasource test hubspot-users
  $ aifabrix datasource test hubspot-users --app test-e2e-hubspot -v
  $ aifabrix datasource test hubspot-users -a test-e2e-hubspot --debug full
  $ aifabrix datasource test hubspot-users --json

Notes:
  - For integration pipeline tests, use:
      aifabrix datasource test-integration <datasourceKey>
  - For system-level rollup across datasources, use:
      aifabrix test <systemKey>
`;
}

function datasourceTestIntegrationHelpAfter() {
  return `
Examples:
  $ aifabrix datasource test-integration hubspot-users
  $ aifabrix datasource test-integration hubspot-users --app test-e2e-hubspot --debug
  $ aifabrix datasource test-integration hubspot-users -a test-e2e-hubspot -e tst --timeout 60000

Notes:
  - For structural/policy validation, use:
      aifabrix datasource test <datasourceKey>
  - For E2E capability execution, use:
      aifabrix datasource test-e2e <datasourceKey>
  - For system-level integration rollup across datasources, use:
      aifabrix test-integration <systemKey>
`;
}

function datasourceTestE2eHelpAfter() {
  return `
Examples:
  $ aifabrix datasource test-e2e hubspot-users
  $ aifabrix datasource test-e2e hubspot-users --app test-e2e-hubspot -v --debug
  $ aifabrix datasource test-e2e my-documents-ds --min-vector-hits 7 -v --debug
  $ aifabrix datasource test-e2e hubspot-users -a test-e2e-hubspot --no-async
  $ aifabrix datasource test-e2e hubspot-users read

Notes:
  - For structural/policy validation, use:
      aifabrix datasource test <datasourceKey>
  - For integration pipeline tests, use:
      aifabrix datasource test-integration <datasourceKey>
  - For system-level E2E rollup across datasources, use:
      aifabrix test-e2e <systemKey>
`;
}

/**
 * @param {object} cmd - Commander command (chainable)
 * @returns {object}
 */
function attachDatasourceWatchOptions(cmd) {
  return cmd
    .option(
      '--watch',
      'Re-run when watched files change (debounced; integration tree + optional paths)'
    )
    .option(
      '--watch-path <path>',
      'Extra file or directory to watch (repeatable)',
      (value, previous) => (Array.isArray(previous) ? previous : []).concat(value),
      []
    )
    .option('--watch-application-yaml', 'Include integration/<app>/application.yaml in the watch set')
    .option('--watch-ci', 'Exit after the first run with the normal exit code (CI one-shot)')
    .option('--watch-full-diff', 'Print full before/after fingerprint lines when the result changes');
}

/**
 * Shared options for datasource-level `test`, `test-integration`, and `test-e2e`.
 *
 * Registration order matches intended `--help` order: core run flags → payload/timeout →
 * `--sync` (pre-run publish) → machine/exit modifiers → async → watch (last before `--help`).
 * Callers must append `addHelpText('after', …)` **after** any command-specific options (e.g. E2E).
 *
 * @param {object} cmd - Commander command (chainable)
 * @param {Object} opts
 * @param {boolean} [opts.includeNoAsync]
 * @param {boolean} [opts.includePayload]
 * @param {string} [opts.appHelp]
 * @param {string} [opts.verboseHelp]
 * @param {string} [opts.debugHelp]
 * @param {string} [opts.timeoutHelp]
 * @param {string} [opts.timeoutDefault]
 * @returns {object}
 */
function attachDatasourceTestCommonOptions(cmd, opts) {
  const includeNoAsync = opts.includeNoAsync === true;
  const includePayload = opts.includePayload !== false;

  cmd
    .option(
      '-a, --app <app>',
      opts.appHelp ||
        'Integration folder name (optional: resolve from cwd or datasource key if single match)'
    )
    .option('-e, --env <env>', 'Environment: dev, tst, or pro')
    .option('-v, --verbose', opts.verboseHelp || 'Explain mode and detailed output where available')
    .option(
      '-d, --debug [level]',
      opts.debugHelp ||
        'includeDebug on request; TTY appendix: summary (default), full, or raw (not with --json)'
    );

  if (includePayload) {
    cmd.option('-p, --payload <file>', 'Optional custom payload file (sets payloadTemplate on request)');
  }

  cmd
    .option(
      '--timeout <ms>',
      opts.timeoutHelp || 'Aggregate timeout for POST + polls (ms)',
      opts.timeoutDefault || '30000'
    )
    .option(
      '--sync',
      'Publish this datasource JSON from disk to the dataplane before running the test (requires login / same auth as upload)'
    )
    .option('--json', 'Print raw DatasourceTestRun JSON to stdout')
    .option('--summary', 'Print compact summary line')
    .option('--warnings-as-errors', 'Exit 1 when root status is warn')
    .option('--require-cert', 'Exit 2 when certificate missing or not_passed');

  if (includeNoAsync) {
    cmd.option('--no-async', 'Do not poll; fail if report is not complete in first response');
  }

  attachDatasourceWatchOptions(cmd);
  return cmd;
}

/**
 * E2E-only Commander flags (kept out of datasource-unified-test-cli.js for file size limits).
 * @param {object} cmd
 * @returns {object}
 */
function attachDatasourceTestE2eExclusiveOptions(cmd) {
  return cmd
    .option(
      '--min-vector-hits <n>',
      'Assert at least N vector search hits after sync (e2eOptions.minVectorHits)',
      (v) => parseInt(String(v), 10)
    )
    .option(
      '--min-processed <n>',
      'Minimum records processed in sync step (e2eOptions.minProcessed)',
      (v) => parseInt(String(v), 10)
    )
    .option(
      '--min-record-count <n>',
      'Minimum record count assertion (e2eOptions.minRecordCount)',
      (v) => parseInt(String(v), 10)
    )
    .option('--test-crud', 'Enable CRUD lifecycle test (e2eOptions.testCrud)')
    .option('--record-id <id>', 'Record ID for test (e2eOptions.recordId)')
    .option('--no-cleanup', 'Disable cleanup after test (e2eOptions.cleanup: false)')
    .option(
      '--primary-key-value <value|@path>',
      'Primary key value or path to JSON file (e.g. @pk.json) for e2eOptions.primaryKeyValue'
    )
    .option('--capability <key>', 'Capability drill-down (deprecated; use positional [capabilityKey])')
    .option(
      '--strict-capability-scope',
      'Exit 1 if a capability drill-down is requested but the report lists more than one capabilities[] row (plan §2.3)'
    );
}

module.exports = {
  datasourceTestHelpAfter,
  datasourceTestIntegrationHelpAfter,
  datasourceTestE2eHelpAfter,
  attachDatasourceWatchOptions,
  attachDatasourceTestCommonOptions,
  attachDatasourceTestE2eExclusiveOptions
};

