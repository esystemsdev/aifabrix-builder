/**
 * Remove saved datasource test debug JSON under integration/<app>/logs/.
 * @fileoverview Local cleanup for test / test-integration / test-e2e / test-trust logs
 * @author AI Fabrix Team
 * @version 1.0.0
 */

const path = require('path');
const fsp = require('node:fs').promises;
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getIntegrationPath, listIntegrationAppNames } = require('../utils/paths');
const { isStructuralTestLogFileName } = require('./log-viewer');
const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');

/** @type {readonly string[]} */
const LOG_CLEAN_TYPES = ['test', 'integration', 'e2e', 'trust', 'all'];

/**
 * @param {string} [type]
 * @returns {'test'|'integration'|'e2e'|'trust'|'all'}
 */
function normalizeLogCleanType(type) {
  const raw = (type === undefined || type === null ? 'all' : String(type)).trim().toLowerCase();
  if (raw === '' || raw === 'all') return 'all';
  if (LOG_CLEAN_TYPES.includes(raw)) return raw;
  throw new Error(
    `Invalid --type "${type}". Use: ${LOG_CLEAN_TYPES.join(', ')}`
  );
}

/**
 * @param {string} fileName
 * @param {'test'|'integration'|'e2e'|'trust'|'all'} type
 * @returns {boolean}
 */
function matchesLogCleanType(fileName, type) {
  if (!fileName || !fileName.endsWith('.json')) return false;
  if (type === 'all') return true;
  if (type === 'test') return isStructuralTestLogFileName(fileName);
  if (type === 'integration') {
    return fileName.startsWith('test-integration-');
  }
  if (type === 'e2e') return fileName.startsWith('test-e2e-');
  if (type === 'trust') return fileName.startsWith('test-trust-');
  return false;
}

/**
 * @param {string} logsDir
 * @param {'test'|'integration'|'e2e'|'trust'|'all'} type
 * @returns {Promise<string[]>}
 */
async function listMatchingLogFiles(logsDir, type) {
  let entries;
  try {
    entries = await fsp.readdir(logsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return entries
    .filter(e => e.isFile() && matchesLogCleanType(e.name, type))
    .map(e => path.join(logsDir, e.name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string} appKey
 * @returns {Promise<void>}
 */
async function assertIntegrationAppExists(appKey) {
  const appPath = getIntegrationPath(appKey);
  try {
    const st = await fsp.stat(appPath);
    if (!st.isDirectory()) {
      throw new Error(`Integration folder is not a directory: ${appPath}`);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Integration folder not found: ${appPath}`);
    }
    throw err;
  }
}

/**
 * @param {Object} options
 * @param {boolean} [options.all]
 * @param {string} [options.app]
 * @returns {Promise<string[]>}
 */
async function resolveTargetAppKeys(options) {
  const useAll = Boolean(options.all);
  const app = options.app && typeof options.app === 'string' ? options.app.trim() : '';
  if (useAll && app) {
    throw new Error('Use either --app <systemKey> or --all, not both');
  }
  if (!useAll && !app) {
    throw new Error('Specify --app <systemKey> or --all');
  }
  if (useAll) {
    return listIntegrationAppNames();
  }
  await assertIntegrationAppExists(app);
  return [app];
}

/**
 * @param {string[]} appKeys
 * @param {'test'|'integration'|'e2e'|'trust'|'all'} type
 * @returns {Promise<Array<{ appKey: string, logsDir: string, files: string[] }>>}
 */
async function collectLogFilesByApp(appKeys, type) {
  const groups = [];
  for (const appKey of appKeys) {
    const logsDir = path.join(getIntegrationPath(appKey), 'logs');
    const files = await listMatchingLogFiles(logsDir, type);
    if (files.length > 0) {
      groups.push({ appKey, logsDir, files });
    }
  }
  return groups;
}

/**
 * @param {Array<{ appKey: string, files: string[] }>} groups
 * @param {boolean} dryRun
 * @returns {Promise<{ removedCount: number, paths: string[] }>}
 */
async function removeCollectedFiles(groups, dryRun) {
  const paths = groups.flatMap(g => g.files);
  if (dryRun || paths.length === 0) {
    return { removedCount: 0, paths };
  }
  await Promise.all(paths.map(filePath => fsp.unlink(filePath)));
  return { removedCount: paths.length, paths };
}

/**
 * @param {Object} options
 * @param {boolean} options.dryRun
 * @param {'test'|'integration'|'e2e'|'trust'|'all'} options.type
 * @param {Array<{ appKey: string, files: string[] }>} groups
 * @param {number} removedCount
 */
function printCleanLogsSummary(options, groups, removedCount) {
  const totalFiles = groups.reduce((n, g) => n + g.files.length, 0);
  const appCount = groups.length;
  if (options.dryRun) {
    if (totalFiles === 0) {
      logger.log(chalk.gray('No matching log files found.'));
      return;
    }
    logger.log('');
    logger.log(
      chalk.gray(
        `Would remove ${totalFiles} file(s) from ${appCount} integration folder(s) (type: ${options.type}).`
      )
    );
    return;
  }
  if (totalFiles === 0) {
    logger.log(chalk.gray('No matching log files to remove.'));
    return;
  }
  logger.log('');
  logger.log(formatSuccessLine(`Removed ${removedCount} log file(s) from ${appCount} integration folder(s).`));
}

/**
 * @param {boolean} dryRun
 * @param {Array<{ appKey: string, logsDir: string, files: string[] }>} groups
 */
function printCleanLogsFileList(dryRun, groups) {
  const prefix = dryRun ? 'Would remove' : 'Removing';
  for (const { appKey, files } of groups) {
    logger.log('');
    logger.log(chalk.bold.white(`${appKey}/logs/`));
    for (const filePath of files) {
      logger.log(chalk.gray(`  ${prefix}: ${filePath}`));
    }
  }
}

/**
 * @param {Object} result
 * @param {boolean} result.dryRun
 * @param {string} result.type
 * @param {string[]} result.appKeys
 * @param {string[]} result.paths
 * @param {number} result.removedCount
 */
function printCleanLogsJson(result) {
  const payload = {
    dryRun: result.dryRun,
    type: result.type,
    appKeys: result.appKeys,
    fileCount: result.paths.length,
    paths: result.paths,
    removedCount: result.removedCount
  };
  logger.log(JSON.stringify(payload, null, 2));
}

/**
 * @async
 * @param {Object} options
 * @param {boolean} [options.all]
 * @param {string} [options.app]
 * @param {string} [options.type]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.json]
 * @returns {Promise<{ dryRun: boolean, type: string, appKeys: string[], paths: string[], removedCount: number }>}
 */
async function runCleanLogs(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const json = Boolean(options.json);
  const type = normalizeLogCleanType(options.type);
  const appKeys = await resolveTargetAppKeys(options);
  const groups = await collectLogFilesByApp(appKeys, type);
  const { removedCount, paths } = await removeCollectedFiles(groups, dryRun);
  const result = { dryRun, type, appKeys, paths, removedCount };
  if (json) {
    printCleanLogsJson(result);
  } else {
    printCleanLogsFileList(dryRun, groups);
    printCleanLogsSummary({ dryRun, type }, groups, removedCount);
  }
  return result;
}

module.exports = {
  LOG_CLEAN_TYPES,
  normalizeLogCleanType,
  matchesLogCleanType,
  listMatchingLogFiles,
  resolveTargetAppKeys,
  collectLogFilesByApp,
  runCleanLogs
};
