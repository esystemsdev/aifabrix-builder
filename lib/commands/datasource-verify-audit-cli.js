/**
 * @fileoverview `aifabrix datasource verify-audit` — re-run 407.1 matrix from last E2E log
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { formatBlockingError } = require('../utils/cli-test-layout-chalk');
const { runAuditEvidenceVerification } = require('../datasource/audit-evidence-run');
const { loadEnvelopeFromLatestE2eLog } = require('../datasource/audit-evidence-extract');

const VERIFY_AUDIT_HELP_AFTER = `
Examples:
  $ aifabrix datasource verify-audit test-e2e-hubspot-companies
  $ aifabrix datasource verify-audit test-e2e-hubspot-companies --app test-e2e-hubspot -v
  $ aifabrix datasource verify-audit test-e2e-hubspot-companies --correlation-id <testRunId>
  $ aifabrix datasource verify-audit test-e2e-hubspot-companies --json

Notes:
  - Re-checks audit evidence from the latest test-e2e debug log (or --file) without re-running E2E.
  - Requires audit:read on the dataplane (same login as test-e2e).
  - Pair with: aifabrix datasource test-e2e <datasourceKey> --verify-audit
`;

/**
 * @param {string} datasourceKey
 * @param {Object} options
 */
async function verifyAuditCommandAction(datasourceKey, options) {
  const envelope = await loadEnvelopeFromLatestE2eLog(datasourceKey, options);
  if (!envelope) {
    logger.error(
      formatBlockingError('verify-audit failed:'),
      'No test-e2e debug log found (run test-e2e with --debug first)'
    );
    process.exit(3);
    return;
  }
  const pollMs = parseInt(String(options.auditPollMs || '15000'), 10);
  const pollInterval = parseInt(String(options.auditPollIntervalMs || '2000'), 10);
  const { exitCode } = await runAuditEvidenceVerification(datasourceKey, envelope, {
    app: options.app,
    env: options.env,
    verbose: options.verbose,
    json: options.json,
    correlationId: options.correlationId,
    executionId: options.executionId,
    quiet: false,
    auditPollMaxWaitMs: Number.isFinite(pollMs) ? pollMs : 15000,
    auditPollIntervalMs: Number.isFinite(pollInterval) ? pollInterval : 2000
  });
  process.exit(exitCode);
}

/**
 * @param {import('commander').Command} datasource
 */
function setupDatasourceVerifyAuditCommand(datasource) {
  datasource
    .command('verify-audit <datasourceKey>')
    .description(
      'Verify audit evidence matrix from latest E2E log (or --file) without re-running E2E'
    )
    .option(
      '-a, --app <app>',
      'Integration folder name (optional: resolve from cwd or datasource key if single match)'
    )
    .option('-e, --env <env>', 'Environment: dev, tst, or pro')
    .option('-v, --verbose', 'Show matrix row codes and execution id count')
    .option('--json', 'Print auditEvidenceVerification JSON block')
    .option('-f, --file <path>', 'Path to test-e2e debug log JSON')
    .option('--correlation-id <id>', 'Override correlation/testRunId filter')
    .option('--execution-id <id>', 'Include execution id for sub-resource checks')
    .option(
      '--audit-poll-ms <ms>',
      'Max wait for audit rows to appear (default 15000)',
      '15000'
    )
    .option('--audit-poll-interval-ms <ms>', 'Poll interval (default 2000)', '2000')
    .addHelpText('after', VERIFY_AUDIT_HELP_AFTER)
    .action(async(datasourceKey, options) => {
      try {
        await verifyAuditCommandAction(datasourceKey, options);
      } catch (error) {
        logger.error(formatBlockingError('verify-audit failed:'), error.message);
        process.exit(3);
      }
    });
}

module.exports = {
  setupDatasourceVerifyAuditCommand,
  verifyAuditCommandAction
};
