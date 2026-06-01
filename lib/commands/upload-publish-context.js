/**
 * @fileoverview Upload publish preflight: auth resolve, CLI gate, target logging.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const { sectionTitle, headerKeyValue } = require('../utils/cli-test-layout-chalk');
const { resolveControllerUrl } = require('../utils/controller-url');
const { requireBearerForDataplanePipeline } = require('../utils/token-manager');
const { logDataplanePipelineWarning } = require('../utils/dataplane-pipeline-warning');
const { assertDataplaneCliVersionCompatible } = require('../utils/dataplane-cli-version-gate');

const SEP = chalk.gray('────────────────────────────────────────');

function logForcePublishWarning() {
  logger.log(
    chalk.yellow(
      'Warning: --force bypasses active-datasource schema replacement guards on publish. '
        + 'Existing records and ABAC may be inconsistent; run validation/sync after upload.'
    )
  );
}

function logUploadTargetSection(environment, dataplaneUrl) {
  logger.log('');
  logger.log(sectionTitle('Target'));
  logger.log(SEP);
  logger.log(headerKeyValue('Environment:', environment));
  logger.log(headerKeyValue('Dataplane:', dataplaneUrl));
  logDataplanePipelineWarning();
}

/**
 * Resolve dataplane auth and run upload preflight checks.
 * @param {Function} resolveDataplaneAndAuth
 * @param {Function} maybeRunVerboseServerValidation
 * @param {string} systemKey
 * @param {Object} options
 * @param {Object} payload
 * @returns {Promise<{ dataplaneUrl: string, authConfig: Object, environment: string }>}
 */
async function resolveUploadPublishContext(
  resolveDataplaneAndAuth,
  maybeRunVerboseServerValidation,
  systemKey,
  options,
  payload
) {
  const resolved = await resolveDataplaneAndAuth(systemKey, {
    silent: options.silentResolve === true
  });
  requireBearerForDataplanePipeline(resolved.authConfig);
  if (options.force === true) {
    logForcePublishWarning();
  }
  const controllerUrl = await resolveControllerUrl();
  await assertDataplaneCliVersionCompatible(resolved.dataplaneUrl, { controllerUrl });
  if (options.minimal !== true) {
    logUploadTargetSection(resolved.environment, resolved.dataplaneUrl);
  }
  if (options.verbose) {
    await maybeRunVerboseServerValidation(resolved.dataplaneUrl, resolved.authConfig, payload);
  }
  return resolved;
}

module.exports = {
  logForcePublishWarning,
  logUploadTargetSection,
  resolveUploadPublishContext
};
