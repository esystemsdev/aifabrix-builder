/**
 * Upload external system to dataplane (single pipeline upload: upload → validate → publish).
 *
 * @fileoverview Upload command handler for aifabrix upload <system-key>
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const { getDeploymentAuth, requireBearerForDataplanePipeline } = require('../utils/token-manager');
const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
const { getIntegrationPath } = require('../utils/paths');
const { pushCredentialSecrets } = require('../utils/credential-secrets-env');
const { validateExternalSystemComplete } = require('../validation/validate');
const { displayValidationResults } = require('../validation/validate-display');
const { generateControllerManifest } = require('../generator/external-controller-manifest');
const { uploadApplicationViaPipeline } = require('../api/pipeline.api');
const { formatApiError } = require('../utils/api-error-handler');
const { logDataplanePipelineWarning } = require('../utils/dataplane-pipeline-warning');

/**
 * Validates system-key format (same as download).
 * @param {string} systemKey - System key
 * @throws {Error} If invalid
 */
function validateSystemKeyFormat(systemKey) {
  if (!systemKey || typeof systemKey !== 'string') {
    throw new Error('System key is required and must be a string');
  }
  if (!/^[a-z0-9-_]+$/.test(systemKey)) {
    throw new Error('System key must contain only lowercase letters, numbers, hyphens, and underscores');
  }
}

/**
 * Builds pipeline upload payload from controller manifest.
 * Payload: { version, application, dataSources, status }; Builder always uses status "draft".
 * @param {Object} manifest - Controller manifest from generateControllerManifest
 * @returns {Object} { version, application, dataSources, status: "draft" }
 */
function buildUploadPayload(manifest) {
  return {
    version: manifest.version || '1.0.0',
    application: manifest.system,
    dataSources: manifest.dataSources || [],
    status: 'draft'
  };
}

/**
 * Resolves dataplane URL and auth (same pattern as download).
 * @param {string} systemKey - System key
 * @returns {Promise<{ dataplaneUrl: string, authConfig: Object, environment: string }>}
 */
async function resolveDataplaneAndAuth(systemKey) {
  const { resolveEnvironment } = require('../core/config');
  const environment = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const authConfig = await getDeploymentAuth(controllerUrl, environment, systemKey);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register <system-key>" first.');
  }

  logger.log(chalk.blue('Resolving dataplane URL...'));
  const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
  return { dataplaneUrl, authConfig, environment };
}

/**
 * Runs single pipeline upload (upload → validate → publish) on the dataplane.
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Auth config
 * @param {Object} payload - { version, application, dataSources, status: "draft" }
 * @returns {Promise<Object>} Publication result from Dataplane
 */
async function runUploadValidatePublish(dataplaneUrl, authConfig, payload) {
  const res = await uploadApplicationViaPipeline(dataplaneUrl, authConfig, payload);
  if (res?.success === false) {
    const msg = formatApiError(res, dataplaneUrl);
    throw new Error(msg);
  }
  return res;
}

/**
 * Builds a short summary of validation errors for the thrown message.
 * @param {Object} validationResult - Result from validateExternalSystemComplete
 * @returns {string} First few errors joined for the error message
 */
function formatValidationErrorSummary(validationResult) {
  const errors = validationResult.errors || [];
  if (errors.length === 0) {
    return 'Validation failed. Fix errors before uploading.';
  }
  const maxShow = 3;
  const shown = errors.slice(0, maxShow).map(e => (typeof e === 'string' ? e : String(e)));
  const summary = shown.join('; ');
  const more = errors.length > maxShow ? ` (and ${errors.length - maxShow} more)` : '';
  return `Validation failed: ${summary}${more}. Fix errors above and run the command again.`;
}

/**
 * Throws if validation result is invalid (displays results first).
 * @param {Object} validationResult - Result from validateExternalSystemComplete
 * @throws {Error} If validationResult.valid is false
 */
function throwIfValidationFailed(validationResult) {
  if (!validationResult.valid) {
    displayValidationResults(validationResult);
    throw new Error(formatValidationErrorSummary(validationResult));
  }
}

/**
 * Pushes credential secrets from .env and payload to dataplane; logs result or warning.
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Auth config
 * @param {string} systemKey - System key
 * @param {Object} payload - Upload payload
 */
async function pushAndLogCredentialSecrets(dataplaneUrl, authConfig, systemKey, payload) {
  const envFilePath = path.join(getIntegrationPath(systemKey), '.env');
  const pushResult = await pushCredentialSecrets(dataplaneUrl, authConfig, {
    envFilePath,
    appName: systemKey,
    payload
  });
  if (pushResult.pushed > 0) {
    const keyList = pushResult.keys?.length ? ` (${pushResult.keys.join(', ')})` : '';
    logger.log(chalk.green(`Pushed ${pushResult.pushed} credential secret(s) to dataplane${keyList}.`));
  } else {
    logger.log(chalk.yellow('Secret push skipped'));
  }
  if (pushResult.warning) {
    logger.log(chalk.yellow(`Warning: ${pushResult.warning}`));
  }
}

/**
 * Uploads external system to dataplane (single pipeline upload). No controller deploy.
 * @param {string} systemKey - External system key (integration/<system-key>/)
 * @param {Object} [options] - Options
 * @param {boolean} [options.dryRun] - Validate and build payload only; no API calls
 * @returns {Promise<void>}
 * @throws {Error} If validation or API calls fail
 */
async function uploadExternalSystem(systemKey, options = {}) {
  validateSystemKeyFormat(systemKey);
  logger.log(chalk.blue(`\nUploading external system to dataplane: ${systemKey}`));

  const validationResult = await validateExternalSystemComplete(systemKey, { type: 'external' });
  throwIfValidationFailed(validationResult);
  logger.log(chalk.green('Validation passed.'));

  const manifest = await generateControllerManifest(systemKey, { type: 'external' });
  const payload = buildUploadPayload(manifest);

  if (options.dryRun) {
    logger.log(chalk.yellow('Dry run: would upload payload (no API calls).'));
    logger.log(chalk.gray(`  System: ${manifest.key}, version: ${payload.version}, datasources: ${payload.dataSources.length}`));
    return;
  }

  const { dataplaneUrl, authConfig, environment } = await resolveDataplaneAndAuth(systemKey);
  requireBearerForDataplanePipeline(authConfig);
  logger.log(chalk.blue(`Dataplane: ${dataplaneUrl}`));
  logDataplanePipelineWarning();

  await pushAndLogCredentialSecrets(dataplaneUrl, authConfig, systemKey, payload);
  await runUploadValidatePublish(dataplaneUrl, authConfig, payload);
  logUploadSuccess(environment, systemKey, dataplaneUrl);
}

/**
 * Logs upload success summary.
 * @param {string} environment - Environment key
 * @param {string} systemKey - System key
 * @param {string} dataplaneUrl - Dataplane URL
 */
function logUploadSuccess(environment, systemKey, dataplaneUrl) {
  logger.log(chalk.green('\nUpload validated and published to dataplane.'));
  logger.log(chalk.blue(`Environment: ${environment}`));
  logger.log(chalk.blue(`System: ${systemKey}`));
  logger.log(chalk.blue(`Dataplane: ${dataplaneUrl}`));
}

module.exports = {
  uploadExternalSystem,
  buildUploadPayload,
  resolveDataplaneAndAuth,
  runUploadValidatePublish,
  validateSystemKeyFormat
};
