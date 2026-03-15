/**
 * Log viewer for E2E and integration test logs - format and display JSON logs.
 * @fileoverview Read and format test-e2e / test-integration debug logs for terminal
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-statements, complexity, max-depth -- Formatter functions; display branches by design */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveAppKeyForDatasource } = require('./resolve-app');
const { getIntegrationPath } = require('../utils/paths');

/**
 * Get the path to the latest log file in a directory matching a glob-like pattern
 * @param {string} logsDir - Directory containing log files
 * @param {string} pattern - Prefix pattern (e.g. 'test-e2e' matches test-e2e-*.json)
 * @returns {Promise<string|null>} Full path to latest file or null if none
 */
async function getLatestLogPath(logsDir, pattern) {
  let entries;
  try {
    entries = await fs.readdir(logsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  const prefix = pattern.replace(/\*$/, '');
  const files = entries
    .filter(e => e.isFile() && e.name.startsWith(prefix) && e.name.endsWith('.json'))
    .map(e => path.join(logsDir, e.name));
  if (files.length === 0) return null;
  const withStats = await Promise.all(
    files.map(async f => ({ path: f, mtime: (await fs.stat(f)).mtimeMs }))
  );
  withStats.sort((a, b) => b.mtime - a.mtime);
  return withStats[0].path;
}

/**
 * Truncate string for display
 * @param {string} s - String
 * @param {number} maxLen - Max length
 * @returns {string}
 */
function truncate(s, maxLen = 60) {
  if (typeof s !== 'string') return String(s);
  return s.length <= maxLen ? s : `${s.slice(0, maxLen - 1)}…`;
}

/**
 * Format E2E log content for terminal display
 * @param {Object} data - Parsed log JSON (request, response, error)
 * @param {string} [fileName] - Log file name for header
 */
function formatE2ELog(data, fileName) {
  logger.log(chalk.blue('\n——— E2E Log') + (fileName ? chalk.gray(` ${fileName}`) : ''));
  const req = data.request || {};
  logger.log(chalk.cyan('Request:'));
  logger.log(chalk.gray(`  sourceIdOrKey: ${req.sourceIdOrKey ?? '—'}`));
  if (req.includeDebug !== undefined) logger.log(chalk.gray(`  includeDebug: ${req.includeDebug}`));
  if (req.cleanup !== undefined) logger.log(chalk.gray(`  cleanup: ${req.cleanup}`));
  if (req.primaryKeyValue !== undefined) logger.log(chalk.gray(`  primaryKeyValue: ${truncate(JSON.stringify(req.primaryKeyValue))}`));
  if (data.error) {
    logger.log(chalk.red('Error: ') + data.error);
    return;
  }
  const res = data.response || {};
  logger.log(chalk.cyan('Response:'));
  logger.log(chalk.gray(`  success: ${res.success}`));
  if (res.status) logger.log(chalk.gray(`  status: ${res.status}`));
  if (res.error) logger.log(chalk.red(`  error: ${res.error}`));
  const steps = res.steps || res.completedActions || [];
  if (steps.length > 0) {
    logger.log(chalk.cyan('Steps:'));
    for (const step of steps) {
      const name = step.name || step.step || 'unknown';
      const ok = step.success !== false && !step.error;
      logger.log(`  ${ok ? chalk.green('✓') : chalk.red('✗')} ${name}`);
      if (step.error) logger.log(chalk.red(`    ${step.error}`));
      if (step.message && ok) logger.log(chalk.gray(`    ${step.message}`));
      if ((name === 'sync' || step.step === 'sync') && step.evidence && step.evidence.jobs) {
        for (const job of step.evidence.jobs) {
          const audit = job.audit || {};
          const parts = [];
          if (job.recordsProcessed !== undefined && job.recordsProcessed !== null) parts.push(`${job.recordsProcessed} processed`);
          if (job.totalRecords !== undefined && job.totalRecords !== null) parts.push(`total: ${job.totalRecords}`);
          if (audit.inserted !== undefined && audit.inserted !== null || audit.updated !== undefined && audit.updated !== null || audit.deleted !== undefined && audit.deleted !== null) {
            parts.push(`(inserted: ${audit.inserted ?? 0}, updated: ${audit.updated ?? 0}, deleted: ${audit.deleted ?? 0})`);
          }
          if (parts.length) logger.log(chalk.gray(`    Job: ${parts.join(' ')}`));
        }
      }
    }
  }
  if (res.auditLog && Array.isArray(res.auditLog) && res.auditLog.length > 0) {
    logger.log(chalk.cyan('CIP execution trace(s): ') + chalk.gray(`${res.auditLog.length}`));
    const baseUrl = (req.dataplaneUrl || '').toString().replace(/\/$/, '');
    const sourceIdOrKey = req.sourceIdOrKey || '';
    res.auditLog.slice(0, 3).forEach((trace, i) => {
      const id = trace.executionId || trace.id || trace.traceId;
      if (id) {
        const idStr = String(id);
        logger.log(chalk.gray(`  ${i + 1}. executionId: ${idStr}`));
        if (baseUrl && sourceIdOrKey) {
          const executionUrl = `${baseUrl}/api/v1/external/${sourceIdOrKey}/executions/${idStr}`;
          logger.log(chalk.gray(`      Link: ${executionUrl}`));
        }
      }
    });
  }
}

/**
 * Format integration test log content for terminal display
 * @param {Object} data - Parsed log JSON
 * @param {string} [fileName] - Log file name for header
 */
function formatIntegrationLog(data, fileName) {
  logger.log(chalk.blue('\n——— Integration Log') + (fileName ? chalk.gray(` ${fileName}`) : ''));
  const req = data.request || {};
  logger.log(chalk.cyan('Request:'));
  logger.log(chalk.gray(`  systemKey: ${req.systemKey ?? '—'}, datasourceKey: ${req.datasourceKey ?? '—'}`));
  if (req.includeDebug !== undefined) logger.log(chalk.gray(`  includeDebug: ${req.includeDebug}`));
  if (data.error) {
    logger.log(chalk.red('Error: ') + data.error);
    return;
  }
  const res = data.response || {};
  logger.log(chalk.cyan('Response:'));
  logger.log(chalk.gray(`  success: ${res.success}`));
  if (res.error) logger.log(chalk.red(`  error: ${res.error}`));
  const vr = res.validationResults || {};
  logger.log(chalk.cyan('Validation:'));
  logger.log(chalk.gray(`  isValid: ${vr.isValid}`));
  if (vr.errors && vr.errors.length) vr.errors.forEach(e => logger.log(chalk.red(`    - ${e}`)));
  const fmr = res.fieldMappingResults || {};
  if (Object.keys(fmr).length) {
    logger.log(chalk.cyan('Field mapping:'));
    logger.log(chalk.gray(`  mappingCount: ${fmr.mappingCount ?? '—'}`));
    if (fmr.dimensions) logger.log(chalk.gray(`  dimensions: ${Object.keys(fmr.dimensions).join(', ')}`));
  }
  const etr = res.endpointTestResults || {};
  if (Object.keys(etr).length) {
    logger.log(chalk.cyan('Endpoint:'));
    logger.log(chalk.gray(`  endpointConfigured: ${etr.endpointConfigured}`));
  }
  if (res.normalizedOutput || res.normalizedMetadata) {
    const out = res.normalizedOutput || res.normalizedMetadata;
    const keys = typeof out === 'object' && out !== null ? Object.keys(out) : [];
    logger.log(chalk.cyan('Normalized output: ') + chalk.gray(keys.length ? `${keys.length} fields` : '—'));
  }
}

/**
 * Format log content by type
 * @param {Object} parsed - Parsed JSON log
 * @param {'test-e2e'|'test-integration'} logType - Log type
 * @param {string} [fileName] - File name for header
 */
function formatLogContent(parsed, logType, fileName) {
  if (logType === 'test-e2e') {
    formatE2ELog(parsed, fileName);
  } else {
    formatIntegrationLog(parsed, fileName);
  }
}

/**
 * Run log viewer: resolve log file, read, parse, format and print
 * @async
 * @param {string} datasourceKey - Datasource key (used when no --file)
 * @param {Object} options - Options
 * @param {string} [options.app] - App key (optional, resolved from key if omitted)
 * @param {string} [options.file] - Path to log file (overrides app resolution)
 * @param {'test-e2e'|'test-integration'} options.logType - Log type
 * @throws {Error} When file not found or invalid JSON
 */
/* eslint-disable-next-line max-statements -- Resolve path, read, parse, format */
async function runLogViewer(datasourceKey, options) {
  const { app, file, logType } = options;
  let logPath;
  let fileName;
  if (file && typeof file === 'string' && file.trim()) {
    logPath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file.trim());
    fileName = path.basename(logPath);
  } else {
    if (!datasourceKey || typeof datasourceKey !== 'string') {
      throw new Error('Datasource key is required when --file is not provided');
    }
    const { appKey } = await resolveAppKeyForDatasource(datasourceKey.trim(), app);
    const appPath = getIntegrationPath(appKey);
    const logsDir = path.join(appPath, 'logs');
    const pattern = logType === 'test-e2e' ? 'test-e2e-' : 'test-integration-';
    logPath = await getLatestLogPath(logsDir, pattern);
    if (!logPath) {
      throw new Error(
        `No ${logType} log found in ${logsDir}. Run the test with --debug first.`
      );
    }
    fileName = path.basename(logPath);
  }
  const content = await fs.readFile(logPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`Invalid JSON in ${logPath}: ${err.message}`);
  }
  formatLogContent(parsed, logType, fileName);
}

module.exports = {
  getLatestLogPath,
  formatLogContent,
  formatE2ELog,
  formatIntegrationLog,
  runLogViewer
};
