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
 * @param {Object|null} [envelope] - Last DatasourceTestRun (optional); used for certificateIssuance failed hint
 * @returns {Promise<void>}
 */
async function afterUnifiedValidationCertSync(exitCode, datasourceKey, options, label, envelope = null) {
  if (exitCode !== 0 || cliOptsSkipCertSync(options)) return;
  try {
    const { resolveAppKeyForDatasource } = require('../datasource/resolve-app');
    const { appKey } = await resolveAppKeyForDatasource(datasourceKey, options.app);
    let issuanceFailureHint = null;
    if (envelope && envelope.certificateIssuance && envelope.certificateIssuance.status === 'failed') {
      const ci = envelope.certificateIssuance;
      issuanceFailureHint = [ci.reasonCode, ci.message].filter(Boolean).join(': ');
    }
    await trySyncCertificationFromDataplaneForExternalApp(appKey, label, { issuanceFailureHint });
  } catch (e) {
    logger.log(chalk.yellow(`⚠ Certification sync (${label}) skipped: ${e.message}`));
  }
}

module.exports = { afterUnifiedValidationCertSync };
