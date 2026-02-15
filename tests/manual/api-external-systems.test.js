/**
 * Manual tests: real API calls to Dataplane external systems API.
 * Requires valid login and discoverable Dataplane. Auth is validated in setup.js.
 *
 * @fileoverview Manual tests for external-systems API (Dataplane)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const { listExternalSystems, getExternalSystem } = require('../../lib/api/external-systems.api');

describe('Manual API tests – external-systems.api (real Dataplane)', () => {
  let dataplaneUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
  });

  it('GET /api/v1/external/systems returns response when Dataplane available', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const response = await listExternalSystems(dataplaneUrl, authConfig, { pageSize: 10 });
    expect(response).toBeDefined();
  });

  it('GET /api/v1/external/systems/{key} returns system when exists', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const listRes = await listExternalSystems(dataplaneUrl, authConfig, { pageSize: 1 });
    if (!listRes?.success) {
      return;
    }
    const items = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.items ?? listRes.data?.data ?? []);
    if (items.length === 0) {
      return;
    }
    const systemKey = items[0].key ?? items[0].id ?? items[0].systemKey;
    if (!systemKey) {
      return;
    }
    const response = await getExternalSystem(dataplaneUrl, systemKey, authConfig);
    expect(response).toBeDefined();
  });
});
