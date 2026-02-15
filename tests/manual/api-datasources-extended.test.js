/**
 * Manual tests: real API calls to Dataplane datasources extended API (records, grants).
 * Requires valid login and discoverable Dataplane. Auth is validated in setup.js.
 *
 * @fileoverview Manual tests for datasources-extended API (Dataplane)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const { listDatasources } = require('../../lib/api/datasources-core.api');
const { listRecords, listGrants } = require('../../lib/api/datasources-extended.api');

describe('Manual API tests – datasources-extended.api (real Dataplane)', () => {
  let dataplaneUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
  });

  it('GET /api/v1/external/{sourceKey}/records returns response when datasource exists', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const listRes = await listDatasources(dataplaneUrl, authConfig, { pageSize: 1 });
    if (!listRes) {
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
    const response = await listRecords(dataplaneUrl, sourceKey, authConfig, { pageSize: 5 });
    expect(response).toBeDefined();
  });

  it('GET /api/v1/external/{sourceKey}/grants returns response when datasource exists', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const listRes = await listDatasources(dataplaneUrl, authConfig, { pageSize: 1 });
    if (!listRes) {
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
    const response = await listGrants(dataplaneUrl, sourceKey, authConfig, { pageSize: 5 });
    expect(response).toBeDefined();
  });
});
