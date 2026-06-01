/**
 * @fileoverview Debug log writer for agent trust CLI runs (plan 143).
 */

'use strict';

const chalk = require('chalk');
const path = require('path');
const logger = require('../utils/logger');
const { getIntegrationPath } = require('../utils/paths');
const { writeTestLog } = require('../utils/test-log-writer');

/**
 * @async
 * @param {string} appKey - Integration folder key
 * @param {string} datasourceKey
 * @param {Object} payload
 * @returns {Promise<string|null>} Log path or null when skipped
 */
async function writeTrustDebugLog(appKey, datasourceKey, payload) {
  const logPath = await writeTestLog(
    appKey,
    payload,
    `verify-trust-${datasourceKey}`,
    path.dirname(getIntegrationPath(appKey))
  );
  return logPath;
}

/**
 * @async
 * @param {string} appKey
 * @param {string} datasourceKey
 * @param {Object} payload
 */
async function writeTrustDebugLogAndPrint(appKey, datasourceKey, payload) {
  const logPath = await writeTrustDebugLog(appKey, datasourceKey, payload);
  logger.log(chalk.gray(`  Debug log: ${logPath}`));
  return logPath;
}

module.exports = {
  writeTrustDebugLog,
  writeTrustDebugLogAndPrint
};
