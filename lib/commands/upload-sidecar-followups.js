/**
 * @fileoverview Upload sidecar follow-ups (governance packs, certification sync).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const { formatWarningLine } = require('../utils/cli-test-layout-chalk');
const { unwrapPublicationResult, isPublicationUnchanged } = require('../utils/external-system-readiness-core');
const { logUploadReadinessSummary } = require('../utils/external-system-readiness-display');
const { maybeSyncSystemCertificationFromDataplane } = require('../certification/sync-system-certification');
const { cliOptsSkipCertSync } = require('../certification/cli-cert-sync-skip');
const { isQuietMinimalSync } = require('../utils/upload-sync-options');

/**
 * Sidecar follow-ups that are independent of pipeline publish hash (scenario packs, cert sync).
 * @param {Object} ctx
 * @returns {Promise<void>}
 */
async function runUploadSidecarFollowups(ctx) {
  const { systemKey, options, payload, dataplaneUrl, authConfig } = ctx;
  const quietSidecar = isQuietMinimalSync(options);
  const dsKeys = (payload.dataSources || []).map((ds) => ds && ds.key).filter(Boolean);
  try {
    const { uploadGovernanceScenarioPacks } = require('../lifecycle/scenario-upload');
    await uploadGovernanceScenarioPacks(systemKey, dataplaneUrl, authConfig, { silent: quietSidecar });
  } catch (err) {
    if (!quietSidecar) {
      logger.log(formatWarningLine(`Governance scenario upload skipped: ${err.message}`));
    }
  }
  await maybeSyncSystemCertificationFromDataplane({
    label: 'upload',
    noCertSync: cliOptsSkipCertSync(options),
    systemKey,
    dataplaneUrl,
    authConfig,
    datasourceKeys: dsKeys,
    silent: quietSidecar
  });
}

/**
 * @param {Object} ctx
 * @param {Function} maybeRunUploadProbe
 * @returns {Promise<void>}
 */
async function handlePublicationAndFollowups(ctx, maybeRunUploadProbe) {
  const {
    systemKey,
    options,
    manifest,
    payload,
    environment,
    dataplaneUrl,
    authConfig,
    rawRes
  } = ctx;
  const publication = unwrapPublicationResult(rawRes);
  if (!publication) {
    throw new Error(
      'Unexpected response from dataplane upload: missing publication result (uploadId/system/datasources).'
    );
  }
  if (isPublicationUnchanged(publication)) {
    await runUploadSidecarFollowups({ systemKey, options, payload, dataplaneUrl, authConfig });
    return;
  }
  logUploadReadinessSummary({
    environment,
    dataplaneUrl,
    systemKey,
    publication,
    manifest,
    minimal: !!options.minimal,
    willProbe: !!options.probe
  });
  if (options.probe) {
    await maybeRunUploadProbe(dataplaneUrl, systemKey, authConfig, options.probeTimeout);
  }
  await runUploadSidecarFollowups({ systemKey, options, payload, dataplaneUrl, authConfig });
}

module.exports = {
  runUploadSidecarFollowups,
  handlePublicationAndFollowups
};
