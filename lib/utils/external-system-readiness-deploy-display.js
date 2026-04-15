/**
 * Deploy readiness CLI output (config / deployment / runtime layers).
 * Kept separate from upload display to satisfy file/function size rules.
 *
 * @fileoverview Deploy external system readiness logging
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('./logger');
const {
  summarizeDatasourceTiersA,
  aggregateVerdictFromCounts,
  summarizeProbeResults,
  formatDataplaneFetchReason,
  buildNextActionsTierA
} = require('./external-system-readiness-core');
const {
  logSeparator,
  logSectionTitle,
  logDatasourceTable,
  verdictLine,
  logIdentityBlock,
  logCredentialIntentBlock,
  logDocsBlock,
  logNextActions
} = require('./external-system-readiness-display-internals');

/**
 * @param {Array<Object>|undefined} dsFromCtx
 * @param {Object} manifest
 * @returns {Object[]}
 */
function resolveDeployDatasources(dsFromCtx, manifest) {
  let datasources = Array.isArray(dsFromCtx) ? dsFromCtx : [];
  if (datasources.length === 0 && Array.isArray(manifest.dataSources)) {
    datasources = manifest.dataSources.map(d => ({
      key: d.key,
      status: d.status || 'published',
      isActive: d.isActive !== false,
      mcpContract: d.mcpContract
    }));
  }
  return datasources;
}

/**
 * @param {Object} probeData
 */
function logDeployProbeDatasourceSection(probeData) {
  const results = probeData.results || [];
  const probeSummary = summarizeProbeResults(results);
  logSectionTitle('Runtime Readiness:');
  logDatasourceTable(probeSummary.rows, probeSummary);
  if (probeSummary.issues.length > 0) {
    logSeparator();
    logSectionTitle('Key Issues:');
    for (const { key, lines } of probeSummary.issues) {
      logger.log(chalk.white(key));
      for (const line of lines) {
        logger.log(chalk.red(`- ${line}`));
      }
    }
  }
  logSeparator();
  logSectionTitle('Credential Test:');
  const anyEndpointFail = results.some(row => row?.endpointTestResults?.success === false);
  if (anyEndpointFail) {
    logger.log(chalk.red('✖ Failed (see Key Issues / endpoint test)'));
  } else if (probeSummary.failed > 0) {
    logger.log(chalk.red('✖ Some datasource checks failed'));
  } else if (probeSummary.partial > 0) {
    logger.log(chalk.yellow('⚠ Completed with warnings'));
  } else {
    logger.log(chalk.green('✔ Passed'));
  }
}

/**
 * @param {Object|null} systemFromDataplane
 * @param {boolean} genMcp
 */
function logDeployContractsSection(systemFromDataplane, genMcp) {
  if (!systemFromDataplane) return;
  logSeparator();
  logSectionTitle('Contracts:');
  const mcpOk = genMcp !== false;
  logger.log(mcpOk ? chalk.green('✔ MCP generation enabled') : chalk.gray('○ MCP generation not enabled'));
  if (systemFromDataplane.openApiDocsPageUrl || systemFromDataplane.apiDocumentUrl) {
    logger.log(chalk.green('✔ OpenAPI available'));
  } else {
    logger.log(chalk.gray('○ OpenAPI docs URL not available'));
  }
  logDocsBlock(systemFromDataplane);
}

/**
 * @param {string} systemKey
 * @param {Object|null} probeData
 * @param {Object} summary
 * @param {boolean} genMcp
 */
function logDeployNextActionsSection(systemKey, probeData, summary, genMcp) {
  logSeparator();
  if (probeData) {
    logNextActions(
      ['Fix API credentials or permissions if endpoint tests failed'],
      `Run: aifabrix datasource test-e2e <datasourceKey> --app ${systemKey}`
    );
    return;
  }
  const hints = buildNextActionsTierA(systemKey, summary, genMcp);
  const deployHints = hints.filter(h => !h.includes('aifabrix upload'));
  const probeCmd = `Run: aifabrix deploy ${systemKey} --probe`;
  if (!deployHints.some(h => h.includes('--probe'))) {
    deployHints.push(probeCmd);
  }
  logNextActions(deployHints.slice(0, 6));
}

/**
 * @param {Object} ctx
 * @param {string} ctx.environment
 * @param {string} ctx.dataplaneUrl
 * @param {string} systemKey
 * @param {Error} fetchError
 */
function logDeployReadinessFetchError(ctx, systemKey, fetchError) {
  const { dataplaneUrl } = ctx;
  logSeparator();
  logger.log(chalk.yellow('⚠ Unable to fetch system details from dataplane'));
  logger.log(chalk.yellow(`Reason: ${formatDataplaneFetchReason(fetchError, dataplaneUrl || '')}`));
  logger.log(chalk.white('\nDeployment succeeded, but readiness could not be verified.'));
  logSeparator();
  logNextActions(
    ['Verify dataplane is running', 'Check network / authentication'],
    `Retry: aifabrix deploy ${systemKey}`
  );
}

/**
 * @param {Object} systemCfg
 * @param {boolean} deploymentOk
 * @param {Object|null} probeData
 * @param {Object} summary
 * @param {Object|null} [deploymentDetail] - from parseControllerDeploymentOutcome when !deploymentOk
 */
function logDeployDeploymentSubsection(deploymentOk, deploymentDetail) {
  logSectionTitle('Deployment:');
  if (deploymentOk) {
    logger.log(chalk.green('✔ Controller deployment OK'));
    return;
  }
  logger.log(chalk.red('✖ Controller deployment failed'));
  if (!deploymentDetail) {
    logger.log(chalk.gray('   No deployment status payload was available after polling.'));
    return;
  }
  if (deploymentDetail.statusLabel) {
    logger.log(chalk.gray(`   Status: ${deploymentDetail.statusLabel}`));
  }
  if (deploymentDetail.error) {
    logger.log(chalk.red(`   Error: ${deploymentDetail.error}`));
  }
  if (deploymentDetail.message) {
    logger.log(chalk.yellow(`   Message: ${deploymentDetail.message}`));
  }
  if (!deploymentDetail.error && !deploymentDetail.message && !deploymentDetail.statusLabel) {
    logger.log(chalk.gray('   No error details in the deployment status response; check controller logs.'));
  }
}

function logDeployConfigDeploymentRuntime(systemCfg, deploymentOk, probeData, summary, deploymentDetail) {
  const verdict = aggregateVerdictFromCounts(summary);
  logSeparator();
  logger.log(verdictLine(verdict));
  logSectionTitle('Config:');
  logger.log(chalk.green('✔ Manifest valid'));
  const method = systemCfg.authentication?.method || 'unknown';
  logger.log(chalk.green(`✔ Authentication configured (${method})`));
  logDeployDeploymentSubsection(deploymentOk, deploymentDetail);
  logSectionTitle('Runtime:');
  if (!probeData) {
    logger.log(chalk.gray('⏭ Skipped (use --probe to verify)'));
  } else {
    logger.log(chalk.green('✔ Runtime checks completed (--probe)'));
  }
}

/**
 * @param {string} environment
 * @param {string} dataplaneUrl
 */
function logDeployEnvironmentAndDataplane(environment, dataplaneUrl) {
  logger.log('');
  logger.log(chalk.gray(`Environment: ${environment}`));
  logger.log(chalk.gray(`Dataplane: ${dataplaneUrl || '(unknown)'}`));
}

/**
 * @param {Object} systemCfg
 * @param {boolean} withProbe
 */
function logDeployIdentityAndCredentialBlocks(systemCfg, withProbe) {
  logSeparator();
  logIdentityBlock(systemCfg);
  if (!withProbe) {
    logSeparator();
    logCredentialIntentBlock(systemCfg, false);
  }
}

/**
 * @param {Object} ctx
 * @param {string} ctx.environment
 * @param {string} ctx.dataplaneUrl
 * @param {Object} ctx.manifest
 * @param {Array<Object>} [ctx.datasources]
 * @param {Object|null} ctx.systemFromDataplane
 * @param {Error|null} ctx.fetchError
 * @param {boolean} ctx.deploymentOk
 * @param {Object|null} [ctx.deploymentDetail]
 * @param {Object|null} ctx.probeData
 */
function logDeployReadinessSummary(ctx) {
  const {
    environment,
    dataplaneUrl,
    manifest,
    datasources: dsFromCtx,
    systemFromDataplane,
    fetchError,
    deploymentOk,
    deploymentDetail,
    probeData
  } = ctx;
  const systemKey = manifest.key;
  const systemCfg = manifest.system || {};
  const genMcp = systemCfg.generateMcpContract !== false;

  logDeployEnvironmentAndDataplane(environment, dataplaneUrl);

  if (fetchError) {
    logDeployReadinessFetchError(ctx, systemKey, fetchError);
    return;
  }

  const datasources = resolveDeployDatasources(dsFromCtx, manifest);
  const summary = summarizeDatasourceTiersA(datasources, genMcp);
  logDeployConfigDeploymentRuntime(systemCfg, deploymentOk, probeData, summary, deploymentDetail || null);

  logSeparator();
  if (probeData) {
    logDeployProbeDatasourceSection(probeData);
  } else {
    logDatasourceTable(summary.rows, summary);
  }

  logDeployIdentityAndCredentialBlocks(systemCfg, !!probeData);

  logDeployContractsSection(systemFromDataplane, genMcp);
  logDeployNextActionsSection(systemKey, probeData, summary, genMcp);
}

module.exports = {
  logDeployReadinessSummary
};
