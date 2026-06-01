/**
 * @fileoverview lifecycle certification report — GET default, --run optional (plan 150.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { getSystemLifecycleReport, runSystemLifecycle } = require('../api/lifecycle.api');
const { setupIntegrationTestAuth } = require('../external-system/test-auth');
const { getConfig } = require('../core/config');
const { cliOptsSkipSync } = require('../utils/cli-sync-options');
const { syncLocalIfRequested } = require('./test-e2e-external');
const { runVerifyOperationsForExternalSystem } = require('./verify-operations-external');
const { runVerifyTrustForExternalSystem } = require('./verify-trust-external');
const { runVerifyGovernanceForExternalSystem } = require('./verify-governance-external');
const { VERDICT } = require('../lifecycle/product-model');

/**
 * @async
 * @param {string} systemKey
 * @param {Object} options
 * @returns {Promise<{ authConfig: Object, dataplaneUrl: string }>}
 */
async function resolveLifecycleAuth(systemKey, options) {
  if (!cliOptsSkipSync(options) && options.run === true) {
    const uploadCtx = await syncLocalIfRequested(systemKey, options);
    if (uploadCtx) {
      return { authConfig: uploadCtx.authConfig, dataplaneUrl: uploadCtx.dataplaneUrl };
    }
  }
  const configObj = await getConfig();
  return setupIntegrationTestAuth(systemKey, { environment: options.env }, configObj);
}

/**
 * Run missing verify pillars locally when lifecycle/run API unavailable.
 * @async
 * @param {string} systemKey
 * @param {Object} report
 * @param {Object} options
 */
async function runMissingVerifyStepsLocally(systemKey, report, options) {
  const runOpts = { ...options, noSync: true };
  if (report.operations?.verdict !== VERDICT.VERIFIED) {
    await runVerifyOperationsForExternalSystem(systemKey, runOpts);
  }
  if (report.trust?.verdict !== VERDICT.VERIFIED) {
    await runVerifyTrustForExternalSystem(systemKey, runOpts);
  }
  if (report.governance?.verdict !== VERDICT.VERIFIED) {
    await runVerifyGovernanceForExternalSystem(systemKey, runOpts);
  }
}

/**
 * @async
 * @param {string} systemKey
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function runLifecycleForExternalSystem(systemKey, options = {}) {
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(systemKey).catch(() => null);
  if (!appType || appType.baseDir !== 'integration') {
    throw new Error(
      'lifecycle applies to external integration folders only (integration/<systemKey>/).'
    );
  }

  const { authConfig, dataplaneUrl } = await resolveLifecycleAuth(systemKey, options);

  if (options.run === true) {
    try {
      const runRes = await runSystemLifecycle(dataplaneUrl, authConfig, systemKey, {});
      return {
        systemKey,
        command: 'lifecycle',
        report: runRes.report,
        stepsRun: runRes.stepsRun || [],
        source: 'api'
      };
    } catch {
      const preReport = await getSystemLifecycleReport(dataplaneUrl, authConfig, systemKey, {
        details: options.verbose === true
      });
      await runMissingVerifyStepsLocally(systemKey, preReport, options);
    }
  }

  const report = await getSystemLifecycleReport(dataplaneUrl, authConfig, systemKey, {
    details: options.verbose === true
  });

  return {
    systemKey,
    command: 'lifecycle',
    report,
    source: options.run ? 'local-fallback' : 'api'
  };
}

module.exports = {
  runLifecycleForExternalSystem,
  runMissingVerifyStepsLocally,
  resolveLifecycleAuth
};
