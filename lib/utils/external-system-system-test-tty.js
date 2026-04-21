/**
 * @fileoverview System-level TTY renderer for DatasourceTestRun fan-out results (plan §17).
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');
const {
  SEP,
  statusGlyph
} = require('./datasource-test-run-display');
const {
  sectionTitle,
  headerKeyValue,
  formatStatusKeyValue,
  integrationFooterLine,
  colorRollupPrefixedLine,
  metadata: metaGray
} = require('./cli-test-layout-chalk');
const {
  formatDataQualityLines,
  readinessLineFromDataReadiness,
  verdictLineFromEnvelope
} = require('./validation-report-tty-kit');
const {
  logCapabilitiesOverview: logCapabilitiesOverviewSection,
  logIntegrationHealthSection: logIntegrationHealthSectionBlock
} = require('./external-system-system-test-tty-overview');

/**
  * @param {'ok'|'warn'|'fail'|'skipped'|null} st
  * @returns {number}
  */
function statusRank(st) {
  if (st === 'fail') return 0;
  if (st === 'warn') return 1;
  if (st === 'ok') return 2;
  if (st === 'skipped') return 3;
  return 4;
}

/**
 * Per-row status for system rollup and tables: CLI/transport failure overrides envelope-only OK.
 * @param {{ skipped?: boolean, success?: boolean, datasourceTestRun?: { status?: string }|null }} r
 * @returns {'ok'|'warn'|'fail'|'skipped'}
 */
function rollupRowStatus(r) {
  if (r && r.skipped) return 'skipped';
  if (r && r.success === false) return 'fail';
  const env = r && r.datasourceTestRun;
  return env && typeof env.status === 'string' ? env.status : 'ok';
}

/**
  * @param {Array<{ key: string, skipped?: boolean, datasourceTestRun?: Object|null, success?: boolean }>} rows
  * @returns {'ok'|'warn'|'fail'|'skipped'}
  */
function deriveSystemStatus(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 'ok';
  const statuses = rows.map(rollupRowStatus);
  if (statuses.some(s => s === 'fail')) return 'fail';
  if (statuses.some(s => s === 'warn')) return 'warn';
  if (statuses.every(s => s === 'skipped')) return 'skipped';
  // Mixed ok/skipped => warn per plan.
  return statuses.every(s => s === 'ok') ? 'ok' : 'warn';
}

function bucketIssueSeverity(issue) {
  const sev = issue && issue.severity ? String(issue.severity).toLowerCase() : '';
  if (sev === 'error' || sev === 'critical' || sev === 'high' || sev === 'fatal') return 'fail';
  if (sev === 'warn' || sev === 'warning' || sev === 'medium') return 'warn';
  return null;
}

/**
  * Minimal heuristic rollups backed by envelope fields (no engine codenames).
  * @param {Object|null|undefined} env
  * @returns {'ok'|'warn'|'fail'}
  */
function dqFromEnvelope(env) {
  const v = env && env.validation;
  const st = v && typeof v.status === 'string' ? String(v.status) : null;
  if (st === 'fail') return 'fail';
  if (st === 'warn') return 'warn';

  const issues = v && Array.isArray(v.issues) ? v.issues : [];
  if (issues.some(i => bucketIssueSeverity(i) === 'fail')) return 'fail';
  if (issues.some(i => bucketIssueSeverity(i) === 'warn')) return 'warn';
  return 'ok';
}

/**
  * @param {Array} rows
  * @returns {{ schema: 'ok'|'warn'|'fail', consistency: 'ok'|'warn'|'fail', reliability: 'ok'|'warn'|'fail' }}
  */
function deriveSystemDataQuality(rows) {
  const envs = rows
    .map(r => (r && r.datasourceTestRun && typeof r.datasourceTestRun === 'object' ? r.datasourceTestRun : null))
    .filter(Boolean);
  if (envs.length === 0) {
    return { schema: 'warn', consistency: 'warn', reliability: 'warn' };
  }

  const picks = envs.map(dqFromEnvelope);
  const agg = picks.some(x => x === 'fail') ? 'fail' : picks.some(x => x === 'warn') ? 'warn' : 'ok';
  return { schema: agg, consistency: agg, reliability: agg };
}

/**
  * @param {Array} rows
  * @returns {'ready'|'partial'|'not_ready'|null}
  */
function deriveSystemReadiness(rows) {
  const envs = rows
    .map(r => (r && r.datasourceTestRun && typeof r.datasourceTestRun === 'object' ? r.datasourceTestRun : null))
    .filter(Boolean);
  const drs = envs
    .map(e => e.validation && e.validation.dataReadiness)
    .filter(Boolean);
  if (drs.length === 0) return null;
  if (drs.some(x => x === 'not_ready')) return 'not_ready';
  if (drs.some(x => x === 'partial')) return 'partial';
  return 'ready';
}

function countByStatus(rows) {
  const counts = { ok: 0, warn: 0, fail: 0, skipped: 0 };
  for (const r of rows) {
    const s = rollupRowStatus(r);
    if (counts[s] !== undefined) counts[s] += 1;
  }
  return counts;
}

function pickBlockingDatasourceKey(rows) {
  const keys = rows
    .map(r => {
      const env = r && r.datasourceTestRun;
      const st = rollupRowStatus(r);
      const key =
        env && env.datasourceKey
          ? String(env.datasourceKey)
          : r && r.key
            ? String(r.key)
            : '';
      return { key, st };
    })
    .filter(x => x.key);
  keys.sort((a, b) => {
    const d = statusRank(a.st) - statusRank(b.st);
    if (d !== 0) return d;
    return a.key.localeCompare(b.key);
  });
  return keys.length ? keys[0].key : null;
}

function issueKey(issue) {
  const code = issue && issue.code ? String(issue.code) : '';
  const msg = issue && issue.message ? String(issue.message) : '';
  return `${code}::${msg}`.toLowerCase();
}

function issueSortKey(it) {
  return `${statusRank(it.severity)}::${it.datasourceKey}::${it.message}`.toLowerCase();
}

function extractRowIssues(row) {
  const env = row && row.datasourceTestRun;
  const datasourceKey = (env && env.datasourceKey) || (row && row.key) || 'datasource';
  const issues = env && env.validation && Array.isArray(env.validation.issues) ? env.validation.issues : [];
  const envStatus = env && typeof env.status === 'string' ? env.status : null;
  return { datasourceKey: String(datasourceKey), issues, envStatus };
}

function toIssueItem(datasourceKey, envStatus, iss) {
  const sev =
    bucketIssueSeverity(iss) ||
    (envStatus === 'fail' ? 'fail' : envStatus === 'warn' ? 'warn' : 'ok');
  const msg = iss && iss.message ? String(iss.message) : iss && iss.code ? String(iss.code) : 'Issue';
  return { datasourceKey, message: msg, severity: sev };
}

function collectKeyIssues(rows, cap) {
  /** @type {{ datasourceKey: string, message: string, severity: 'fail'|'warn'|'ok' }[]} */
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const { datasourceKey, issues, envStatus } = extractRowIssues(row);
    for (const iss of issues) {
      const k = `${datasourceKey}::${issueKey(iss)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(toIssueItem(datasourceKey, envStatus, iss));
    }
  }
  out.sort((a, b) => issueSortKey(a).localeCompare(issueSortKey(b)));
  return out.slice(0, Math.max(0, cap));
}

function certificateBucket(env) {
  const cert = env && env.certificate;
  if (!cert || typeof cert !== 'object') return { status: null, level: null };
  return {
    status: cert.status ? String(cert.status) : null,
    level: cert.level ? String(cert.level) : null
  };
}

function systemCertStatus(rows) {
  const certs = rows
    .map(r => (r && r.datasourceTestRun ? certificateBucket(r.datasourceTestRun) : { status: null, level: null }))
    .filter(c => c.status !== null);
  if (certs.length === 0) return null;
  if (certs.some(c => c.status === 'not_passed')) return 'not_passed';
  return 'passed';
}

function drillDownCommand(runType, datasourceKey) {
  if (!datasourceKey) return null;
  if (runType === 'e2e') return `aifabrix datasource test-e2e ${datasourceKey}`;
  if (runType === 'integration') return `aifabrix datasource test-integration ${datasourceKey}`;
  return `aifabrix datasource test ${datasourceKey}`;
}

function logSystemHeader(results, runType, systemStatus) {
  logger.log('');
  logger.log(sectionTitle('Server test results'));
  logger.log('');
  logger.log(headerKeyValue('System:', results.systemKey));
  logger.log(
    headerKeyValue(
      'Run:',
      runType === 'e2e' ? 'test-e2e (dataplane)' : 'test-integration (dataplane)'
    )
  );
  logger.log(formatStatusKeyValue(systemStatus, statusGlyph(systemStatus)));
  logger.log('');
}

function logVerdictAndSummary(runType, systemStatus, certStatus, counts) {
  logger.log(sectionTitle('Verdict:'));
  logger.log(chalk.white(verdictLineFromEnvelope(systemStatus, certStatus, runType)));
  logger.log('');
  logger.log(sectionTitle('Summary:'));
  logger.log(
    chalk.white(
      `${counts.ok + counts.warn + counts.fail} datasource(s): ${counts.ok} ok, ${counts.warn} warn, ${counts.fail} fail${counts.skipped ? `, ${counts.skipped} skipped` : ''}`
    )
  );
  logger.log('');
  logger.log(metaGray(SEP));
  logger.log('');
}

function logDataQualityAndReadiness(rows) {
  logger.log(sectionTitle('Data Quality:'));
  const dq = deriveSystemDataQuality(rows);
  const dqLines = formatDataQualityLines(dq, {
    schema: 'structural coverage aggregated across datasources.',
    consistency: 'issues aggregated across datasources.',
    reliability: 'issues aggregated across datasources.'
  });
  dqLines.map(colorRollupPrefixedLine).forEach(l => logger.log(l));

  const readiness = deriveSystemReadiness(rows);
  const readinessLine = readinessLineFromDataReadiness(readiness);
  if (readinessLine) {
    logger.log('');
    logger.log(colorRollupPrefixedLine(readinessLine));
  }

  logger.log('');
  logger.log(metaGray(SEP));
  logger.log('');
}

function logDatasourceTable(rows, counts, verbose) {
  logger.log(sectionTitle('Datasources:'));
  logger.log('');
  if (!verbose && counts.ok > 0) {
    logger.log(chalk.gray(`✔ ${counts.ok} datasource(s) fully ready`));
  }

  function rowStatus(r) {
    return rollupRowStatus(r);
  }

  function readinessLabel(env, st) {
    const ready = env && env.validation ? env.validation.dataReadiness : null;
    if (ready === 'not_ready') return 'Not ready';
    if (ready === 'partial') return 'Partial';
    if (ready === 'ready') return 'Ready';
    if (st === 'fail') return 'Not ready';
    if (st === 'warn') return 'Partial';
    return 'Ready';
  }

  function shouldListRow(r) {
    if (verbose) return true;
    const st = rowStatus(r);
    return st === 'warn' || st === 'fail';
  }

  const listRows = rows.filter(shouldListRow);
  for (const r of listRows) {
    const env = r && r.datasourceTestRun;
    const key = (env && env.datasourceKey) || (r && r.key) || 'datasource';
    const st = rowStatus(r);
    const readyLabel = readinessLabel(env, st);
    logger.log(`${statusGlyph(st)} ${chalk.white(String(key).padEnd(22))} (${readyLabel})`);
  }
}

function logBlockingDatasource(blocking) {
  if (!blocking) return;
  logger.log('');
  logger.log(chalk.white(`Blocking datasource: ${blocking}`));
}

function logKeyIssuesSection(rows) {
  const issues = collectKeyIssues(rows, 5);
  if (issues.length === 0) return false;
  logger.log('');
  logger.log(metaGray(SEP));
  logger.log('');
  logger.log(sectionTitle('Key issues:'));
  logger.log('');
  let cur = null;
  for (const it of issues) {
    if (cur !== it.datasourceKey) {
      cur = it.datasourceKey;
      logger.log(chalk.white(cur));
    }
    logger.log(chalk.white(`- ${it.message}`));
  }
  return true;
}

function logCertificationSection(rows) {
  const certSt = systemCertStatus(rows);
  if (!certSt) return;
  logger.log('');
  logger.log(metaGray(SEP));
  logger.log('');
  logger.log(sectionTitle('Certification:'));
  logger.log('');
  logger.log(chalk.white(`System level: ${certSt === 'passed' ? '✔ Achieved' : '✖ Not achieved'}`));
  logger.log('');
  logger.log(chalk.white('Breakdown:'));
  for (const r of rows) {
    const env = r && r.datasourceTestRun;
    if (!env) continue;
    const cert = certificateBucket(env);
    if (!cert.status) continue;
    const g = cert.status === 'passed' ? '✔' : '✖';
    const tier = cert.level ? cert.level : '(no level)';
    logger.log(chalk.white(`- ${env.datasourceKey}: ${g} ${tier}`));
  }
}

function logUseAndFooter(results, runType, systemStatus, blocking) {
  logger.log('');
  logger.log(metaGray(SEP));
  logger.log('');
  logger.log(sectionTitle('Use:'));
  const cmd = drillDownCommand(runType, blocking);
  logger.log(chalk.white(cmd || 'aifabrix datasource test <datasourceKey>'));
  logger.log(
    integrationFooterLine(
      results.success,
      systemStatus,
      'All server tests passed.',
      'Server tests completed with warnings.',
      'Some server tests failed.'
    )
  );
}

/**
  * Render system-level aggregate (plan §17) for DatasourceTestRun wrapper results.
  * @param {Object} results
  * @param {Object} opts
  * @param {'integration'|'e2e'} opts.runType
  * @param {boolean} opts.verbose
  */
function displaySystemAggregateDatasourceTestRuns(results, opts) {
  const rows = Array.isArray(results.datasourceResults) ? results.datasourceResults : [];
  const runType = opts.runType === 'e2e' ? 'e2e' : 'integration';
  const systemStatus = deriveSystemStatus(rows);
  const counts = countByStatus(rows);
  const blocking = pickBlockingDatasourceKey(rows);
  logSystemHeader(results, runType, systemStatus);
  logVerdictAndSummary(runType, systemStatus, systemCertStatus(rows), counts);
  logDataQualityAndReadiness(rows);
  logDatasourceTable(rows, counts, Boolean(opts.verbose));
  logBlockingDatasource(blocking);
  logKeyIssuesSection(rows);
  const ttyIo = { log: logger.log.bind(logger), chalk, metaGray, sectionTitle, statusGlyph, SEP };
  logCapabilitiesOverviewSection(rows, ttyIo);
  logIntegrationHealthSectionBlock(rows, runType, ttyIo);
  logCertificationSection(rows);
  logUseAndFooter(results, runType, systemStatus, blocking);
}

module.exports = {
  displaySystemAggregateDatasourceTestRuns,
  deriveSystemStatus,
  deriveSystemDataQuality,
  deriveSystemReadiness,
  rollupRowStatus,
  pickBlockingDatasourceKey,
  collectKeyIssues,
  systemCertStatus,
  drillDownCommand
};

