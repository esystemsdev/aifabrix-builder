/**
 * Batch datasource file repair during external integration repair.
 *
 * @fileoverview Run repairDatasourceFile across integration datasource files
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');
const { backupIntegrationFile } = require('../utils/integration-file-backup');
const { trackRepairWrite } = require('./repair-changed-files');
const { repairDatasourceFile } = require('./repair-datasource');

/**
 * @param {string} appPath
 * @param {string[]} datasourceFiles
 * @param {Object} options
 * @param {boolean} dryRun
 * @param {string[]} changes
 * @returns {boolean}
 */
function runDatasourceRepairs(appPath, datasourceFiles, options, dryRun, changes) {
  if (!datasourceFiles || datasourceFiles.length === 0) return false;
  let updated = false;
  for (const fileName of datasourceFiles) {
    const filePath = path.join(appPath, fileName);
    if (!fs.existsSync(filePath)) continue;
    try {
      const parsed = loadConfigFile(filePath);
      const { updated: fileUpdated, changes: fileChanges } = repairDatasourceFile(parsed, {
        expose: options.expose,
        sync: options.sync,
        test: options.test
      });
      if (fileUpdated) {
        updated = true;
        fileChanges.forEach(c => changes.push(`${fileName}: ${c}`));
        if (!dryRun) {
          backupIntegrationFile(filePath, options.backupCtx);
          writeConfigFile(filePath, parsed);
        }
        trackRepairWrite(filePath, options.backupCtx);
      }
    } catch (err) {
      logger.log(chalk.yellow(`⚠ Could not repair datasource ${fileName}: ${err.message}`));
    }
  }
  return updated;
}

module.exports = {
  runDatasourceRepairs
};
