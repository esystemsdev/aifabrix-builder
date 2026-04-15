/**
 * External System Deployment Module
 *
 * Handles deployment of external systems via controller pipeline.
 * After deploy, fetches dataplane list + system for readiness summary.
 *
 * @fileoverview External system deployment for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { getDeploymentAuth } = require('../utils/token-manager');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const { detectAppType } = require('../utils/paths');
const { logOfflinePathWhenType } = require('../utils/cli-utils');
const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
const { getExternalSystem } = require('../api/external-systems.api');
const { listDatasources } = require('../api/datasources-core.api');
const { testSystemViaPipeline } = require('../api/pipeline.api');
const { extractDatasources } = require('../datasource/list');
const { unwrapApiData } = require('../utils/external-system-readiness-core');
const { logDeployReadinessSummary } = require('../utils/external-system-readiness-deploy-display');
const { parseControllerDeploymentOutcome } = require('../utils/controller-deployment-outcome');
const { generateControllerManifest } = require('../generator/external-controller-manifest');
const { validateExternalSystemComplete } = require('../validation/validate');
const { displayValidationResults } = require('../validation/validate-display');

/**
 * Lists datasources for a system and loads system record for docs URLs.
 * @async
 * @param {string} controllerUrl - Controller base URL
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Auth config
 * @param {string} systemKey - System key
 * @returns {Promise<{ dataplaneUrl: string, datasources: Object[], system: Object|null, error: Error|null }>}
 */
async function fetchDataplaneDeployReadiness(controllerUrl, environment, authConfig, systemKey) {
  let dataplaneUrl;
  try {
    dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
  } catch (err) {
    return { dataplaneUrl: null, datasources: [], system: null, error: err };
  }

  let datasources = [];
  try {
    const listRes = await listDatasources(dataplaneUrl, authConfig, {
      sourceSystemIdOrKey: systemKey,
      pageSize: 100
    });
    if (listRes.success && listRes.data) {
      try {
        datasources = extractDatasources(listRes);
      } catch {
        datasources = [];
      }
    }
  } catch (err) {
    return { dataplaneUrl, datasources: [], system: null, error: err };
  }

  try {
    const getRes = await getExternalSystem(dataplaneUrl, systemKey, authConfig);
    const system = unwrapApiData(getRes);
    return {
      dataplaneUrl,
      datasources,
      system: system && typeof system === 'object' ? system : null,
      error: null
    };
  } catch (err) {
    if (datasources.length === 0) {
      return { dataplaneUrl, datasources, system: null, error: err };
    }
    return { dataplaneUrl, datasources, system: null, error: null };
  }
}

/**
 * Deploys via controller and prints readiness summary (config / deployment / runtime layers).
 * @async
 * @param {Object} manifest - Controller manifest
 * @param {string} controllerUrl - Controller base URL
 * @param {string} environment - Environment key
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} options - Deployment options (poll, probe, probeTimeout)
 * @returns {Promise<Object>} Deployment result
 */
/**
 * @param {Object} deploymentOutcome - from parseControllerDeploymentOutcome
 */
function logImmediateControllerDeploymentOutcome(deploymentOutcome) {
  if (deploymentOutcome.ok) {
    logger.log(chalk.green('\n✔ Controller deployment OK'));
    return;
  }
  logger.log(chalk.red('\n✖ Controller deployment did not complete successfully'));
  const parts = [deploymentOutcome.error, deploymentOutcome.message].filter(Boolean);
  if (parts.length > 0) {
    for (const line of parts) {
      logger.log(chalk.red(`   ${line}`));
    }
    return;
  }
  if (deploymentOutcome.statusLabel) {
    logger.log(
      chalk.yellow(
        `   Controller status: ${deploymentOutcome.statusLabel} (no message or error in API response)`
      )
    );
    return;
  }
  logger.log(chalk.gray('   See Deployment section below for details.'));
}

async function executeDeployAndDisplay(manifest, controllerUrl, environment, authConfig, options) {
  const deployer = require('../deployment/deployer');
  const pollOpts = {
    poll: options.poll,
    pollInterval: options.pollInterval !== undefined ? options.pollInterval : 500,
    pollMaxAttempts: options.pollMaxAttempts,
    ...options
  };
  const result = await deployer.deployToController(
    manifest,
    controllerUrl,
    environment,
    authConfig,
    pollOpts
  );

  const deploymentOutcome = parseControllerDeploymentOutcome(result);
  logImmediateControllerDeploymentOutcome(deploymentOutcome);

  const ctx = await fetchDataplaneDeployReadiness(
    controllerUrl,
    environment,
    authConfig,
    manifest.key
  );

  let probeData = null;
  if (options.probe && ctx.dataplaneUrl && !ctx.error) {
    logger.log(chalk.blue('\nRunning runtime checks (--probe)...'));
    try {
      const pr = await testSystemViaPipeline(ctx.dataplaneUrl, manifest.key, authConfig, {}, {
        timeout: options.probeTimeout || 120000
      });
      if (pr.success === false) {
        logger.log(
          chalk.yellow(`⚠ Probe request failed: ${pr.formattedError || pr.error || 'unknown error'}`)
        );
      } else {
        probeData = unwrapApiData(pr);
      }
    } catch (e) {
      logger.log(chalk.yellow(`⚠ Probe failed: ${e.message}`));
    }
  }

  logDeployReadinessSummary({
    environment,
    dataplaneUrl: ctx.dataplaneUrl,
    manifest,
    datasources: ctx.datasources,
    systemFromDataplane: ctx.system,
    fetchError: ctx.error,
    deploymentOk: deploymentOutcome.ok,
    deploymentDetail: deploymentOutcome.ok ? null : deploymentOutcome,
    probeData
  });

  return result;
}

/**
 * Prepares deployment configuration (auth, controller URL, environment)
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment configuration
 */
async function prepareDeploymentConfig(appName, _options) {
  const { resolveEnvironment } = require('../core/config');
  const environment = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const authConfig = await getDeploymentAuth(controllerUrl, environment, appName);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
  }

  return { environment, controllerUrl, authConfig };
}

/**
 * Deploys external system via controller pipeline (same as regular apps)
 *
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Deployment options
 * @param {boolean} [options.probe] - Run dataplane validation/run after deploy
 * @param {number} [options.probeTimeout] - Probe timeout ms (default 120000)
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 */
async function deployExternalSystem(appName, options = {}) {
  try {
    const { appPath } = await detectAppType(appName);
    logOfflinePathWhenType(appPath);

    logger.log(chalk.blue(`\n🚀 Deploying external system: ${appName}`));

    logger.log(chalk.blue('🔍 Validating external system before deployment...'));
    const validationResult = await validateExternalSystemComplete(appName, options);

    if (!validationResult.valid) {
      displayValidationResults(validationResult);
      throw new Error('Validation failed. Fix errors before deploying.');
    }

    logger.log(chalk.green('✔ Local validation passed, proceeding with deployment...'));

    const manifest = await generateControllerManifest(appName, options);

    const { environment, controllerUrl, authConfig } = await prepareDeploymentConfig(appName, options);

    const result = await executeDeployAndDisplay(
      manifest,
      controllerUrl,
      environment,
      authConfig,
      options
    );
    return result;
  } catch (error) {
    let message = `Failed to deploy external system: ${error.message}`;
    if (error.message && error.message.includes('Application not found')) {
      message += `\n\n💡 Register the app in the controller first: aifabrix app register ${appName}`;
    }
    throw new Error(message);
  }
}

module.exports = {
  deployExternalSystem,
  executeDeployAndDisplay,
  fetchDataplaneDeployReadiness
};
