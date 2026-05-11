/**
 * Log viewer for E2E, integration, and structural (`datasource test`) debug logs.
 * @fileoverview Read and format saved JSON logs under integration/<app>/logs/
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-statements, complexity, max-depth -- Formatter functions; display branches by design */

const path = require('path');
// Use node:fs so suites that jest.mock('fs') do not break real-disk log resolution (structural tests, CI).
const fsp = require('node:fs').promises;
const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveAppKeyForDatasource } = require('./resolve-app');
const { getIntegrationPath } = require('../utils/paths');
const { sectionTitle, headerKeyValue, formatBlockingError, successGlyph, failureGlyph } = require('../utils/cli-test-layout-chalk');

/**
 * Get the path to the latest log file in a directory matching a glob-like pattern
 * @param {string} logsDir - Directory containing log files
 * @param {string} pattern - Prefix pattern (e.g. 'test-e2e' matches test-e2e-*.json)
 * @returns {Promise<string|null>} Full path to latest file or null if none
 */
async function getLatestLogPath(logsDir, pattern) {
  let entries;
  try {
    entries = await fsp.readdir(logsDir, { withFileTypes: true });
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
    files.map(async f => ({ path: f, mtime: (await fsp.stat(f)).mtimeMs }))
  );
  withStats.sort((a, b) => b.mtime - a.mtime);
  return withStats[0].path;
}

/**
 * Structural validation logs use prefix `test-` but must not pick up `test-e2e-` or `test-integration-`.
 * @param {string} name - File name only
 * @returns {boolean}
 */
function isStructuralTestLogFileName(name) {
  if (!name || typeof name !== 'string' || !name.endsWith('.json')) return false;
  if (name.startsWith('test-e2e-') || name.startsWith('test-integration-')) return false;
  return name.startsWith('test-');
}

/**
 * Latest structural `datasource test --debug` log in logsDir.
 * @param {string} logsDir
 * @returns {Promise<string|null>}
 */
async function getLatestStructuralTestLogPath(logsDir) {
  let entries;
  try {
    entries = await fsp.readdir(logsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  const names = entries
    .filter(e => e.isFile() && isStructuralTestLogFileName(e.name))
    .map(e => e.name);
  if (names.length === 0) return null;
  // Structural logs embed a sortable timestamp in the filename (`test-YYYY-...Z.json`).
  // Prefer lexicographic ordering to avoid filesystem timestamp resolution issues in CI.
  names.sort((a, b) => b.localeCompare(a));
  return path.join(logsDir, names[0]);
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
function logE2ERequestSection(data) {
  const req = data.request || {};
  logger.log('');
  logger.log(sectionTitle('Request:'));
  logger.log(headerKeyValue('sourceIdOrKey:', String(req.sourceIdOrKey ?? '—')));
  if (req.includeDebug !== undefined) logger.log(chalk.gray(`  includeDebug: ${req.includeDebug}`));
  if (req.cleanup !== undefined) logger.log(chalk.gray(`  cleanup: ${req.cleanup}`));
  if (req.primaryKeyValue !== undefined) {
    logger.log(chalk.gray(`  primaryKeyValue: ${truncate(JSON.stringify(req.primaryKeyValue))}`));
  }
  return req;
}

function logE2EStepsSection(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return;
  logger.log(sectionTitle('Steps:'));
  for (const step of steps) {
    const name = step.name || step.step || 'unknown';
    const ok = step.success !== false && !step.error;
    logger.log(`  ${ok ? successGlyph() : failureGlyph()} ${chalk.white(name)}`);
    if (step.error) logger.log(chalk.red(`    ${step.error}`));
    if (step.message && ok) logger.log(chalk.gray(`    ${step.message}`));
    if ((name === 'sync' || step.step === 'sync') && step.evidence && step.evidence.jobs) {
      for (const job of step.evidence.jobs) {
        const audit = job.audit || {};
        const parts = [];
        if (job.recordsProcessed !== undefined && job.recordsProcessed !== null) parts.push(`${job.recordsProcessed} processed`);
        if (job.totalRecords !== undefined && job.totalRecords !== null) parts.push(`total: ${job.totalRecords}`);
        if (
          (audit.inserted !== undefined && audit.inserted !== null) ||
          (audit.updated !== undefined && audit.updated !== null) ||
          (audit.deleted !== undefined && audit.deleted !== null)
        ) {
          parts.push(`(inserted: ${audit.inserted ?? 0}, updated: ${audit.updated ?? 0}, deleted: ${audit.deleted ?? 0})`);
        }
        if (parts.length) logger.log(chalk.gray(`    Job: ${parts.join(' ')}`));
      }
    }
  }
}

function logE2EAuditTraceSection(req, res) {
  if (!res.auditLog || !Array.isArray(res.auditLog) || res.auditLog.length === 0) return;
  logger.log('');
  logger.log(sectionTitle('CIP execution trace(s):'));
  logger.log(chalk.gray(`${res.auditLog.length}`));
  const baseUrl = (req.dataplaneUrl || '').toString().replace(/\/$/, '');
  const sourceIdOrKey = req.sourceIdOrKey || '';
  res.auditLog.slice(0, 3).forEach((trace, i) => {
    const id = trace.executionId || trace.id || trace.traceId;
    if (!id) return;
    const idStr = String(id);
    logger.log(chalk.gray(`  ${i + 1}. executionId: ${idStr}`));
    if (baseUrl && sourceIdOrKey) {
      const executionUrl = `${baseUrl}/api/v1/external/${sourceIdOrKey}/executions/${idStr}`;
      logger.log(chalk.gray(`      Link: ${executionUrl}`));
    }
  });
}

function logE2EResponseSection(req, data) {
  if (data.error) {
    logger.log(formatBlockingError(`Error: ${data.error}`));
    return;
  }
  const res = data.response || {};
  logger.log('');
  logger.log(sectionTitle('Response:'));
  logger.log(chalk.gray(`  success: ${res.success}`));
  if (res.status) logger.log(chalk.gray(`  status: ${res.status}`));
  if (res.error) logger.log(chalk.red(`  error: ${res.error}`));
  const steps = res.steps || res.completedActions || [];
  logE2EStepsSection(steps);
  logE2EAuditTraceSection(req, res);
}

function formatE2ELog(data, fileName) {
  logger.log('');
  logger.log(sectionTitle('E2E log'));
  if (fileName) logger.log(chalk.gray(fileName));
  const req = logE2ERequestSection(data);
  logE2EResponseSection(req, data);
}

/**
 * Format integration test log content for terminal display
 * @param {Object} data - Parsed log JSON
 * @param {string} [fileName] - Log file name for header
 */
function formatIntegrationLog(data, fileName) {
  logger.log('');
  logger.log(sectionTitle('Integration log'));
  if (fileName) logger.log(chalk.gray(fileName));
  const req = data.request || {};
  logger.log('');
  logger.log(sectionTitle('Request:'));
  logger.log(chalk.gray(`  systemKey: ${req.systemKey ?? '—'}, datasourceKey: ${req.datasourceKey ?? '—'}`));
  if (req.includeDebug !== undefined) logger.log(chalk.gray(`  includeDebug: ${req.includeDebug}`));
  if (data.error) {
    logger.log(formatBlockingError(`Error: ${data.error}`));
    return;
  }
  const res = data.response || {};
  logger.log('');
  logger.log(sectionTitle('Response:'));
  logger.log(chalk.gray(`  success: ${res.success}`));
  if (res.error) logger.log(chalk.red(`  error: ${res.error}`));
  const vr = res.validationResults || {};
  logger.log(sectionTitle('Validation:'));
  logger.log(chalk.gray(`  isValid: ${vr.isValid}`));
  if (vr.errors && vr.errors.length) vr.errors.forEach(e => logger.log(chalk.red(`    - ${e}`)));
  const fmr = res.fieldMappingResults || {};
  if (Object.keys(fmr).length) {
    logger.log(sectionTitle('Field mapping:'));
    logger.log(chalk.gray(`  mappingCount: ${fmr.mappingCount ?? '—'}`));
    if (fmr.dimensions) logger.log(chalk.gray(`  dimensions: ${Object.keys(fmr.dimensions).join(', ')}`));
  }
  const etr = res.endpointTestResults || {};
  if (Object.keys(etr).length) {
    logger.log(sectionTitle('Endpoint:'));
    logger.log(chalk.gray(`  endpointConfigured: ${etr.endpointConfigured}`));
  }
  if (res.normalizedOutput || res.normalizedMetadata) {
    const out = res.normalizedOutput || res.normalizedMetadata;
    const keys = typeof out === 'object' && out !== null ? Object.keys(out) : [];
    logger.log(sectionTitle('Normalized output:') + ' ' + chalk.gray(keys.length ? `${keys.length} fields` : '—'));
  }
}

function structuralEnvelopeStatusLine(status) {
  if (status === 'ok' || status === 'skipped') return `${successGlyph()} ${chalk.gray('status:')} ${status}`;
  if (status === 'warn') return `${chalk.yellow('⚠')} ${chalk.gray('status:')} ${status}`;
  if (status === 'fail') return `${failureGlyph()} ${chalk.gray('status:')} ${status}`;
  return `${chalk.gray('?')} ${chalk.gray('status:')} ${status ?? '—'}`;
}

/**
 * Format structural validation log (`datasource test --debug` → `test-*.json`).
 * @param {Object} data - Parsed JSON { request, response?, error? }
 * @param {string} [fileName] - Log file name for header
 */
function formatStructuralTestLog(data, fileName) {
  logger.log('');
  logger.log(sectionTitle('Structural validation log'));
  if (fileName) logger.log(chalk.gray(fileName));
  const req = data.request || {};
  logger.log('');
  logger.log(sectionTitle('Request:'));
  logger.log(headerKeyValue('datasourceKey:', String(req.datasourceKey ?? '—')));
  if (req.runType) logger.log(headerKeyValue('runType:', String(req.runType)));
  if (req.includeDebug !== undefined) {
    logger.log(chalk.gray(`  includeDebug: ${req.includeDebug}`));
  }
  if (data.error) {
    logger.log('');
    logger.log(formatBlockingError(`Error: ${data.error}`));
    return;
  }
  const res = data.response || {};
  logger.log('');
  logger.log(sectionTitle('Response (envelope):'));
  logger.log(`  ${structuralEnvelopeStatusLine(res.status)}`);
  if (res.reportCompleteness) {
    logger.log(chalk.gray(`  reportCompleteness: ${res.reportCompleteness}`));
  }
  if (res.runId) logger.log(chalk.gray(`  runId: ${res.runId}`));
  if (res.systemKey) logger.log(chalk.gray(`  systemKey: ${res.systemKey}`));
}

/**
 * Format log content by type
 * @param {Object} parsed - Parsed JSON log
 * @param {'test'|'test-e2e'|'test-integration'} logType - Log type
 * @param {string} [fileName] - File name for header
 */
function formatLogContent(parsed, logType, fileName) {
  if (logType === 'test') {
    formatStructuralTestLog(parsed, fileName);
    return;
  }
  if (logType === 'test-e2e') {
    formatE2ELog(parsed, fileName);
  } else {
    formatIntegrationLog(parsed, fileName);
  }
}

/**
 * Parse saved debug log JSON (strict). Always throws an Error whose message starts with
 * "Invalid JSON" so CLI/tests get a stable contract.
 * @param {string} content
 * @param {string} logPath
 * @returns {Object}
 */
function parseDatasourceLogJson(content, logPath) {
  if (content === undefined || content === null) {
    throw new Error(`Invalid JSON in ${logPath}: empty content`);
  }
  const text = String(content).replace(/^\uFEFF/, '').trim();
  if (!text) {
    throw new Error(`Invalid JSON in ${logPath}: empty file`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in ${logPath}: ${detail}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid JSON in ${logPath}: expected a JSON object at the root`);
  }
  return parsed;
}

/**
 * Run log viewer: resolve log file, read, parse, format and print
 * @async
 * @param {string} datasourceKey - Datasource key (used when no --file)
 * @param {Object} options - Options
 * @param {string} [options.app] - App key (optional, resolved from key if omitted)
 * @param {string} [options.file] - Path to log file (overrides app resolution)
 * @param {'test'|'test-e2e'|'test-integration'} options.logType - Log type
 * @throws {Error} When file not found or invalid JSON
 */
/* eslint-disable-next-line max-statements -- Resolve path, read, parse, format */
async function runLogViewer(datasourceKey, options) {
  const { app, file, logType } = options;
  let logPath;
  if (file && typeof file === 'string' && file.trim()) {
    logPath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file.trim());
  } else {
    if (!datasourceKey || typeof datasourceKey !== 'string') {
      throw new Error('Datasource key is required when --file is not provided');
    }
    const { appKey } = await resolveAppKeyForDatasource(datasourceKey.trim(), app);
    const appPath = getIntegrationPath(appKey);
    const logsDir = path.join(appPath, 'logs');
    if (logType === 'test') {
      logPath = await getLatestStructuralTestLogPath(logsDir);
      if (!logPath) {
        throw new Error(
          `No structural validation log found in ${logsDir}. Run: aifabrix datasource test <key> --debug`
        );
      }
    } else {
      const pattern = logType === 'test-e2e' ? 'test-e2e-' : 'test-integration-';
      logPath = await getLatestLogPath(logsDir, pattern);
      if (!logPath) {
        throw new Error(
          `No ${logType} log found in ${logsDir}. Run the test with --debug first.`
        );
      }
    }
  }
  const resolvedLogPath = path.resolve(logPath);
  const content = await fsp.readFile(logPath, 'utf8');
  const parsed = parseDatasourceLogJson(content, logPath);
  formatLogContent(parsed, logType, resolvedLogPath);
}

module.exports = {
  getLatestLogPath,
  getLatestStructuralTestLogPath,
  isStructuralTestLogFileName,
  formatLogContent,
  formatE2ELog,
  formatIntegrationLog,
  formatStructuralTestLog,
  parseDatasourceLogJson,
  runLogViewer
};
