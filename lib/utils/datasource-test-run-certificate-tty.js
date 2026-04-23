/**
 * @fileoverview Certificate / certification tier lines for DatasourceTestRun TTY output.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const { sectionTitle } = require('./cli-test-layout-chalk');

function trimCertificateField(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function certificateEnvelopeGlyph(statusRaw) {
  if (statusRaw === 'passed') return '✔';
  if (statusRaw === 'not_passed') return '✖';
  return statusRaw ? '⚠' : ' ';
}

function certificateTTYHasContent(levelRaw, stRaw, summaryRaw, blockerCount) {
  return Boolean(levelRaw || stRaw || summaryRaw || blockerCount > 0);
}

/**
 * @param {string[]} lines
 * @param {string} stRaw
 * @param {string} levelRaw
 * @param {string} summaryRaw
 */
function appendCertificateStatusAndSummaryLines(lines, stRaw, levelRaw, summaryRaw) {
  if (stRaw || levelRaw) {
    const cg = certificateEnvelopeGlyph(stRaw);
    const tier = levelRaw ? ` — tier ${levelRaw}` : '';
    lines.push(chalk.white(`  ${cg} ${stRaw || 'unknown'}${tier}`));
  }
  if (summaryRaw) {
    lines.push(chalk.gray(`  ${summaryRaw}`));
  }
}

/**
 * @param {string[]} lines
 * @param {Object[]} blockers
 * @param {number} maxVisible
 */
function appendCertificateBlockerLines(lines, blockers, maxVisible) {
  const cap = Math.min(maxVisible, blockers.length);
  for (let i = 0; i < cap; i += 1) {
    const b = blockers[i];
    const msg = b && b.message ? String(b.message) : '';
    if (msg) lines.push(chalk.yellow(`  • ${msg}`));
  }
  if (blockers.length > cap) {
    lines.push(chalk.gray(`  … and ${blockers.length - cap} more`));
  }
}

/**
 * Certification / certificate tier (integration engine or E2E envelope after active cert attach).
 * @param {string[]} lines
 * @param {Object} envelope
 */
function appendCertificateTTY(lines, envelope) {
  const cert = envelope && envelope.certificate;
  if (!cert || typeof cert !== 'object') return;
  const levelRaw = trimCertificateField(cert.level);
  const stRaw = trimCertificateField(cert.status);
  const summaryRaw = trimCertificateField(cert.summary);
  const blockers = Array.isArray(cert.blockers) ? cert.blockers : [];
  if (!certificateTTYHasContent(levelRaw, stRaw, summaryRaw, blockers.length)) return;
  lines.push('');
  lines.push(sectionTitle('Certification:'));
  appendCertificateStatusAndSummaryLines(lines, stRaw, levelRaw, summaryRaw);
  appendCertificateBlockerLines(lines, blockers, 5);
}

module.exports = {
  appendCertificateTTY
};
