/**
 * Manual tests: governance scenario pack API (plan 150.0 / dataplane 419.0).
 * Requires valid login and at least one datasource on the dataplane.
 *
 * @fileoverview Manual tests for governance-scenario-pack.api (real Dataplane)
 */

'use strict';

const { getManualTestAuth } = require('./require-auth');
const {
  resolveCertificationSystemKey,
  resolveFirstDatasourceKey
} = require('./certification-helpers');
const {
  getDatasourceGovernancePack,
  runDatasourceGovernanceScenarios
} = require('../../lib/api/governance-scenario-pack.api');

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function looksLikeMissingPack(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('not found') ||
    msg.includes('404') ||
    msg.includes('no pack') ||
    msg.includes('no scenario')
  );
}

describe('Manual API tests – governance-scenario-pack.api (real Dataplane)', () => {
  let dataplaneUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
  });

  it('GET governance-scenarios returns pack or skips when none uploaded', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const systemKey = await resolveCertificationSystemKey(dataplaneUrl, authConfig);
    const datasourceKey = await resolveFirstDatasourceKey(dataplaneUrl, authConfig, systemKey);
    if (!datasourceKey) {
      return;
    }

    let packRow;
    try {
      packRow = await getDatasourceGovernancePack(dataplaneUrl, authConfig, datasourceKey);
    } catch (err) {
      if (looksLikeMissingPack(err)) {
        return;
      }
      throw err;
    }

    expect(packRow).toBeDefined();
    const pack = packRow.pack ?? packRow;
    expect(pack).toBeDefined();
  });

  it('POST governance-scenarios/run returns summary when a pack exists', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const systemKey = await resolveCertificationSystemKey(dataplaneUrl, authConfig);
    const datasourceKey = await resolveFirstDatasourceKey(dataplaneUrl, authConfig, systemKey);
    if (!datasourceKey) {
      return;
    }

    let packRow;
    try {
      packRow = await getDatasourceGovernancePack(dataplaneUrl, authConfig, datasourceKey);
    } catch (err) {
      if (looksLikeMissingPack(err)) {
        return;
      }
      throw err;
    }

    const pack = packRow.pack ?? packRow;
    const scenarios =
      pack?.spec?.scenarios ?? pack?.scenarios ?? packRow?.scenarios ?? [];
    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return;
    }

    const runRes = await runDatasourceGovernanceScenarios(dataplaneUrl, authConfig, datasourceKey);
    expect(runRes.summary).toBeDefined();
    expect(typeof runRes.summary.total === 'number' || runRes.summary.passed !== undefined).toBe(true);
  });
});
