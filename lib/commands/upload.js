/**
 * Upload external system to dataplane (upload → validate → publish).
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
const {
  uploadApplicationViaPipeline,
  validateUploadViaPipeline,
  publishUploadViaPipeline
} = require('../api/pipeline.api');
const { formatApiError } = require('../utils/api-error-handler');

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
 * Payload: { version, application, dataSources }; application = system with RBAC.
 * @param {Object} manifest - Controller manifest from generateControllerManifest
 * @returns {Object} { version, application, dataSources }
 */
function buildUploadPayload(manifest) {
  return {
    version: manifest.version || '1.0.0',
    application: manifest.system,
    dataSources: manifest.dataSources || []
  };
}

/**
 * Resolves dataplane URL and auth (same pattern as download).
 * @param {string} systemKey - System key
 * @param {Object} options - Options with optional dataplane override
 * @returns {Promise<{ dataplaneUrl: string, authConfig: Object, environment: string }>}
 */
async function resolveDataplaneAndAuth(systemKey, options) {
  const { resolveEnvironment } = require('../core/config');
  const environment = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const authConfig = await getDeploymentAuth(controllerUrl, environment, systemKey);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register <system-key>" first.');
  }

  let dataplaneUrl;
  if (options.dataplane) {
    dataplaneUrl = options.dataplane.replace(/\/$/, '');
  } else {
    logger.log(chalk.blue('Resolving dataplane URL...'));
    dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
  }

  return { dataplaneUrl, authConfig, environment };
}

/**
 * Runs upload → validate → publish on the dataplane.
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Auth config
 * @param {Object} payload - { version, application, dataSources }
 * @returns {Promise<{ uploadId: string }>}
 */
async function runUploadValidatePublish(dataplaneUrl, authConfig, payload) {
  const uploadRes = await uploadApplicationViaPipeline(dataplaneUrl, authConfig, payload);
  const uploadId = uploadRes?.data?.uploadId ?? uploadRes?.data?.id ?? uploadRes?.uploadId;
  if (!uploadId) {
    const msg = uploadRes?.success === false
      ? formatApiError(uploadRes, dataplaneUrl)
      : 'Upload did not return an upload ID';
    throw new Error(msg);
  }

  const validateRes = await validateUploadViaPipeline(dataplaneUrl, uploadId, authConfig);
  if (validateRes?.success === false) {
    const msg = formatApiError(validateRes, dataplaneUrl);
    throw new Error(`Upload validation failed: ${msg}`);
  }

  await publishUploadViaPipeline(dataplaneUrl, uploadId, authConfig);
  return { uploadId };
}

/**
 * Throws if validation result is invalid (displays results first).
 * @param {Object} validationResult - Result from validateExternalSystemComplete
 * @throws {Error} If validationResult.valid is false
 */
function throwIfValidationFailed(validationResult) {
  if (!validationResult.valid) {
    displayValidationResults(validationResult);
    throw new Error('Validation failed. Fix errors before uploading.');
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
    logger.log(chalk.green(`Pushed ${pushResult.pushed} credential secret(s) to dataplane.`));
  }
  if (pushResult.warning) {
    logger.log(chalk.yellow(`Warning: ${pushResult.warning}`));
  }
}

/**
 * Uploads external system to dataplane (upload → validate → publish). No controller deploy.
 * @param {string} systemKey - External system key (integration/<system-key>/)
 * @param {Object} [options] - Options
 * @param {boolean} [options.dryRun] - Validate and build payload only; no API calls
 * @param {string} [options.dataplane] - Override dataplane URL
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

  const { dataplaneUrl, authConfig, environment } = await resolveDataplaneAndAuth(systemKey, options);
  requireBearerForDataplanePipeline(authConfig);
  logger.log(chalk.blue(`Dataplane: ${dataplaneUrl}`));

  await pushAndLogCredentialSecrets(dataplaneUrl, authConfig, systemKey, payload);
  await runUploadValidatePublish(dataplaneUrl, authConfig, payload);

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
