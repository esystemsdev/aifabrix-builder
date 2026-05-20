/**
 * @fileoverview Dataplane governance scenario acceptance API
 * @author AI Fabrix Team
 * @version 1.0.0
 */

const { createDataplaneApiClient } = require('./index');
const { unwrapApiData } = require('../utils/external-system-readiness-core');

/**
 * Run governance scenario pack (ABAC visibility proof).
 * POST /api/v1/governance/scenarios/run
 * @requiresPermission {Dataplane} governance:evaluate
 * @async
 * @param {string} dataplaneUrl
 * @param {Object} authConfig
 * @param {import('./types/governance-scenarios.types').GovernanceScenariosRunRequest} body
 * @returns {Promise<import('./types/governance-scenarios.types').GovernanceScenariosRunResponse>}
 */
async function runGovernanceScenarios(dataplaneUrl, authConfig, body) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.post('/api/v1/governance/scenarios/run', { body });
  if (res && res.success === false) {
    const msg =
      (res.error && (res.error.formattedError || res.error.error || res.error.message)) ||
      res.formattedError ||
      'Governance scenario run failed';
    throw new Error(msg);
  }
  const unwrapped = unwrapApiData(res);
  if (!unwrapped || !unwrapped.summary) {
    throw new Error('Governance scenario run returned an unexpected response shape');
  }
  return unwrapped;
}

module.exports = {
  runGovernanceScenarios
};
