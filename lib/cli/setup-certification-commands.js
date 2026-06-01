/**
 * @fileoverview Enterprise AI Certification CLI commands (plan 150.0).
 */

'use strict';

const {
  VERIFY_OPERATIONS_HELP_AFTER,
  VERIFY_TRUST_HELP_AFTER,
  VERIFY_GOVERNANCE_HELP_AFTER,
  LIFECYCLE_HELP_AFTER
} = require('./setup-certification.help');
function collectScenarioId(value, previous) {
  return previous.concat([value]);
}

function setupVerifyOperationsCommand(program) {
  const { verifyOperationsCommandHandler } = require('../commands/verify-operations-command-action');
  program
    .command('verify-operations <systemKey>')
    .description('Operational readiness: validate, unit, integration, and E2E (system scope)')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro', 'dev')
    .option('-v, --verbose', 'Readiness breakdown and verification step checklist')
    .option('-d, --debug', 'Write debug logs under integration/<systemKey>/logs/')
    .option('--no-sync', 'Skip publishing local integration files before dataplane steps')
    .option(
      '--force',
      'With default sync, pass force to upload (same as aifabrix upload --force)'
    )
    .option('--continue', 'Continue after a failed step (still reports FAILED verdict)')
    .option('--json', 'Machine-readable product envelope')
    .addHelpText('after', VERIFY_OPERATIONS_HELP_AFTER)
    .action((systemKey, options, cmd) => verifyOperationsCommandHandler(systemKey, options, cmd));
}

function setupVerifyTrustCommand(program) {
  const { verifyTrustCommandHandler } = require('../commands/verify-trust-command-action');
  program
    .command('verify-trust <systemKey>')
    .description('AI business context confidence for every datasource (semantic metadata trust)')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro', 'dev')
    .option('-v, --verbose', 'Per-datasource breakdown')
    .option('-d, --debug', 'Write debug log under integration/<systemKey>/logs/')
    .option('--no-sync', 'Skip publishing local integration files before validate')
    .option(
      '--force',
      'With default sync, pass force to upload (same as aifabrix upload --force)'
    )
    .option('--revalidate', 'Force new validation for each datasource')
    .option('--timeout <ms>', 'HTTP timeout for validate/latest requests (ms)', '120000')
    .option('--json', 'Machine-readable product envelope')
    .addHelpText('after', VERIFY_TRUST_HELP_AFTER)
    .action((systemKey, options, cmd) => verifyTrustCommandHandler(systemKey, options, cmd));
}

function setupVerifyGovernanceCommand(program) {
  const { verifyGovernanceCommandHandler } = require('../commands/verify-governance-command-action');
  program
    .command('verify-governance <systemKey>')
    .description(
      'Governance enforcement: policy coverage and scenario acceptance (DB packs by default)'
    )
    .option('-e, --env <env>', 'Environment: dev, tst, or pro', 'dev')
    .option(
      '--pack <path>',
      'Authoring override: scenario pack YAML (default: dataplane DB packs per datasource)'
    )
    .option('-a, --app <path>', 'Integration folder override (with --pack)')
    .option('--scenario <id>', 'Run subset of scenario ids (with --pack; repeatable)', collectScenarioId, [])
    .option('--no-sync', 'Skip publishing local integration files before run')
    .option(
      '--force',
      'With default sync, pass force to upload (same as aifabrix upload --force)'
    )
    .option('-v, --verbose', 'Per-datasource breakdown')
    .option('--json', 'Machine-readable product envelope')
    .addHelpText('after', VERIFY_GOVERNANCE_HELP_AFTER)
    .action((systemKey, options, cmd) => verifyGovernanceCommandHandler(systemKey, options, cmd));
}

function setupLifecycleCommand(program) {
  const { lifecycleCommandHandler } = require('../commands/lifecycle-command-action');
  program
    .command('lifecycle <systemKey>')
    .description('Enterprise AI certification report (default: read persisted results from dataplane)')
    .option('-e, --env <env>', 'Environment: dev, tst, or pro', 'dev')
    .option('-v, --verbose', 'Per-datasource breakdown in the report')
    .option('-d, --debug', 'Write debug logs under integration/<systemKey>/logs/ when --run')
    .option('--run', 'Run missing verify steps, then print certification report')
    .option('--no-sync', 'With --run, skip publishing local integration files before verify')
    .option(
      '--force',
      'With default sync on --run, pass force to upload (same as aifabrix upload --force)'
    )
    .option('--json', 'Machine-readable certification envelope')
    .addHelpText('after', LIFECYCLE_HELP_AFTER)
    .action((systemKey, options, cmd) => lifecycleCommandHandler(systemKey, options, cmd));
}

function setupCertificationCommands(program) {
  setupVerifyOperationsCommand(program);
  setupVerifyTrustCommand(program);
  setupVerifyGovernanceCommand(program);
  setupLifecycleCommand(program);
}

module.exports = {
  setupCertificationCommands
};
