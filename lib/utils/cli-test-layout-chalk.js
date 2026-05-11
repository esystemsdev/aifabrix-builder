/**
 * @fileoverview Chalk helpers aligned with `.cursor/plans/layout.md` (CLI TTY / validation summaries).
 * @see `.cursor/plans/layout.md` — Contributor appendix for glyph rules and the implementation map.
 */

'use strict';

const chalk = require('chalk');

/**
 * Invoke chalk[method](text) when the mock/real chalk exposes that method; otherwise return text.
 * Keeps layout helpers working in Jest suites that only stub a subset of chalk.
 * @param {string} method - chalk method name (e.g. 'white', 'bold', 'gray')
 * @param {string} text
 * @returns {string}
 */
function chalkStyle(method, text) {
  const fn = chalk[method];
  return typeof fn === 'function' ? fn(text) : text;
}

/** Canonical success glyph (green), layout §CORE / §3. */
function successGlyph() {
  return chalk.green('✔');
}

/** Failure glyph only (red), layout §18 — compose with other chalk segments if needed. */
function failureGlyph() {
  return chalk.red('✖');
}

/**
 * Single-line success message: green ✔ + green rest (layout §CORE).
 * @param {string} message - text after the ✔ (no leading space)
 * @returns {string}
 */
function formatSuccessLine(message) {
  return chalk.green(`✔ ${message}`);
}

/**
 * Success line with leading newline (common for footers / deploy summaries).
 * @param {string} message
 * @returns {string}
 */
function formatSuccessParagraph(message) {
  return chalk.green(`\n✔ ${message}`);
}

/**
 * Non-blocking warning (layout §CORE): yellow ⚠ + white detail.
 * @param {string} message - text after the glyph (do not prefix with ⚠)
 * @returns {string}
 */
function formatWarningLine(message) {
  return `${chalkStyle('yellow', '⚠')} ${chalkStyle('white', message)}`;
}

/**
 * Blocking error line: red ✖ + red message (layout §18).
 * @param {string} message
 * @returns {string}
 */
function formatBlockingError(message) {
  return `${chalk.red('✖')} ${chalk.red(message)}`;
}

/**
 * Failure with optional hint (layout §7).
 * @param {string} title - main error text (red)
 * @param {string} [hint] - optional hint (gray "Hint:" + yellow text)
 * @returns {string}
 */
function formatIssue(title, hint) {
  const head = `${chalk.red('✖')} ${chalk.red(title)}`;
  if (!hint) {
    return head;
  }
  return `${head}\n  ${chalk.gray('Hint:')} ${chalk.yellow(hint)}`;
}

/**
 * Next actions list (layout §19): bold title, cyan bullets, white lines.
 * @param {string[]} lines - action text without leading "-"
 * @returns {string}
 */
function formatNextActions(lines) {
  const body = (lines || [])
    .map(line => `${chalkStyle('cyan', '-')} ${chalkStyle('white', line)}`)
    .join('\n');
  return `${sectionTitle('Next actions:')}\n${body}`;
}

/**
 * Docs / link line (layout §14): gray label, cyan URL.
 * @param {string} label - e.g. "Docs:" or "Docs"
 * @param {string} url
 * @returns {string}
 */
function formatDocsLine(label, url) {
  const lbl = label.endsWith(':') ? label : `${label}:`;
  return `${chalk.gray(lbl)} ${chalk.cyan(url)}`;
}

/**
 * Progress / async (layout §15): yellow ⏳ + white message.
 * @param {string} message
 * @returns {string}
 */
function formatProgress(message) {
  return `${chalkStyle('yellow', '⏳')} ${chalkStyle('white', message)}`;
}

/**
 * Section title + bullet list (layout §3, §9 impact-style).
 * @param {string} title
 * @param {string[]} items - lines without bullet prefix
 * @param {{ bullet?: 'cyan'|'red' }} [opts]
 * @returns {string}
 */
function formatBulletSection(title, items, opts) {
  const bulletColor = opts && opts.bullet === 'red' ? chalk.red : chalk.cyan;
  const body = (items || []).map(line => `${bulletColor('-')} ${chalkStyle('white', line)}`).join('\n');
  return `${sectionTitle(title)}\n${body}`;
}

/**
 * Bold white section title (layout: Section).
 * @param {string} text
 * @returns {string}
 */
function sectionTitle(text) {
  return chalkStyle('bold', chalkStyle('white', text));
}

/**
 * Gray label + bold white value (layout: HEADER BLOCK).
 * @param {string} label - e.g. "System:"
 * @param {string} value
 * @returns {string}
 */
function headerKeyValue(label, value) {
  return `${chalkStyle('gray', label)} ${chalkStyle('bold', chalkStyle('white', value))}`;
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
  return `  ${sym} ${chalkStyle('white', name)}${hint}`;
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
    return formatSuccessParagraph(okMsg);
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
    return chalk.green('✔') + chalkStyle('white', trimmed.slice(1));
  }
  if (first === '⚠') {
    return chalk.yellow('⚠') + chalkStyle('white', trimmed.slice(1));
  }
  if (first === '✖') {
    return chalk.red('✖') + chalkStyle('white', trimmed.slice(1));
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
  colorRollupPrefixedLine,
  successGlyph,
  failureGlyph,
  formatSuccessLine,
  formatSuccessParagraph,
  formatWarningLine,
  formatBlockingError,
  formatIssue,
  formatNextActions,
  formatDocsLine,
  formatProgress,
  formatBulletSection
};
