/**
 * Manual tests: dataplane trust/certificates APIs (real dataplane).
 * Requires valid login and dataplane URL; auth validated in tests/manual/setup.js.
 *
 * @fileoverview Manual API tests for certificates.api
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { getManualTestAuth } = require('./require-auth');
const { listDatasources } = require('../../lib/api/datasources-core.api');
const {
  getActiveIntegrationCertificate,
  listIntegrationCertificates
} = require('../../lib/api/certificates.api');

function normalizeListItems(listRes) {
  if (!listRes?.success) return [];
  return Array.isArray(listRes.data) ? listRes.data : (listRes.data?.items ?? listRes.data?.data ?? []);
}

describe('Manual API tests – certificates.api (real Dataplane)', () => {
  let dataplaneUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
  });

  it('GET /api/v1/certificates returns an envelope', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const res = await listIntegrationCertificates(dataplaneUrl, authConfig, { pageSize: 1 });
    expect(res).toBeDefined();
    expect(typeof res.success).toBe('boolean');
  });

  it('GET active certificate for a datasource returns success or notfound envelope', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const listRes = await listDatasources(dataplaneUrl, authConfig, { pageSize: 1 });
    const items = normalizeListItems(listRes);
    if (items.length === 0) {
      return;
    }
    const datasourceKey = items[0].key ?? items[0].id ?? items[0].sourceKey;
    const systemKey = items[0].systemKey ?? items[0].systemIdOrKey;
    if (!datasourceKey || !systemKey) {
      return;
    }
    const res = await getActiveIntegrationCertificate(dataplaneUrl, authConfig, systemKey, datasourceKey);
    expect(res).toBeDefined();
    expect(typeof res.success).toBe('boolean');
    if (res.success) {
      expect(res.data).toBeDefined();
      return;
    }
    const httpStatus = Number(res.status) || 0;
    expect([0, 401, 403, 404]).toContain(httpStatus);
  });
});

