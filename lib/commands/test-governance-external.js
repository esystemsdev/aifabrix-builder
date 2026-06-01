/**
 * @fileoverview test-governance — run governance scenario pack via dataplane API
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { getConfig } = require('../core/config');
const { setupIntegrationTestAuth } = require('../external-system/test-auth');
const { runGovernanceScenarios } = require('../api/governance-scenarios.api');
const {
  resolveGovernancePackPath,
  loadGovernancePackYaml
} = require('../governance/governance-pack-loader');
const { syncLocalIfRequested } = require('./test-e2e-external');

/**
 * @async
 * @param {string} externalSystem
 * @param {Object} options
 * @returns {Promise<{ result: Object, packPath: string, systemKey: string }>}
 */
async function runTestGovernanceForExternalSystem(externalSystem, options = {}) {
  const pathsUtil = require('../utils/paths');
  const appType = await pathsUtil.detectAppType(externalSystem).catch(() => null);
  if (!appType || appType.baseDir !== 'integration') {
    throw new Error(
      'verify-governance applies to external integration folders only (integration/<systemKey>/).'
    );
  }

  const systemKey = externalSystem;
  const packPath = resolveGovernancePackPath(systemKey, {
    pack: options.pack,
    app: options.app
  });
  const pack = loadGovernancePackYaml(packPath);

  const uploadCtx = await syncLocalIfRequested(systemKey, options);

  let authConfig;
  let dataplaneUrl;
  if (uploadCtx) {
    ({ authConfig, dataplaneUrl } = uploadCtx);
  } else {
    const configObj = await getConfig();
    ({ authConfig, dataplaneUrl } = await setupIntegrationTestAuth(
      externalSystem,
      { environment: options.env },
      configObj
    ));
  }

  const body = {
    systemKey,
    pack,
    scenarios: options.scenarioIds
  };
  const result = await runGovernanceScenarios(dataplaneUrl, authConfig, body);
  return { result, packPath, systemKey };
}

module.exports = {
  runTestGovernanceForExternalSystem,
  syncLocalIfRequested
};
