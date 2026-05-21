/**
 * @fileoverview TTY display for agent metadata trust runs (plan 143).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');
const { sectionTitle, headerKeyValue, metadata: metaGray } = require('./cli-test-layout-chalk');
const { statusGlyph } = require('./datasource-test-run-display');
const { trustDecisionToRowStatus } = require('../datasource/agent-trust-map');

const SEP = '────────────────────────────────';

/** @type {{ datasource: number, trust: number, conf: number, status: number, cache: number }} */
const TRUST_TABLE_COLS = {
  datasource: 30,
  trust: 24,
  conf: 6,
  status: 8,
  cache: 8
};

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
    headerKeyValue(
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
  const findings = Array.isArray(run.findings) ? run.findings : [];
  const showVerboseFindings = opts.verbose === true && findings.length > 0;
  if (warnings.length && !showVerboseFindings) {
    logger.log('');
    logger.log(chalk.yellow('  Warnings (high level)'));
    warnings.forEach(w => logger.log(`  • ${w}`));
  }
  if (!showVerboseFindings) return;
  logger.log('');
  logger.log(chalk.white('  Findings (verbose, max 10)'));
  findings.slice(0, 10).forEach(f => {
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

function trustCacheLabel(trustRun) {
  if (!trustRun || typeof trustRun !== 'object') return '—';
  if (trustRun.readLatest === true) return 'latest';
  if (trustRun.cacheHit === true) return 'hit';
  if (trustRun.cacheHit === false) return 'miss';
  return '—';
}

/**
 * @param {boolean} showCache
 * @returns {number}
 */
function trustTableLineWidth(showCache) {
  const { datasource, trust, conf, status, cache } = TRUST_TABLE_COLS;
  let w = 2 + datasource + 1 + trust + 1 + conf + 1 + status;
  if (showCache) w += 1 + cache;
  return w;
}

/**
 * @param {string} key
 * @returns {string}
 */
function formatTrustTableDatasourceCol(key) {
  return String(key || '').padEnd(TRUST_TABLE_COLS.datasource).slice(0, TRUST_TABLE_COLS.datasource);
}

/**
 * @param {Object|null|undefined} tr
 * @returns {string}
 */
function formatTrustTableTrustCol(tr) {
  const w = TRUST_TABLE_COLS.trust;
  if (!tr || !tr.trustDecision) return '—'.padEnd(w);
  const decision = String(tr.trustDecision);
  const cell = `${trustGlyph(decision)} ${decision}`;
  return cell.length > w ? cell.slice(0, w) : cell.padEnd(w);
}

/**
 * @param {Object|null|undefined} tr
 * @returns {string}
 */
function formatTrustTableConfCol(tr) {
  const w = TRUST_TABLE_COLS.conf;
  if (!tr || typeof tr.confidence !== 'number') return '—'.padStart(w);
  return `${Math.round(tr.confidence * 100)}%`.padStart(w);
}

/**
 * @param {Object|null|undefined} tr
 * @param {Object} row
 * @returns {string}
 */
function formatTrustTableStatusCol(tr, row) {
  const w = TRUST_TABLE_COLS.status;
  const raw = tr ? String(tr.validationStatus || '—') : row.error || 'fail';
  return raw.padEnd(w).slice(0, w);
}

/**
 * @param {boolean} showCache
 */
function logSystemTrustTableHeader(showCache) {
  const { datasource, trust, conf, status, cache } = TRUST_TABLE_COLS;
  let header = `  ${'Datasource'.padEnd(datasource)} ${'Trust'.padEnd(trust)} ${'Conf.'.padStart(conf)} ${'Status'.padEnd(status)}`;
  if (showCache) header += ` ${'Cache'.padEnd(cache)}`;
  logger.log(chalk.white(header));
  logger.log(chalk.gray(`  ${'─'.repeat(trustTableLineWidth(showCache))}`));
}

/**
 * @param {Object} row
 * @param {boolean} showCache
 * @returns {string}
 */
function formatTrustTableRow(row, showCache) {
  const tr = row.trustRun;
  let line = `  ${formatTrustTableDatasourceCol(row.key)} ${formatTrustTableTrustCol(tr)} ${formatTrustTableConfCol(tr)} ${formatTrustTableStatusCol(tr, row)}`;
  if (showCache) {
    line += ` ${trustCacheLabel(tr).padEnd(TRUST_TABLE_COLS.cache).slice(0, TRUST_TABLE_COLS.cache)}`;
  }
  return line;
}

function logSystemTrustTable(list, opts = {}) {
  const showCache = opts.showCache === true;
  logSystemTrustTableHeader(showCache);
  for (const row of list) {
    logger.log(formatTrustTableRow(row, showCache));
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
  logger.log(
    headerKeyValue('System trust:', `${statusGlyph(worst)} ${worst} (worst-of rollup)`)
  );
  logger.log('');
  logSystemTrustTable(list, opts);
  logger.log('');
  logger.log(metaGray('  ── What this run proved ──'));
  logger.log(metaGray(`  ✔ Semantic metadata reviewed for ${list.length} datasource(s) on dataplane`));
  logger.log(metaGray('  ✖ Did not call external APIs or run CIP (not E2E)'));
  logger.log(SEP);
}

module.exports = {
  displayAgentTrustRunTTY,
  displaySystemTrustRollupTTY,
  formatTrustTableRow,
  TRUST_TABLE_COLS
};
