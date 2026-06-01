/**
 * @fileoverview verify-governance DB pack path (plan 150.0).
 */

'use strict';

const {
  resolveExternalIntegrationContext,
  syncLocalIfRequested
} = require('./test-e2e-external');
const { runDatasourceGovernanceScenarios, getDatasourceGovernancePack } = require('../api/governance-scenario-pack.api');
const { resolveIntegrationAuth } = require('../external-system/integration-auth-context');
const { cliOptsSkipSync } = require('../utils/cli-sync-options');
const { VERDICT } = require('../lifecycle/product-model');
const { runWithVerifyStepProgress } = require('../lifecycle/verify-step-progress');

/**
 * @param {Object} options
 * @param {Object|null} uploadCtx
 */
function attachUploadAuthToOptions(options, uploadCtx) {
  if (!uploadCtx?.authConfig || !uploadCtx?.dataplaneUrl) {
    return;
  }
  options.authConfig = uploadCtx.authConfig;
  options.dataplaneUrl = uploadCtx.dataplaneUrl;
  options.silentResolve = true;
}

/**
 * @async
 * @param {string[]} keys
 * @param {Object} ctx
 * @param {{ setLabel?: (label: string) => void }} [progress]
 * @returns {Promise<Array>}
 */
async function runGovernanceForDatasourceKeys(keys, ctx, progress = {}) {
  const rows = [];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (typeof progress.setLabel === 'function') {
      progress.setLabel(`Running governance scenarios: ${key} (${index + 1}/${keys.length})`);
    }
    try {
      const pack = await getDatasourceGovernancePack(ctx.dataplaneUrl, ctx.authConfig, key);
      if (!pack || !pack.pack) {
        continue;
      }
      const result = await runDatasourceGovernanceScenarios(ctx.dataplaneUrl, ctx.authConfig, key);
      const summary = result.summary || {};
      rows.push({
        datasourceKey: key,
        verdict: summary.failed > 0 ? VERDICT.FAILED : VERDICT.VERIFIED,
        scenarios: { passed: summary.passed || 0, total: summary.total || 0 },
        policyCoveragePercent: result.policyCoveragePercent ?? 100,
        dimensionCoveragePercent: result.dimensionCoveragePercent ?? 100,
        result
      });
    } catch (err) {
      rows.push({
        datasourceKey: key,
        verdict: VERDICT.FAILED,
        error: err.message,
        scenarios: { passed: 0, total: 0 }
      });
    }
  }
  return rows;
}

/**
 * @async
 * @param {string} systemKey
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function runVerifyGovernanceFromDbPacks(systemKey, options) {
  const { systemKey: resolvedKey, keys } = resolveExternalIntegrationContext(systemKey);
  if (keys.length === 0) {
    return { resolvedKey, datasourceRows: [] };
  }

  if (!cliOptsSkipSync(options)) {
    const uploadCtx = await syncLocalIfRequested(resolvedKey, options);
    attachUploadAuthToOptions(options, uploadCtx);
  }

  const { authConfig, dataplaneUrl } = await resolveIntegrationAuth(resolvedKey, options);
  const datasourceRows = await runWithVerifyStepProgress(
    'Running governance scenarios',
    async(progress) =>
      runGovernanceForDatasourceKeys(keys, { authConfig, dataplaneUrl }, progress),
    options
  );
  return { resolvedKey, datasourceRows };
}

module.exports = {
  runGovernanceForDatasourceKeys,
  runVerifyGovernanceFromDbPacks
};
