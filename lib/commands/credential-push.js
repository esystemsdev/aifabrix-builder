/**
 * Credential push command – pushes KV_* from .env to dataplane.
 * Used by `aifabrix credential push <system-key>`.
 *
 * @fileoverview Credential push command – push credential secrets to dataplane
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
const { generateControllerManifest } = require('../generator/external-controller-manifest');

/**
 * Validates system-key format.
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
 * Builds upload payload for credential push (same shape as upload).
 * @param {string} systemKey - System key
 * @returns {Promise<Object>} { version, application, dataSources }
 */
async function buildPayload(systemKey) {
  const manifest = await generateControllerManifest(systemKey, { type: 'external' });
  return {
    version: manifest.version || '1.0.0',
    application: manifest.system,
    dataSources: manifest.dataSources || []
  };
}

/**
 * Runs credential push: push KV_* from .env to dataplane.
 * @async
 * @param {string} systemKey - External system key
 * @returns {Promise<{ pushed: number }>} Count of secrets pushed
 * @throws {Error} If auth or push fails
 */
function logPushResult(pushResult) {
  if (pushResult.pushed > 0) {
    const keyList = pushResult.keys?.length ? ` (${pushResult.keys.join(', ')})` : '';
    logger.log(chalk.green(`✓ Pushed ${pushResult.pushed} credential secret(s) to dataplane${keyList}.`));
  } else if (pushResult.skipped) {
    logger.log(chalk.yellow('No credential secrets to push (empty .env or no KV_* vars with values).'));
  } else {
    logger.log(chalk.yellow('Secret push skipped'));
  }
  if (pushResult.warning) logger.log(chalk.yellow(`Warning: ${pushResult.warning}`));
}

async function runCredentialPush(systemKey) {
  validateSystemKeyFormat(systemKey);
  const appPath = getIntegrationPath(systemKey);
  const envFilePath = path.join(appPath, '.env');

  const { resolveEnvironment } = require('../core/config');
  const environment = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const authConfig = await getDeploymentAuth(controllerUrl, environment, systemKey);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register <system-key>" first.');
  }

  requireBearerForDataplanePipeline(authConfig);
  logger.log(chalk.blue('Resolving dataplane URL...'));
  const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);

  const payload = await buildPayload(systemKey);
  const pushResult = await pushCredentialSecrets(dataplaneUrl, authConfig, {
    envFilePath,
    appName: systemKey,
    payload
  });

  logPushResult(pushResult);
  return { pushed: pushResult.pushed || 0 };
}

module.exports = { runCredentialPush, validateSystemKeyFormat, buildPayload };
