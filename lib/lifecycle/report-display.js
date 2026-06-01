/**
 * @fileoverview TTY display for Enterprise AI Certification verify + lifecycle commands.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const {
  sectionTitle,
  formatSuccessParagraph,
  formatBlockingError,
  formatWarningLine,
  successGlyph,
  failureGlyph,
  metadata: metaGray
} = require('../utils/cli-test-layout-chalk');
const {
  VERDICT,
  formatCertificationStatusDisplay,
  actionHint,
  formatRecommendationAction
} = require('./product-model');
const {
  METRIC_KEYS,
  OPERATIONS_METRIC_LABELS
} = require('./operations-readiness-metrics');

const SEP = '────────────────────────';

function displayPillarHeader(systemKey, pillarLabel) {
  logger.log('');
  logger.log(sectionTitle(`${String(systemKey).toUpperCase()} — ${pillarLabel}`));
}

function displayHeroMetric(label, percent) {
  logger.log('');
  logger.log(chalk.white(label));
  if (typeof percent === 'number') {
    logger.log(chalk.cyan.bold(`${percent}%`));
  } else {
    logger.log(chalk.gray('—'));
  }
  logger.log('');
}

function displayVerdictLine(verdict, verifiedLabel, failedLabel) {
  if (verdict === VERDICT.VERIFIED) {
    logger.log(formatSuccessParagraph(verifiedLabel));
  } else {
    logger.log(formatBlockingError(failedLabel));
  }
}

/**
 * @param {string} systemKey
 * @param {Array<{ code: string, action?: string }>} warnings
 */
function displayPillarWarnings(systemKey, warnings) {
  if (!warnings || warnings.length === 0) return;
  logger.log('');
  for (const w of warnings) {
    const action = w.action || actionHint(systemKey, w.suggestedCommand || 'verify-trust');
    logger.log(formatWarningLine(`${w.message || w.code}. Run: ${action}`));
  }
}

/**
 * @param {Record<string, number>|null} readinessMetrics
 */
function displayOperationsReadinessMetrics(readinessMetrics) {
  if (!readinessMetrics || typeof readinessMetrics !== 'object') {
    return;
  }
  logger.log('');
  logger.log(chalk.white('Readiness breakdown'));
  logger.log(chalk.gray(SEP));
  for (const key of METRIC_KEYS) {
    const label = OPERATIONS_METRIC_LABELS[key] || key;
    const pct = readinessMetrics[key];
    const value =
      typeof pct === 'number' ? chalk.cyan.bold(`${pct}%`) : chalk.gray('—');
    logger.log(`  ${label.padEnd(34)}${value}`);
  }
}

/**
 * @param {Record<string, Record<string, boolean>>} detailsGrouped
 */
function displayOperationsVerificationSteps(detailsGrouped) {
  logger.log('');
  logger.log(chalk.white('Verification steps'));
  logger.log(chalk.gray(SEP));
  const groups = [
    ['Connectivity', ['credentials', 'authentication', 'authorization']],
    ['Contracts', ['openApi', 'mappings']],
    ['Runtime', ['sync', 'crud', 'execution']],
    ['Reliability', ['validation', 'unitTests', 'integrationTests', 'e2eTests']]
  ];
  const labels = {
    credentials: 'Credentials',
    authentication: 'Authentication',
    authorization: 'Authorization',
    openApi: 'OpenAPI',
    mappings: 'Mappings',
    sync: 'Sync',
    crud: 'CRUD',
    execution: 'Execution',
    validation: 'Validation',
    unitTests: 'Unit Tests',
    integrationTests: 'Integration Tests',
    e2eTests: 'E2E Tests'
  };
  for (const [groupName, keys] of groups) {
    logger.log(chalk.white(groupName));
    for (const key of keys) {
      const passed = detailsGrouped[groupName.toLowerCase()]?.[key] ?? detailsGrouped[key];
      const glyph = passed ? successGlyph() : failureGlyph();
      logger.log(`  ${labels[key] || key}`.padEnd(24) + glyph);
    }
  }
}

/**
 * @param {string} systemKey
 * @param {Object} result
 * @param {{ details?: boolean, warnings?: Array }} opts
 */
function displayVerifyOperationsTTY(systemKey, result, opts = {}) {
  displayPillarHeader(systemKey, 'OPERATIONS');
  displayHeroMetric('Operational Readiness', result.operationalReadinessPercent);
  displayVerdictLine(
    result.verdict,
    'OPERATIONS VERIFIED',
    'OPERATIONS FAILED'
  );
  displayPillarWarnings(systemKey, result.warnings);
  if (opts.details === true) {
    displayOperationsReadinessMetrics(result.readinessMetrics);
    if (result.details) {
      displayOperationsVerificationSteps(result.details);
    }
  }
}

/**
 * @param {string} systemKey
 * @param {Object} result
 * @param {{ details?: boolean }} opts
 */
function displayVerifyTrustTTY(systemKey, result, opts = {}) {
  displayPillarHeader(systemKey, 'AI TRUST');
  displayHeroMetric('AI Business Context Confidence', result.businessContextConfidencePercent);
  displayVerdictLine(result.verdict, 'AI TRUST VERIFIED', 'AI TRUST FAILED');
  if (opts.details === true && Array.isArray(result.datasourceRows)) {
    logger.log('');
    logger.log(chalk.white('Datasources'));
    logger.log(chalk.gray(SEP));
    for (const row of result.datasourceRows) {
      const conf =
        typeof row.confidencePercent === 'number' ? `${row.confidencePercent}%` : '—';
      const glyph = row.verdict === VERDICT.VERIFIED ? successGlyph() : failureGlyph();
      logger.log(`  ${row.datasourceKey}`.padEnd(36) + `${glyph} ${conf}`);
    }
  }
}

/**
 * @param {string} systemKey
 * @param {Object} result
 * @param {{ details?: boolean }} opts
 */
function displayVerifyGovernanceTTY(systemKey, result, opts = {}) {
  displayPillarHeader(systemKey, 'GOVERNANCE');
  displayHeroMetric('Policy Coverage', result.policyCoveragePercent);
  logger.log(chalk.white('Dimension Coverage'));
  logger.log(
    typeof result.dimensionCoveragePercent === 'number'
      ? chalk.cyan.bold(`${result.dimensionCoveragePercent}%`)
      : chalk.gray('—')
  );
  logger.log('');
  const scenarios = result.enforcementScenarios || {};
  const total = scenarios.total || 0;
  const passed = scenarios.passed || 0;
  logger.log(chalk.white('Enforcement Scenarios'));
  logger.log(chalk.cyan.bold(`${passed}/${total} Passed`));
  logger.log('');
  displayVerdictLine(result.verdict, 'GOVERNANCE VERIFIED', 'GOVERNANCE FAILED');
  if (opts.details === true && Array.isArray(result.datasourceRows)) {
    logger.log('');
    logger.log(chalk.white('Datasources'));
    logger.log(chalk.gray(SEP));
    for (const row of result.datasourceRows) {
      const glyph = row.verdict === VERDICT.VERIFIED ? successGlyph() : failureGlyph();
      const line = row.scenarios
        ? `${row.scenarios.passed}/${row.scenarios.total}`
        : row.error || '—';
      logger.log(`  ${row.datasourceKey}`.padEnd(36) + `${glyph} ${line}`);
    }
  }
}

function formatPillarLine(label, verdict) {
  if (verdict === VERDICT.VERIFIED) {
    return `${label.padEnd(24)}${successGlyph()} VERIFIED`;
  }
  if (verdict === VERDICT.FAILED) {
    return `${label.padEnd(24)}${failureGlyph()} FAILED`;
  }
  return `${label.padEnd(24)}— NOT VERIFIED`;
}

function displayCertificationSummary(report) {
  const level = report.certification?.level || 'NONE';
  const status = report.certification?.status || 'NOT_CERTIFIED';
  logger.log(chalk.white('Certification'));
  logger.log(chalk.gray(SEP));
  logger.log(chalk.cyan.bold(level));
  logger.log('');
  logger.log(chalk.white('Status'));
  logger.log(chalk.gray(SEP));
  logger.log(formatCertificationStatusDisplay(status));
  logger.log('');
}

function displayPillarVerdicts(report) {
  logger.log(formatPillarLine('Operations', report.operations?.verdict));
  logger.log(formatPillarLine('AI Trust', report.trust?.verdict));
  logger.log(formatPillarLine('Governance', report.governance?.verdict));
}

/**
 * @param {string} systemKey
 * @param {Array<{ code: string, action?: string }>} recs
 */
function displayRecommendationsBlock(systemKey, recs) {
  if (recs.length === 0) {
    return;
  }
  logger.log('');
  logger.log(chalk.white('Recommendations'));
  logger.log(chalk.gray(SEP));
  logger.log(metaGray(`${recs.length} improvement${recs.length === 1 ? '' : 's'} available`));
  for (const rec of recs) {
    logger.log(`  • ${formatRecommendationAction(systemKey, rec)}`);
  }
}

/**
 * @param {Array<Object>} datasources
 */
function displayDatasourceBreakdown(datasources) {
  logger.log('');
  logger.log(chalk.white('Datasource breakdown'));
  logger.log(chalk.gray(SEP));
  for (const ds of datasources) {
    logger.log(chalk.white(`  ${ds.datasourceKey}`));
    logger.log(`    ${formatPillarLine('Operations', ds.operations?.verdict).trim()}`);
    logger.log(`    ${formatPillarLine('AI Trust', ds.trust?.verdict).trim()}`);
    logger.log(`    ${formatPillarLine('Governance', ds.governance?.verdict).trim()}`);
  }
}

/**
 * @param {string} systemKey
 * @param {Object} report - SystemLifecycleReport shape
 * @param {{ details?: boolean }} opts
 */
function displayLifecycleReportTTY(systemKey, report, opts = {}) {
  logger.log('');
  logger.log(sectionTitle(`${String(systemKey).toUpperCase()} CERTIFICATION REPORT`));
  logger.log('');
  displayCertificationSummary(report);
  displayPillarVerdicts(report);
  displayRecommendationsBlock(systemKey, report.recommendations || []);
  if (opts.details === true && Array.isArray(report.datasources) && report.datasources.length > 0) {
    displayDatasourceBreakdown(report.datasources);
  }
  logger.log('');
}

module.exports = {
  displayVerifyOperationsTTY,
  displayVerifyTrustTTY,
  displayVerifyGovernanceTTY,
  displayLifecycleReportTTY,
  displayOperationsReadinessMetrics,
  displayOperationsVerificationSteps
};
