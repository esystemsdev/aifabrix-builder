/**
 * @fileoverview Dataplane governance scenario pack CRUD + run API (419.0).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { createDataplaneApiClient } = require('./index');
const { unwrapApiData } = require('../utils/external-system-readiness-core');

/**
 * PUT /api/v1/external/{datasourceKey}/governance-scenarios
 * @requiresPermission {Dataplane} external-data-source:update
 * @async
 */
async function upsertDatasourceGovernancePack(dataplaneUrl, authConfig, datasourceKey, pack) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.put(
    `/api/v1/external/${encodeURIComponent(datasourceKey)}/governance-scenarios`,
    { body: { pack } }
  );
  if (res && res.success === false) {
    const msg =
      (res.error && (res.error.formattedError || res.error.error || res.error.message)) ||
      res.formattedError ||
      'Governance scenario pack upload failed';
    throw new Error(msg);
  }
  return unwrapApiData(res);
}

/**
 * GET /api/v1/external/{datasourceKey}/governance-scenarios
 * @requiresPermission {Dataplane} external-data-source:read
 * @async
 */
async function getDatasourceGovernancePack(dataplaneUrl, authConfig, datasourceKey) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.get(
    `/api/v1/external/${encodeURIComponent(datasourceKey)}/governance-scenarios`
  );
  if (res && res.success === false) {
    const msg =
      (res.error && (res.error.formattedError || res.error.error || res.error.message)) ||
      res.formattedError ||
      'Governance scenario pack fetch failed';
    throw new Error(msg);
  }
  return unwrapApiData(res);
}

/**
 * POST /api/v1/external/{datasourceKey}/governance-scenarios/run
 * @requiresPermission {Dataplane} governance:evaluate
 * @async
 */
async function runDatasourceGovernanceScenarios(dataplaneUrl, authConfig, datasourceKey) {
  const client = createDataplaneApiClient(dataplaneUrl, authConfig);
  const res = await client.post(
    `/api/v1/external/${encodeURIComponent(datasourceKey)}/governance-scenarios/run`,
    { body: {} }
  );
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
  upsertDatasourceGovernancePack,
  getDatasourceGovernancePack,
  runDatasourceGovernanceScenarios
};
