/**
 * @fileoverview Exit codes for protection validate reports.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {Object} report
 * @returns {Object[]}
 */
function reportTaskRows(report) {
  if (!report || typeof report !== 'object') {
    return [];
  }
  if (Array.isArray(report.results)) {
    return report.results;
  }
  if (Array.isArray(report.tasks)) {
    return report.tasks;
  }
  return [];
}

/**
 * @param {Object} report
 * @param {Object} [opts]
 * @param {boolean} [opts.warningsAsErrors]
 * @returns {number} 0 ok, 1 fail/warn-as-error, 3 invalid input
 */
function exitCodeFromProtectionReport(report, opts = {}) {
  if (!report || typeof report !== 'object') {
    return 3;
  }
  const summary = report.summary || {};
  const failCount = Number(summary.fail || 0);
  const warnCount = Number(summary.warn || 0);
  if (failCount > 0) {
    return 1;
  }
  if (opts.warningsAsErrors === true && warnCount > 0) {
    return 1;
  }
  const rows = reportTaskRows(report);
  const hasFail = rows.some((r) => String(r?.status || '').toUpperCase() === 'FAIL');
  if (hasFail) {
    return 1;
  }
  if (opts.warningsAsErrors === true) {
    const hasWarn = rows.some((r) => String(r?.status || '').toUpperCase() === 'WARN');
    if (hasWarn) {
      return 1;
    }
  }
  return 0;
}

module.exports = {
  reportTaskRows,
  exitCodeFromProtectionReport
};
