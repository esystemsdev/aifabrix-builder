/**
 * Manual tests: real Dataplane lifecycle certification API (419.0).
 * Requires valid login and a published external system on the dataplane.
 *
 * @fileoverview Manual tests for lifecycle.api (Dataplane)
 */

'use strict';

const { getManualTestAuth } = require('./require-auth');
const { listExternalSystems } = require('../../lib/api/external-systems.api');
const { getSystemLifecycleReport } = require('../../lib/api/lifecycle.api');

describe('Manual API tests – lifecycle.api (real Dataplane)', () => {
  let dataplaneUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
  });

  it('GET /api/v1/external/systems/{key}/lifecycle returns certification report', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const listRes = await listExternalSystems(dataplaneUrl, authConfig, { pageSize: 1 });
    if (!listRes?.success) {
      return;
    }
    const items = Array.isArray(listRes.data)
      ? listRes.data
      : (listRes.data?.items ?? listRes.data?.data ?? []);
    if (items.length === 0) {
      return;
    }
    const systemKey = items[0].key ?? items[0].id ?? items[0].systemKey;
    if (!systemKey) {
      return;
    }

    const report = await getSystemLifecycleReport(dataplaneUrl, authConfig, systemKey, {
      summary: true
    });
    expect(report).toBeDefined();
    expect(report.systemKey).toBe(systemKey);
    expect(report.certification).toBeDefined();
    expect(report.certification.level).toBeDefined();
  });
});
