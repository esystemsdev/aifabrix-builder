/**
 * Upload external system to dataplane (single pipeline upload: validate → publish → controller register).
 *
 * @fileoverview Upload command handler for aifabrix upload <systemKey>
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
const {
  buildResolvedEnvMapForIntegration,
  resolveConfigurationValues
} = require('../utils/configuration-env-resolver');
const { validateExternalSystemComplete } = require('../validation/validate');
const { displayValidationResults } = require('../validation/validate-display');
const { generateControllerManifest } = require('../generator/external-controller-manifest');
const {
  uploadApplicationViaPipeline,
  validatePipelineConfig,
  testSystemViaPipeline
} = require('../api/pipeline.api');
const { formatApiError } = require('../utils/api-error-handler');
const { logDataplanePipelineWarning } = require('../utils/dataplane-pipeline-warning');
const { unwrapPublicationResult, unwrapApiData } = require('../utils/external-system-readiness-core');
const {
  logUploadReadinessSummary,
  logServerValidationWarnings,
  logProbeRuntimeBlock
} = require('../utils/external-system-readiness-display');

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
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register <systemKey>" first.');
  }

  logger.log(chalk.gray('Resolving dataplane URL...'));
  const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
  return { dataplaneUrl, authConfig, environment };
}

/**
 * Runs single pipeline upload (upload → validate → publish) on the dataplane.
 * @param {string} dataplaneUrl - Dataplane base URL
 * @param {Object} authConfig - Auth config
 * @param {Object} payload - { version, application, dataSources, status: "draft" }
 * @returns {Promise<Object>} Raw API response envelope
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
 * @param {Object} validationResult - Result from validateExternalSystemComplete
 * @returns {string}
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
 * Resolves configuration arrays in the upload payload (application + dataSources) from env and secrets.
 * @param {string} systemKey - System key
 * @param {Object} payload - Upload payload (mutated)
 */
async function resolvePayloadConfiguration(systemKey, payload) {
  const { envMap, secrets } = await buildResolvedEnvMapForIntegration(systemKey);
  if (Array.isArray(payload.application?.configuration) && payload.application.configuration.length > 0) {
    resolveConfigurationValues(payload.application.configuration, envMap, secrets, systemKey);
  }
  for (const ds of payload.dataSources || []) {
    if (Array.isArray(ds?.configuration) && ds.configuration.length > 0) {
      resolveConfigurationValues(ds.configuration, envMap, secrets, systemKey);
    }
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
 * Optional server-side pipeline validate when --verbose.
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {Object} payload
 */
async function maybeRunVerboseServerValidation(dataplaneUrl, authConfig, payload) {
  const vr = await validatePipelineConfig(dataplaneUrl, authConfig, {
    config: {
      version: payload.version,
      application: payload.application,
      dataSources: payload.dataSources
    }
  });
  if (vr?.success === false) {
    throw new Error(formatApiError(vr, dataplaneUrl));
  }
  const body = unwrapApiData(vr);
  logServerValidationWarnings(body);
}

/**
 * Optional POST validation/run after successful upload.
 * @param {string} dataplaneUrl
 * @param {string} systemKey
 * @param {Object} authConfig
 * @param {number|undefined} probeTimeoutMs
 */
async function maybeRunUploadProbe(dataplaneUrl, systemKey, authConfig, probeTimeoutMs) {
  logger.log(chalk.blue('\nRunning runtime checks (--probe)...'));
  const timeoutMs = probeTimeoutMs === undefined || probeTimeoutMs === null ? 120000 : probeTimeoutMs;
  try {
    const pr = await testSystemViaPipeline(dataplaneUrl, systemKey, authConfig, {}, { timeout: timeoutMs });
    if (pr.success === false) {
      logger.log(chalk.yellow(`⚠ Probe request failed: ${pr.formattedError || pr.error || 'unknown error'}`));
      return;
    }
    const probeData = unwrapApiData(pr);
    logProbeRuntimeBlock(probeData, systemKey);
  } catch (e) {
    logger.log(chalk.yellow(`⚠ Probe failed: ${e.message}`));
  }
}

/**
 * Local validation, manifest, payload, and configuration resolution.
 * @param {string} systemKey
 * @returns {Promise<{ manifest: Object, payload: Object }>}
 */
async function buildValidatedUploadManifestPayload(systemKey) {
  const validationResult = await validateExternalSystemComplete(systemKey, { type: 'external' });
  throwIfValidationFailed(validationResult);
  logger.log(chalk.green('✔ Local validation passed'));
  const manifest = await generateControllerManifest(systemKey, { type: 'external' });
  const payload = buildUploadPayload(manifest);
  await resolvePayloadConfiguration(systemKey, payload);
  return { manifest, payload };
}

/**
 * Upload path after dry-run check.
 * @param {string} systemKey
 * @param {Object} options
 * @param {Object} manifest
 * @param {Object} payload
 */
async function runUploadPublishAndSummary(systemKey, options, manifest, payload) {
  const { dataplaneUrl, authConfig, environment } = await resolveDataplaneAndAuth(systemKey);
  requireBearerForDataplanePipeline(authConfig);
  logger.log(chalk.gray('Target:'));
  logger.log(chalk.gray(`Environment: ${environment}`));
  logger.log(chalk.gray(`Dataplane: ${dataplaneUrl}`));
  logDataplanePipelineWarning();
  if (options.verbose) {
    await maybeRunVerboseServerValidation(dataplaneUrl, authConfig, payload);
  }
  await pushAndLogCredentialSecrets(dataplaneUrl, authConfig, systemKey, payload);
  const rawRes = await runUploadValidatePublish(dataplaneUrl, authConfig, payload);
  const publication = unwrapPublicationResult(rawRes);
  if (!publication) {
    throw new Error(
      'Unexpected response from dataplane upload: missing publication result (uploadId/system/datasources).'
    );
  }
  logUploadReadinessSummary({
    environment,
    dataplaneUrl,
    systemKey,
    publication,
    manifest,
    minimal: !!options.minimal
  });
  if (options.probe) {
    await maybeRunUploadProbe(dataplaneUrl, systemKey, authConfig, options.probeTimeout);
  }
}

/**
 * Uploads external system: publishes to dataplane and registers with controller (draft).
 * @param {string} systemKey - External system key (integration/<systemKey>/)
 * @param {Object} [options] - Options
 * @param {boolean} [options.dryRun] - Validate and build payload only; no API calls
 * @param {boolean} [options.verbose] - POST pipeline/validate for server warnings
 * @param {boolean} [options.probe] - POST validation/run after publish
 * @param {number} [options.probeTimeout] - Probe timeout ms (default 120000)
 * @param {boolean} [options.minimal] - Short summary only
 * @returns {Promise<void>}
 * @throws {Error} If validation or API calls fail
 */
async function uploadExternalSystem(systemKey, options = {}) {
  validateSystemKeyFormat(systemKey);
  logger.log(chalk.blue(`\nUploading external system: ${chalk.bold(systemKey)}`));
  const { manifest, payload } = await buildValidatedUploadManifestPayload(systemKey);
  if (options.dryRun) {
    logger.log(chalk.yellow('Dry run: would upload payload (no API calls).'));
    logger.log(
      chalk.gray(`  System: ${manifest.key}, version: ${payload.version}, datasources: ${payload.dataSources.length}`)
    );
    return;
  }
  await runUploadPublishAndSummary(systemKey, options, manifest, payload);
}

module.exports = {
  uploadExternalSystem,
  buildUploadPayload,
  resolveDataplaneAndAuth,
  runUploadValidatePublish,
  validateSystemKeyFormat
};
