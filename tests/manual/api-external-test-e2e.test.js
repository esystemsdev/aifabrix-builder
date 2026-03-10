/**
 * Manual tests: real API calls to Dataplane external test E2E API.
 * Requires valid login (Bearer or API key; client credentials not supported) and Dataplane.
 * Uses sync mode (asyncRun: false) for a single request/response smoke test.
 *
 * @fileoverview Manual tests for external-test.api (test-e2e, getE2ETestRun)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const { listDatasources } = require('../../lib/api/datasources-core.api');
const { testDatasourceE2E, getE2ETestRun } = require('../../lib/api/external-test.api');

describe('Manual API tests – external-test.api (E2E, real Dataplane)', () => {
  let dataplaneUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
  });

  it('POST test-e2e (sync) returns response when Dataplane and datasource exist', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const listRes = await listDatasources(dataplaneUrl, authConfig, { pageSize: 1 });
    if (!listRes?.success) {
      return;
    }
    const items = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.items ?? listRes.data?.data ?? []);
    if (items.length === 0) {
      return;
    }
    const sourceKey = items[0].key ?? items[0].id ?? items[0].sourceKey;
    if (!sourceKey) {
      return;
    }
    const response = await testDatasourceE2E(dataplaneUrl, sourceKey, authConfig, {}, { asyncRun: false });
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  it('GET test-e2e/{testRunId} returns 404 or poll body for unknown run', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const listRes = await listDatasources(dataplaneUrl, authConfig, { pageSize: 1 });
    if (!listRes?.success) {
      return;
    }
    const items = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.items ?? listRes.data?.data ?? []);
    const sourceKey = items.length > 0 ? (items[0].key ?? items[0].id ?? items[0].sourceKey) : 'test-datasource';
    try {
      await getE2ETestRun(dataplaneUrl, sourceKey, 'non-existent-run-id', authConfig);
    } catch (err) {
      expect(err.message).toMatch(/not found|expired|404/);
    }
  });
});
