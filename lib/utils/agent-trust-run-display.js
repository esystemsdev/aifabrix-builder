/**
 * @fileoverview TTY display for agent metadata trust runs (plan 143).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');
const {
  SEP,
  sectionTitle,
  headerKeyValue,
  formatStatusKeyValue,
  metadata: metaGray
} = require('./cli-test-layout-chalk');
const { statusGlyph } = require('./datasource-test-run-display');
const { trustDecisionToRowStatus } = require('../datasource/agent-trust-map');

function trustGlyph(trustDecision) {
  return statusGlyph(trustDecisionToRowStatus(trustDecision));
}

function publishGateLine(trustDecision, strict) {
  if (trustDecision === 'notTrusted') return chalk.red('blocked (trustDecision notTrusted)');
  if (strict) {
    return trustDecision === 'trusted'
      ? chalk.green('allowed (strict: trusted)')
      : chalk.yellow('blocked (strict requires trusted)');
  }
  return chalk.green('allowed (warning-only); use --strict to require trusted');
}

function logTrustHeader(run, env) {
  logger.log(SEP);
  logger.log(sectionTitle(`Semantic trust — ${run.datasourceKey}`));
  logger.log(headerKeyValue('Environment:', env));
  logger.log(headerKeyValue('System:', run.systemKey || '—'));
  logger.log(SEP);
  logger.log(metaGray('  Layer checked: business metadata (404.5 agent validation)'));
  logger.log(metaGray('  Not checked here: vendor connectivity, sync, record counts (use test-e2e)'));
  logger.log('');
}

function logTrustSummaryBlock(run) {
  const confPct = Math.round((run.confidence || 0) * 100);
  logger.log(
    formatStatusKeyValue(
      'Trust:',
      `${trustGlyph(run.trustDecision)} ${run.trustDecision} · confidence ${confPct}% · ${run.validationStatus}`
    )
  );
  if (!run.validatedAt) return;
  const hashShort = run.inputHash ? `${String(run.inputHash).slice(0, 8)}…` : '—';
  logger.log(
    metaGray(
      `  Validated: ${run.validatedAt} · inputHash ${hashShort} · cache: ${run.cacheHit ? 'hit' : 'miss'}`
    )
  );
}

function logTrustWarningsAndFindings(run, opts) {
  if (run.summary) {
    logger.log('');
    logger.log(chalk.white('  Summary'));
    logger.log(`  ${run.summary}`);
  }
  const warnings = Array.isArray(run.highLevelWarnings) ? run.highLevelWarnings : [];
  if (warnings.length) {
    logger.log('');
    logger.log(chalk.yellow('  Warnings (high level)'));
    warnings.forEach(w => logger.log(`  • ${w}`));
  }
  if (!opts.verbose || !Array.isArray(run.findings) || !run.findings.length) return;
  logger.log('');
  logger.log(chalk.white('  Findings (verbose, max 10)'));
  run.findings.slice(0, 10).forEach(f => {
    logger.log(`  • [${f.severity || 'info'}] ${f.code || 'FINDING'}: ${f.message || ''}`);
  });
}

function logTrustFooter(run, opts) {
  logger.log('');
  logger.log(metaGray('  ── Integration reality (informative) ──'));
  logger.log(metaGray(`  Local manifest:  ${opts.noSync ? 'not uploaded (--no-sync)' : 'uploaded before run'}`));
  logger.log(metaGray(`  Publish gate:    ${publishGateLine(run.trustDecision, opts.strict === true)}`));
  logger.log(SEP);
}

function displayAgentTrustRunTTY(run, opts = {}) {
  if (!run || opts.json === true) return;
  const env = opts.environment ? String(opts.environment) : 'dev';
  logTrustHeader(run, env);
  logTrustSummaryBlock(run);
  logTrustWarningsAndFindings(run, opts);
  logTrustFooter(run, opts);
}

function logSystemTrustTable(list) {
  logger.log(chalk.white('  Datasource                    Trust                  Conf.   Status'));
  logger.log(chalk.gray('  ─────────────────────────────────────────────────────────────────'));
  for (const row of list) {
    const tr = row.trustRun;
    const key = (row.key || '').padEnd(28).slice(0, 28);
    const td = tr ? String(tr.trustDecision || '—').padEnd(22).slice(0, 22) : '—'.padEnd(22);
    const conf =
      tr && typeof tr.confidence === 'number'
        ? `${Math.round(tr.confidence * 100)}%`.padStart(4)
        : '  — ';
    const vs = tr ? String(tr.validationStatus || '—') : row.error || 'fail';
    logger.log(`  ${key}  ${trustGlyph(tr && tr.trustDecision)} ${td}  ${conf}   ${vs}`);
  }
}

function displaySystemTrustRollupTTY(systemKey, rows, opts = {}) {
  if (opts.json === true) return;
  const list = Array.isArray(rows) ? rows : [];
  logger.log(SEP);
  logger.log(sectionTitle(`Semantic trust — system ${systemKey} (${list.length} datasources)`));
  const { deriveSystemStatus } = require('./external-system-system-test-tty');
  const worst = deriveSystemStatus(
    list.map(r => ({
      success: r.success !== false,
      datasourceTestRun: {
        status: r.trustRun ? trustDecisionToRowStatus(r.trustRun.trustDecision) : 'fail'
      }
    }))
  );
  logger.log(formatStatusKeyValue('System trust:', `${statusGlyph(worst)} ${worst} (worst-of rollup)`));
  logger.log('');
  logSystemTrustTable(list);
  logger.log('');
  logger.log(metaGray('  ── What this run proved ──'));
  logger.log(metaGray(`  ✔ Semantic metadata reviewed for ${list.length} datasource(s) on dataplane`));
  logger.log(metaGray('  ✖ Did not call external APIs or run CIP (not E2E)'));
  logger.log(SEP);
}

module.exports = {
  displayAgentTrustRunTTY,
  displaySystemTrustRollupTTY
};
