/**
 * Manual tests: real API calls to Dataplane datasources (core) API.
 * Requires valid login and discoverable Dataplane. Auth is validated in setup.js.
 *
 * @fileoverview Manual tests for datasources-core API (Dataplane)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const {
  listDatasources,
  listAllExecutionLogs,
  getDatasource,
  getDatasourceStatus
} = require('../../lib/api/datasources-core.api');

describe('Manual API tests – datasources-core.api (real Dataplane)', () => {
  let dataplaneUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
  });

  it('GET /api/v1/external/ returns response when Dataplane available', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const response = await listDatasources(dataplaneUrl, authConfig, { pageSize: 10 });
    expect(response).toBeDefined();
  });

  it('GET /api/v1/external/executions returns response when Dataplane available', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const response = await listAllExecutionLogs(dataplaneUrl, authConfig, { pageSize: 5 });
    expect(response).toBeDefined();
  });

  it('GET /api/v1/external/{sourceKey} returns datasource when exists', async() => {
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
    const response = await getDatasource(dataplaneUrl, sourceKey, authConfig);
    expect(response).toBeDefined();
  });

  it('GET /api/v1/external/{sourceKey}/status returns response when datasource exists', async() => {
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
    const response = await getDatasourceStatus(dataplaneUrl, sourceKey, authConfig);
    expect(response).toBeDefined();
  });
});
