/**
 * Retry dataplane pipeline upload with application client token when device Bearer fails.
 *
 * @fileoverview Pipeline publish auth fallback when device Bearer is rejected
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('./logger');
const { uploadApplicationViaPipeline } = require('../api/pipeline.api');
const { getDeploymentAuth } = require('./token-manager');
const { resolveControllerUrl } = require('./controller-url');
const config = require('../core/config');

/**
 * @param {Object} apiResponse
 * @returns {boolean}
 */
function isPipelineAuthFailure(apiResponse) {
  if (!apiResponse || apiResponse.success !== false) {
    return false;
  }
  const status = Number(apiResponse.status) || 0;
  if (status === 401 || status === 403) {
    return true;
  }
  const text = String(
    apiResponse.formattedError || apiResponse.error || apiResponse.message || ''
  ).toLowerCase();
  return text.includes('invalid token') || text.includes('unauthorized') || text.includes('authentication');
}

/**
 * @param {string} systemKey
 * @returns {Promise<Object|null>}
 */
async function resolveClientTokenAuthForPipelineRetry(systemKey) {
  try {
    const controllerUrl = await resolveControllerUrl();
    const environment = await config.resolveEnvironment();
    return await getDeploymentAuth(controllerUrl, environment, systemKey, {
      deploymentAuth: 'client-credentials'
    });
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/pipeline/upload with optional client-token retry after device Bearer 401.
 *
 * @async
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {Object} payload
 * @param {string} systemKey - External system key for credential lookup on retry
 * @returns {Promise<Object>}
 */
async function uploadApplicationViaPipelineWithAuthRetry(dataplaneUrl, authConfig, payload, systemKey) {
  const first = await uploadApplicationViaPipeline(dataplaneUrl, authConfig, payload);
  if (!isPipelineAuthFailure(first) || authConfig.type !== 'bearer') {
    return first;
  }
  const clientAuth = await resolveClientTokenAuthForPipelineRetry(systemKey);
  if (!clientAuth || clientAuth.type === 'bearer') {
    return first;
  }
  logger.log(
    chalk.yellow(
      'Device login token was rejected for pipeline publish; retrying with application client token…'
    )
  );
  return uploadApplicationViaPipeline(dataplaneUrl, clientAuth, payload);
}

module.exports = {
  isPipelineAuthFailure,
  uploadApplicationViaPipelineWithAuthRetry
};
