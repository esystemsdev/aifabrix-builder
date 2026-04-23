/**
 * @fileoverview After successful unified datasource validation, optionally sync system certification.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { trySyncCertificationFromDataplaneForExternalApp } = require('./sync-after-external-command');
const { cliOptsSkipCertSync } = require('./cli-cert-sync-skip');

/**
 * @async
 * @param {number} exitCode
 * @param {string} datasourceKey
 * @param {Object} options - CLI flags (app, noCertSync)
 * @param {string} label - Log label
 * @returns {Promise<void>}
 */
async function afterUnifiedValidationCertSync(exitCode, datasourceKey, options, label) {
  if (exitCode !== 0 || cliOptsSkipCertSync(options)) return;
  try {
    const { resolveAppKeyForDatasource } = require('../datasource/resolve-app');
    const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
    await trySyncCertificationFromDataplaneForExternalApp(appKey, label);
  } catch (e) {
    logger.log(chalk.yellow(`⚠ Certification sync (${label}) skipped: ${e.message}`));
  }
}

module.exports = { afterUnifiedValidationCertSync };
