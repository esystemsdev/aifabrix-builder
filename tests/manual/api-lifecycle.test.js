/**
 * Manual tests: real Dataplane lifecycle certification API (419.0).
 * Requires valid login and a published external system on the dataplane.
 *
 * @fileoverview Manual tests for lifecycle.api (Dataplane)
 */

'use strict';

const { getManualTestAuth } = require('./require-auth');
const {
  normalizeListItems,
  systemKeyFromItem
} = require('./certification-helpers');
const { listExternalSystems } = require('../../lib/api/external-systems.api');
const {
  getSystemLifecycleReport,
  runSystemLifecycle
} = require('../../lib/api/lifecycle.api');

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
    const items = normalizeListItems(listRes);
    if (items.length === 0) {
      return;
    }
    const systemKey = systemKeyFromItem(items[0]);
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

  it('GET lifecycle with details=true returns pillar blocks when dataplane provides them', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const listRes = await listExternalSystems(dataplaneUrl, authConfig, { pageSize: 1 });
    const items = normalizeListItems(listRes);
    if (items.length === 0) {
      return;
    }
    const systemKey = systemKeyFromItem(items[0]);
    if (!systemKey) {
      return;
    }

    const report = await getSystemLifecycleReport(dataplaneUrl, authConfig, systemKey, {
      details: true
    });
    expect(report.systemKey).toBe(systemKey);
    expect(report.certification).toBeDefined();
    const hasPillar =
      report.operations !== undefined ||
      report.trust !== undefined ||
      report.governance !== undefined;
    expect(hasPillar || report.datasources !== undefined).toBe(true);
  });

  it('POST lifecycle/run returns report envelope when MANUAL_CERTIFICATION_LIFECYCLE_RUN=1', async() => {
    if (process.env.MANUAL_CERTIFICATION_LIFECYCLE_RUN !== '1' || !dataplaneUrl) {
      return;
    }
    const listRes = await listExternalSystems(dataplaneUrl, authConfig, { pageSize: 1 });
    const items = normalizeListItems(listRes);
    if (items.length === 0) {
      return;
    }
    const systemKey = systemKeyFromItem(items[0]);
    if (!systemKey) {
      return;
    }

    const runRes = await runSystemLifecycle(dataplaneUrl, authConfig, systemKey, {});
    expect(runRes.report).toBeDefined();
    expect(runRes.report.systemKey).toBe(systemKey);
  });
});
