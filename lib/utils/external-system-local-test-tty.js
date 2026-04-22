/**
 * @fileoverview Structured TTY report for local external `aifabrix test` (no DatasourceTestRun envelope).
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');
const {
  SEP,
  statusGlyph,
  verdictLineLocalExternalTest,
  readinessLineFromAggregateStatus,
  formatDataQualityLines,
  pushSeparatorBlock
} = require('./validation-report-tty-kit');
const {
  sectionTitle,
  headerKeyValue,
  formatStatusKeyValue,
  colorRollupPrefixedLine,
  metadata: metaGray
} = require('./cli-test-layout-chalk');

/**
 * @param {Object} results
 * @returns {'ok'|'warn'|'fail'}
 */
function deriveRootStatus(results) {
  if (!results.valid || (results.errors && results.errors.length > 0)) {
    return 'fail';
  }
  const dsWarn = (results.datasourceResults || []).some(r => r.warnings && r.warnings.length > 0);
  if ((results.warnings && results.warnings.length > 0) || dsWarn) {
    return 'warn';
  }
  return 'ok';
}

/**
 * @param {Object} results
 * @returns {{ schema: 'ok'|'warn'|'fail', consistency: 'ok'|'warn'|'fail', reliability: 'ok'|'warn'|'fail' }}
 */
function deriveDataQualityRollups(results) {
  const systemsOk = (results.systemResults || []).every(s => s.valid);
  const ds = results.datasourceResults || [];
  const structuralOk = ds.length === 0 || ds.every(r => r.structuralValid !== false);

  let schema = 'ok';
  if (!systemsOk || !structuralOk) {
    schema = 'fail';
  }

  const ranPayload = ds.filter(r => r.payloadTestsRan === true);
  const skippedPayload = ds.filter(r => r.payloadTestsRan !== true);
  let consistency = 'ok';
  if (ranPayload.some(r => r.payloadTestsOk === false)) {
    consistency = 'fail';
  } else if (skippedPayload.length > 0) {
    consistency = skippedPayload.length === ds.length ? 'warn' : 'warn';
  }

  const reliability = 'warn';

  return { schema, consistency, reliability };
}

/**
 * @param {Object} results
 * @returns {Array<{ label: string, message: string }>}
 */
function collectFailureItems(results) {
  const out = [];
  for (const e of results.errors || []) {
    out.push({ label: 'manifest', message: String(e) });
  }
  for (const s of results.systemResults || []) {
    for (const err of s.errors || []) {
      out.push({ label: s.file || 'system', message: String(err) });
    }
  }
  for (const d of results.datasourceResults || []) {
    for (const err of d.errors || []) {
      out.push({ label: d.key || d.file || 'datasource', message: String(err) });
    }
  }
  return out;
}

/**
 * @param {Array<{ label: string, message: string }>} failures
 * @param {number} max
 * @returns {string[]}
 */
function formatDeductionLines(failures, max) {
  if (failures.length === 0) return [];
  const lines = ['Deductions:'];
  const cap = Math.min(max, failures.length);
  for (let i = 0; i < cap; i += 1) {
    const f = failures[i];
    lines.push(`- [${f.label}] ${f.message}`);
  }
  return lines;
}

/**
 * @param {Object} results
 * @param {Array<{ label: string, message: string }>} failures
 * @returns {string[]}
 */
function formatNextActionLines(results, failures) {
  const lines = ['Next actions:'];
  if (failures.length > 0) {
    lines.push('- Fix Failures above, then re-run `aifabrix test`.');
    lines.push('- Run `aifabrix test-integration` to validate against the dataplane when manifests are clean.');
    return lines;
  }
  if ((results.warnings || []).length > 0) {
    lines.push('- Review warnings; add testPayload where missing for deeper local checks.');
  } else {
    lines.push('- Proceed to `aifabrix test-integration` or deploy when ready.');
  }
  return lines;
}

function appendLocalDataQualitySection(lines, dq, failures, status) {
  lines.push('Data Quality:');
  formatDataQualityLines(dq, {
    schema: 'structural JSON and system/datasource schema checks.',
    consistency: 'field mappings and metadata schema (where testPayload is present).',
    reliability: 'live API/connectivity not exercised in this command.'
  }).forEach(l => lines.push(l));
  lines.push('');
  if (failures.length > 0) {
    lines.push(...formatDeductionLines(failures, 3));
    lines.push('');
  }
  lines.push(readinessLineFromAggregateStatus(status));
  lines.push('');
  lines.push(SEP);
}

function appendLocalFailureDetailSections(lines, failures) {
  if (failures.length === 0) return;
  pushSeparatorBlock(lines);
  lines.push('Failures:');
  for (const f of failures) {
    lines.push('');
    lines.push(`${f.label}:`);
    lines.push(`- ${f.message}`);
  }
  pushSeparatorBlock(lines);
  lines.push('Impact:');
  lines.push(`- ${failures.length} blocking issue(s) must be resolved before integration test or deploy.`);
  pushSeparatorBlock(lines);
}

function appendLocalTrailingSections(lines, results, failures) {
  lines.push('');
  lines.push(...formatNextActionLines(results, failures));
  if ((results.warnings || []).length === 0) return;
  lines.push('');
  lines.push('Other warnings:');
  for (const w of results.warnings) {
    lines.push(`- ${w}`);
  }
}

/**
 * @param {Object} results
 * @param {string} appName
 * @returns {string[]}
 */
function buildLocalExternalPlanLines(results, appName) {
  const systemKey = results.systemKey || appName || 'unknown';
  const status = deriveRootStatus(results);
  const dq = deriveDataQualityRollups(results);
  const failures = collectFailureItems(results);
  const nSys = (results.systemResults || []).length;
  const nDs = (results.datasourceResults || []).length;
  const appSuffix = results.appName && results.appName !== systemKey ? ` (${results.appName})` : '';

  const lines = [];
  lines.push(
    `System: ${systemKey}${appSuffix}`,
    'Run: test (local)',
    `Status: ${statusGlyph(status)} ${status}`,
    '',
    'Verdict:',
    verdictLineLocalExternalTest(status),
    '',
    'Summary:',
    `Local manifest validation only (${nSys} system file(s), ${nDs} datasource(s)); no dataplane run.`
  );
  pushSeparatorBlock(lines);
  appendLocalDataQualitySection(lines, dq, failures, status);
  appendLocalFailureDetailSections(lines, failures);
  appendLocalTrailingSections(lines, results, failures);
  return lines;
}

/**
 * Failures section + blank + separator lines for local plan TTY.
 * @param {string} line
 * @param {{ inFailuresSection: boolean }} state
 * @returns {boolean} True if handled
 */
function emitLocalPlanFailuresAndSeparators(line, state) {
  if (line === 'Failures:') {
    state.inFailuresSection = true;
    logger.log(chalk.red.bold('Failures:'));
    return true;
  }
  if (state.inFailuresSection && line === SEP) {
    state.inFailuresSection = false;
    logger.log(metaGray(SEP));
    return true;
  }
  if (line === '') {
    logger.log('');
    return true;
  }
  if (line === SEP) {
    logger.log(metaGray(SEP));
    return true;
  }
  return false;
}

/**
 * Header and fixed section titles for local plan TTY.
 * @param {string} line
 * @param {'ok'|'warn'|'fail'} status
 * @returns {boolean} True if handled
 */
function emitLocalPlanHeadersAndTitles(line, status) {
  if (line.startsWith('System: ')) {
    logger.log(headerKeyValue('System:', line.slice('System: '.length)));
    return true;
  }
  if (line.startsWith('Run: ')) {
    logger.log(headerKeyValue('Run:', line.slice('Run: '.length)));
    return true;
  }
  if (line.startsWith('Status: ')) {
    logger.log(formatStatusKeyValue(status, statusGlyph(status)));
    return true;
  }
  const titles = [
    'Verdict:',
    'Summary:',
    'Data Quality:',
    'Deductions:',
    'Next actions:',
    'Impact:'
  ];
  if (titles.includes(line)) {
    logger.log(sectionTitle(line));
    return true;
  }
  if (line === 'Other warnings:') {
    logger.log(chalk.yellow.bold('Other warnings:'));
    return true;
  }
  return false;
}

/**
 * Failure body, readiness, bullets, default for local plan TTY.
 * @param {string} line
 * @param {{ inFailuresSection: boolean }} state
 */
function emitLocalPlanBodyLine(line, state) {
  if (state.inFailuresSection && line.startsWith('- ')) {
    logger.log(chalk.red(line));
    return;
  }
  if (state.inFailuresSection && !line.startsWith('- ') && line.endsWith(':')) {
    logger.log(chalk.red.bold(line));
    return;
  }
  if (line.startsWith('Readiness: ')) {
    const rest = line.slice('Readiness: '.length);
    logger.log(`${chalk.gray('Readiness:')} ${colorRollupPrefixedLine(rest)}`);
    return;
  }
  if (emitLocalPlanGlyphCheckboxOrMeta(line)) return;
  logger.log(chalk.white(line));
}

/**
 * @param {string} line
 * @returns {boolean} true if handled
 */
function emitLocalPlanGlyphCheckboxOrMeta(line) {
  const t = line.trimStart();
  if (t.startsWith('✔') || t.startsWith('⚠') || t.startsWith('✖')) {
    logger.log(colorRollupPrefixedLine(line));
    return true;
  }
  if (line.startsWith('- [') || (line.startsWith('- ') && line.includes('[') && line.includes(']'))) {
    logger.log(chalk.red(line));
    return true;
  }
  if (line.startsWith('- ')) {
    logger.log(metaGray(line));
    return true;
  }
  return false;
}

/**
 * @param {string[]} lines
 * @param {'ok'|'warn'|'fail'} status
 */
function emitColoredLocalPlanLines(lines, status) {
  const state = { inFailuresSection: false };
  for (const line of lines) {
    if (emitLocalPlanFailuresAndSeparators(line, state)) continue;
    if (emitLocalPlanHeadersAndTitles(line, status)) continue;
    emitLocalPlanBodyLine(line, state);
  }
}

/**
 * @param {Object} results
 * @param {boolean} verbose
 * @param {string} appName
 */
function displayLocalExternalTestPlanLayout(results, verbose, appName) {
  const status = deriveRootStatus(results);
  emitColoredLocalPlanLines(buildLocalExternalPlanLines(results, appName), status);
  if (verbose) {
    displayVerboseInventory(results);
  }
}

function logVerboseSystemRows(systemResults) {
  for (const s of systemResults || []) {
    const ok = s.valid;
    logger.log(ok ? chalk.green(`  ✔ ${s.file}`) : chalk.red(`  ✖ ${s.file}`));
    (s.errors || []).forEach(e => logger.log(chalk.red(`    - ${e}`)));
  }
}

function logVerboseDatasourceRows(datasourceResults) {
  for (const d of datasourceResults || []) {
    const ok = d.valid;
    logger.log(ok ? chalk.green(`  ✔ ${d.key} (${d.file})`) : chalk.red(`  ✖ ${d.key} (${d.file})`));
    (d.errors || []).forEach(e => logger.log(chalk.red(`    - ${e}`)));
    (d.warnings || []).forEach(w => logger.log(chalk.yellow(`    ⚠ ${w}`)));
    if (d.fieldMappingResults && d.fieldMappingResults.mappedFields) {
      logger.log(chalk.gray(`    Field mappings: ${Object.keys(d.fieldMappingResults.mappedFields).length} fields`));
    }
    if (d.metadataSchemaResults) {
      const mOk = d.metadataSchemaResults.valid;
      logger.log(mOk ? chalk.gray('    Metadata schema: ✔ Valid') : chalk.red('    Metadata schema: ✖ Invalid'));
    }
  }
}

function logVerboseTopLevelMessages(errors, warnings) {
  if ((errors || []).length > 0) {
    logger.log(chalk.red('\nTop-level errors:'));
    errors.forEach(err => logger.log(chalk.red(`  - ${err}`)));
  }
  if ((warnings || []).length > 0) {
    logger.log(chalk.yellow('\nTop-level warnings:'));
    warnings.forEach(warn => logger.log(chalk.yellow(`  - ${warn}`)));
  }
}

/**
 * @param {Object} results
 */
function displayVerboseInventory(results) {
  logger.log('');
  logger.log(chalk.gray(SEP));
  logger.log(chalk.gray('Verbose — file inventory'));
  logVerboseSystemRows(results.systemResults);
  logVerboseDatasourceRows(results.datasourceResults);
  logVerboseTopLevelMessages(results.errors, results.warnings);
}

module.exports = {
  displayLocalExternalTestPlanLayout,
  deriveRootStatus,
  deriveDataQualityRollups
};
