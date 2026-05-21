/**
 * @fileoverview TTY display for governance scenario acceptance runs
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const {
  sectionTitle,
  headerKeyValue,
  metadata: metaGray,
  formatSuccessParagraph,
  formatBlockingError
} = require('../utils/cli-test-layout-chalk');

const SEP = '────────────────────────────────';

/**
 * @param {'pass'|'fail'} status
 * @returns {string}
 */
function scenarioGlyph(status) {
  return status === 'pass' ? chalk.green('✔') : chalk.red('✖');
}

/**
 * @param {import('../api/types/governance-scenarios.types').GovernanceScenarioResult} scenario
 * @param {boolean} verbose
 */
function logScenarioVerdict(scenario, verbose) {
  logger.log(`  ${scenarioGlyph(scenario.status)} ${scenario.verdict}`);
  if (!verbose) return;
  logger.log(
    metaGray(
      `      Subject: ${scenario.subjectDisplayName} (${scenario.subjectUserId})`
    )
  );
  if (scenario.subjectGroups && scenario.subjectGroups.length > 0) {
    logger.log(metaGray(`      Groups: ${scenario.subjectGroups.join(', ')}`));
  }
  logger.log(
    metaGray(
      `      Visible keys: ${scenario.visibleKeyCount} · excluded ABAC: ${scenario.excludedAbac}` +
        (scenario.auditRef ? ` · audit: ${scenario.auditRef}` : '')
    )
  );
  if (scenario.unexpectedVisibleKeys && scenario.unexpectedVisibleKeys.length > 0) {
    logger.log(
      metaGray(`      Unexpected: ${scenario.unexpectedVisibleKeys.join(', ')}`)
    );
  }
  if (scenario.missingRequiredKeys && scenario.missingRequiredKeys.length > 0) {
    logger.log(metaGray(`      Missing: ${scenario.missingRequiredKeys.join(', ')}`));
  }
  if (scenario.fixHint) {
    logger.log(metaGray(`      Fix: ${scenario.fixHint}`));
  }
}

/**
 * @param {string} systemKey
 * @param {import('../api/types/governance-scenarios.types').GovernanceScenariosRunResponse} result
 * @param {{ verbose?: boolean, packPath?: string }} opts
 */
function displayGovernanceRunTTY(systemKey, result, opts = {}) {
  const agg = result.summary.failed > 0 ? 'fail' : 'ok';
  logger.log(SEP);
  logger.log(sectionTitle('Governed search acceptance (key sets only — no record payload)'));
  logger.log(headerKeyValue('System:', systemKey));
  logger.log(headerKeyValue('Pack:', result.packKey));
  if (opts.packPath) {
    logger.log(metaGray(`  File: ${opts.packPath}`));
  }
  logger.log(
    headerKeyValue(
      'Summary:',
      `${result.summary.passed}/${result.summary.total} passed`
    )
  );
  logger.log(metaGray('  Does not call vendor APIs (use test-e2e for connectivity).'));
  logger.log('');
  for (const scenario of result.scenarios || []) {
    logScenarioVerdict(scenario, opts.verbose === true);
  }
  logger.log('');
  if (agg === 'ok') {
    logger.log(formatSuccessParagraph('All governance scenarios passed'));
  } else {
    logger.log(formatBlockingError(`${result.summary.failed} scenario(s) failed`));
  }
  logger.log(SEP);
}

/**
 * @param {import('../api/types/governance-scenarios.types').GovernanceScenariosRunResponse} result
 */
function printGovernanceRunJson(result) {
  logger.log(JSON.stringify(result, null, 2));
}

/**
 * @param {{ total: number, passed: number, failed: number }} summary
 * @returns {number}
 */
function exitCodeFromGovernanceSummary(summary) {
  if (!summary || summary.failed > 0) {
    return 1;
  }
  return 0;
}

module.exports = {
  displayGovernanceRunTTY,
  printGovernanceRunJson,
  exitCodeFromGovernanceSummary
};
