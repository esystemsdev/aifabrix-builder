/**
 * @fileoverview Optional certification sync after external flows (validate, tests).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');

/**
 * After a successful external integration flow, refresh `certification` on the primary system file from dataplane.
 * Best-effort: skips non-external apps, missing Bearer token, or resolver errors (warn only).
 *
 * @async
 * @param {string} appKey - Integration / system key
 * @param {string} label - Short label for logs (e.g. "validate", "datasource test")
 * @param {Object} [extra] - Optional `{ issuanceFailureHint }` from last DatasourceTestRun.certificateIssuance (failed)
 * @returns {Promise<void>}
 */
async function trySyncCertificationFromDataplaneForExternalApp(appKey, label, extra = {}) {
  try {
    const { detectAppType } = require('../utils/paths');
    const t = await detectAppType(appKey).catch(() => null);
    if (!t || !t.isExternal) return;

    const { resolveDataplaneAndAuth, validateSystemKeyFormat } = require('../commands/upload');
    const { generateControllerManifest } = require('../generator/external-controller-manifest');
    const { maybeSyncSystemCertificationFromDataplane } = require('./sync-system-certification');

    validateSystemKeyFormat(appKey);
    const { dataplaneUrl, authConfig } = await resolveDataplaneAndAuth(appKey);
    if (!authConfig.token) {
      logger.log(chalk.gray(`Certification sync (${label}) skipped: no Bearer token (run aifabrix login).`));
      return;
    }
    const manifest = await generateControllerManifest(appKey, { type: 'external' });
    const dsKeys = (manifest.dataSources || []).map((ds) => ds && ds.key).filter(Boolean);
    await maybeSyncSystemCertificationFromDataplane({
      label,
      noCertSync: false,
      systemKey: manifest.key,
      dataplaneUrl,
      authConfig,
      datasourceKeys: dsKeys,
      issuanceFailureHint: extra && extra.issuanceFailureHint ? String(extra.issuanceFailureHint).trim() : null
    });
  } catch (e) {
    logger.log(chalk.yellow(`⚠ Certification sync (${label}) skipped: ${e.message}`));
  }
}

module.exports = { trySyncCertificationFromDataplaneForExternalApp };
