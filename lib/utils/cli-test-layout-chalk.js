/**
 * @fileoverview Chalk helpers aligned with `.cursor/plans/layout.md` (CLI test / validation TTY).
 */

'use strict';

const chalk = require('chalk');

/**
 * Bold white section title (layout: Section).
 * @param {string} text
 * @returns {string}
 */
function sectionTitle(text) {
  return chalk.white.bold(text);
}

/**
 * Gray label + bold white value (layout: HEADER BLOCK).
 * @param {string} label - e.g. "System:"
 * @param {string} value
 * @returns {string}
 */
function headerKeyValue(label, value) {
  return `${chalk.gray(label)} ${chalk.white.bold(value)}`;
}

/**
 * Info line (cyan ℹ / neutral progress).
 * @param {string} text
 * @returns {string}
 */
function infoLine(text) {
  return chalk.cyan(text);
}

/**
 * Metadata (URLs, hints).
 * @param {string} text
 * @returns {string}
 */
function metadata(text) {
  return chalk.gray(text);
}

/**
 * @param {'ok'|'warn'|'fail'|'skipped'} agg
 * @returns {string} Uppercase status word for header
 */
function aggregateStatusWord(agg) {
  if (agg === 'warn') return 'WARN';
  if (agg === 'fail') return 'FAIL';
  if (agg === 'skipped') return 'SKIPPED';
  return 'OK';
}

/**
 * Colored glyph from aggregate status.
 * @param {'ok'|'warn'|'fail'|'skipped'} agg
 * @param {string} glyph - unicode ✔ ⚠ ✖ ⏭
 * @returns {string}
 */
function colorAggregateGlyph(agg, glyph) {
  if (agg === 'ok') return chalk.green(glyph);
  if (agg === 'warn') return chalk.yellow(glyph);
  if (agg === 'fail') return chalk.red(glyph);
  return chalk.gray(glyph);
}

/**
 * Full "Status: ✔ OK" line (glyph + word same color family).
 * @param {'ok'|'warn'|'fail'|'skipped'} agg
 * @param {string} glyph
 * @returns {string}
 */
function formatStatusKeyValue(agg, glyph) {
  const g = colorAggregateGlyph(agg, glyph);
  const w = aggregateStatusWord(agg);
  const word =
    agg === 'ok'
      ? chalk.green(w)
      : agg === 'warn'
        ? chalk.yellow(w)
        : agg === 'fail'
          ? chalk.red(w)
          : chalk.gray(w);
  return `${chalk.gray('Status:')} ${g} ${word}`;
}

/**
 * Datasource list row (layout §5): symbol + name (white) + status hint (gray).
 * @param {'ok'|'warn'|'fail'|'skipped'} rowStatus
 * @param {string} name
 * @param {string} [statusHint] - e.g. "Ready", shown in gray parens
 * @returns {string}
 */
function formatDatasourceListRow(rowStatus, name, statusHint) {
  const sym =
    rowStatus === 'ok'
      ? chalk.green('✔')
      : rowStatus === 'warn'
        ? chalk.yellow('⚠')
        : rowStatus === 'fail'
          ? chalk.red('✖')
          : chalk.gray('⏭');
  const hint = statusHint ? ` ${chalk.gray(`(${statusHint})`)}` : '';
  return `  ${sym} ${chalk.white(name)}${hint}`;
}

/**
 * Footer line for all-pass / warn / fail.
 * @param {boolean} success
 * @param {'ok'|'warn'|'fail'} [agg]
 * @param {string} okMsg
 * @param {string} warnMsg
 * @param {string} failMsg
 * @returns {string}
 */
function integrationFooterLine(success, agg, okMsg, warnMsg, failMsg) {
  if (success && agg === 'warn') {
    return chalk.yellow(`\n⚠ ${warnMsg}`);
  }
  if (success) {
    return chalk.green(`\n✔ ${okMsg}`);
  }
  return chalk.red(`\n✖ ${failMsg}`);
}

/**
 * Color a single data-quality / rollup line that starts with ✔, ⚠, or ✖.
 * @param {string} line
 * @returns {string}
 */
function colorRollupPrefixedLine(line) {
  const trimmed = line.trimStart();
  const first = trimmed[0];
  if (first === '✔') {
    return chalk.green('✔') + chalk.white(trimmed.slice(1));
  }
  if (first === '⚠') {
    return chalk.yellow('⚠') + chalk.white(trimmed.slice(1));
  }
  if (first === '✖') {
    return chalk.red('✖') + chalk.white(trimmed.slice(1));
  }
  return line;
}

module.exports = {
  sectionTitle,
  headerKeyValue,
  infoLine,
  metadata,
  aggregateStatusWord,
  colorAggregateGlyph,
  formatStatusKeyValue,
  formatDatasourceListRow,
  integrationFooterLine,
  colorRollupPrefixedLine
};
