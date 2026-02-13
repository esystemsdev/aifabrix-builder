/**
 * Deployment list commands – list deployments for environment or for an app
 * Uses GET .../deployments and GET .../applications/{appKey}/deployments.
 *
 * @fileoverview Deployment list command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const { resolveEnvironment } = require('../core/config');
const { getOrRefreshDeviceToken } = require('../utils/token-manager');
const { listDeployments, listApplicationDeployments } = require('../api/deployments.api');
const { normalizeControllerUrl } = require('../core/config');

const DEFAULT_PAGE_SIZE = 50;

/**
 * Get auth token for deployment list (device token from config)
 * @async
 * @param {string} controllerUrl - Controller base URL
 * @returns {Promise<{token: string, controllerUrl: string}|null>}
 */
async function getDeploymentListAuth(controllerUrl) {
  const normalizedUrl = normalizeControllerUrl(controllerUrl);
  const deviceToken = await getOrRefreshDeviceToken(normalizedUrl);
  if (deviceToken && deviceToken.token) {
    return {
      token: deviceToken.token,
      controllerUrl: deviceToken.controller || normalizedUrl
    };
  }
  return null;
}

/**
 * Extract deployments array from API response.
 * Supports OpenAPI/SDK paginated format: { meta, data: Deployment[], links }
 * and legacy shapes: { data: { items } }, { data: { deployments } }, or { data: [] }.
 * @param {Object} response - API response (from ApiClient: { success, data: body, status })
 * @returns {Array}
 */
function extractDeployments(response) {
  const body = response?.data ?? response;
  const items =
    (Array.isArray(body?.data) ? body.data : undefined) ??
    body?.items ??
    body?.deployments ??
    (Array.isArray(body) ? body : []);
  return Array.isArray(items) ? items : [];
}

/**
 * Display environment deployment list to user
 * @param {Array} deployments - Deployments array
 * @param {string} environment - Environment key
 * @param {string} controllerUrl - Controller URL
 */
function displayDeploymentList(deployments, environment, controllerUrl) {
  logger.log(chalk.bold(`\n📋 Deployments (${environment}) at ${controllerUrl}:\n`));
  if (deployments.length === 0) {
    logger.log(chalk.gray('  No deployments found.\n'));
    return;
  }
  deployments.forEach((d) => {
    const id = d.id ?? d.deploymentId ?? '-';
    const target =
      d.applicationKey ?? d.appKey ?? d.targetId ?? d.application?.key ?? '-';
    const status = d.status ?? '-';
    const createdAt = d.createdAt ?? d.created ?? '';
    logger.log(`  ${chalk.cyan(id)} ${target} ${status} ${chalk.gray(createdAt)}`);
  });
  logger.log('');
}

/**
 * Run deployment list (environment): list last N deployments for current environment
 * @async
 * @param {Object} options - CLI options
 * @param {string} [options.controller] - Controller URL override
 * @param {string} [options.environment] - Environment key override
 * @param {number} [options.pageSize] - Items per page (default 50)
 * @returns {Promise<void>}
 */
async function runDeploymentList(options = {}) {
  const { environment, authResult } = await resolveDeploymentListContext(options);
  const authConfig = { type: 'bearer', token: authResult.token };
  const listOptions = { pageSize: options.pageSize || DEFAULT_PAGE_SIZE };
  try {
    const response = await listDeployments(
      authResult.controllerUrl,
      environment,
      authConfig,
      listOptions
    );
    displayDeploymentList(extractDeployments(response), environment, authResult.controllerUrl);
  } catch (error) {
    logger.error(chalk.red(`❌ Failed to list deployments: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Display app deployment list to user
 * @param {Array} deployments - Deployments array
 * @param {string} appKey - Application key
 * @param {string} environment - Environment key
 * @param {string} controllerUrl - Controller URL
 */
function displayAppDeploymentList(deployments, appKey, environment, controllerUrl) {
  logger.log(chalk.bold(`\n📋 Deployments for ${appKey} (${environment}) at ${controllerUrl}:\n`));
  if (deployments.length === 0) {
    logger.log(chalk.gray('  No deployments found for this application.\n'));
    return;
  }
  deployments.forEach((d) => {
    const id = d.id ?? d.deploymentId ?? '-';
    const status = d.status ?? '-';
    const createdAt = d.createdAt ?? d.created ?? '';
    logger.log(`  ${chalk.cyan(id)} ${status} ${chalk.gray(createdAt)}`);
  });
  logger.log('');
}

/**
 * Resolve controller URL, environment, and auth for deployment list commands
 * @async
 * @param {Object} options - Options with optional controller, environment
 * @returns {Promise<{controllerUrl: string, environment: string, authResult: Object}>}
 */
async function resolveDeploymentListContext(options) {
  const controllerUrl = options.controller || (await resolveControllerUrl());
  if (!controllerUrl) {
    logger.error(chalk.red('❌ Controller URL is required. Run "aifabrix login" first.'));
    process.exit(1);
  }
  const environment = options.environment || (await resolveEnvironment());
  const authResult = await getDeploymentListAuth(controllerUrl);
  if (!authResult || !authResult.token) {
    logger.error(chalk.red(`❌ No authentication token for controller: ${controllerUrl}`));
    logger.error(chalk.gray('Run: aifabrix login'));
    process.exit(1);
  }
  return { controllerUrl, environment, authResult };
}

/**
 * Run app deployment list: list last N deployments for an application
 * @async
 * @param {string} appKey - Application key
 * @param {Object} options - CLI options
 * @param {string} [options.controller] - Controller URL override
 * @param {string} [options.environment] - Environment key override
 * @param {number} [options.pageSize] - Items per page (default 50)
 * @returns {Promise<void>}
 */
async function runAppDeploymentList(appKey, options = {}) {
  if (!appKey || typeof appKey !== 'string') {
    logger.error(chalk.red('❌ Application key is required.'));
    process.exit(1);
    return;
  }
  const { environment, authResult } = await resolveDeploymentListContext(options);
  const authConfig = { type: 'bearer', token: authResult.token };
  const listOptions = { pageSize: options.pageSize || DEFAULT_PAGE_SIZE };
  try {
    const response = await listApplicationDeployments(
      authResult.controllerUrl,
      environment,
      appKey,
      authConfig,
      listOptions
    );
    displayAppDeploymentList(
      extractDeployments(response),
      appKey,
      environment,
      authResult.controllerUrl
    );
  } catch (error) {
    logger.error(chalk.red(`❌ Failed to list deployments for ${appKey}: ${error.message}`));
    process.exit(1);
  }
}

module.exports = {
  runDeploymentList,
  runAppDeploymentList
};
