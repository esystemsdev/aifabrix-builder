/**
 * @fileoverview Spinner + elapsed time for datasource load/export (plan 144)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');
const { formatProgress } = require('./cli-test-layout-chalk');

/**
 * @param {number} ms
 * @returns {string}
 */
function formatElapsedMs(ms) {
  const n = Math.max(0, Math.round(Number(ms) || 0));
  if (n < 1000) {
    return `${n} ms`;
  }
  if (n < 60000) {
    const sec = n / 1000;
    return sec >= 10 ? `${Math.round(sec)} s` : `${sec.toFixed(1)} s`;
  }
  const min = Math.floor(n / 60000);
  const sec = Math.round((n % 60000) / 1000);
  return sec > 0 ? `${min} m ${sec} s` : `${min} m`;
}

/**
 * @param {Object} [options]
 * @param {boolean} [options.json]
 * @returns {boolean}
 */
function shouldShowDatasourceLoadExportProgress(options = {}) {
  return options.json !== true;
}

/**
 * @param {Object} [options]
 * @returns {boolean}
 */
function shouldUseDatasourceLoadExportSpinner(options = {}) {
  if (!shouldShowDatasourceLoadExportProgress(options)) {
    return false;
  }
  return Boolean(process && process.stdout && process.stdout.isTTY);
}

/**
 * @param {string} operation
 * @param {string} datasourceKey
 * @returns {string}
 */
function buildDatasourceLoadExportSpinnerLabel(operation, datasourceKey) {
  const key =
    datasourceKey && String(datasourceKey).trim() ? String(datasourceKey).trim() : 'datasource';
  if (operation === 'export') {
    return `Exporting records for ${key}…`;
  }
  if (operation === 'load-dry-run') {
    return `Parsing records for ${key}…`;
  }
  return `Loading records for ${key} into dataplane…`;
}

/**
 * @param {string} operation
 * @param {string} datasourceKey
 * @returns {string}
 */
function buildDatasourceLoadExportProgressText(operation, datasourceKey) {
  return formatProgress(buildDatasourceLoadExportSpinnerLabel(operation, datasourceKey));
}

/**
 * @async
 * @param {Function} work
 * @param {Object} [opts]
 * @param {'load'|'load-dry-run'|'export'} [opts.operation]
 * @param {string} [opts.datasourceKey]
 * @param {boolean} [opts.json]
 * @returns {Promise<*>}
 */
async function runWithDatasourceLoadExportSpinner(work, opts = {}) {
  if (!shouldShowDatasourceLoadExportProgress(opts)) {
    return work();
  }

  const operation = opts.operation || 'load';
  const datasourceKey = opts.datasourceKey || '';

  if (!shouldUseDatasourceLoadExportSpinner(opts)) {
    logger.log(buildDatasourceLoadExportProgressText(operation, datasourceKey));
    return work();
  }

  const ora = require('ora');
  const label = buildDatasourceLoadExportSpinnerLabel(operation, datasourceKey);
  const spinner = ora({
    text: chalk.white(label),
    spinner: 'dots'
  }).start();

  try {
    return await work();
  } finally {
    spinner.stop();
  }
}

module.exports = {
  formatElapsedMs,
  shouldShowDatasourceLoadExportProgress,
  shouldUseDatasourceLoadExportSpinner,
  buildDatasourceLoadExportSpinnerLabel,
  buildDatasourceLoadExportProgressText,
  runWithDatasourceLoadExportSpinner
};
