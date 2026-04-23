/**
 * Manual tests: unified dataplane validation API (same path as `aifabrix datasource test`).
 * Requires valid login and Dataplane; auth validated in tests/manual/setup.js.
 *
 * @fileoverview Manual tests for validation-run.api (POST + optional GET poll)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const { listDatasources, getDatasource } = require('../../lib/api/datasources-core.api');
const { postValidationRun, getValidationRun } = require('../../lib/api/validation-run.api');
const { buildExternalDataSourceValidationRequest } = require('../../lib/utils/validation-run-request');

function normalizeListItems(listRes) {
  if (!listRes?.success) return [];
  return Array.isArray(listRes.data) ? listRes.data : (listRes.data?.items ?? listRes.data?.data ?? []);
}

describe('Manual API tests – validation-run.api (unified validation, real Dataplane)', () => {
  let dataplaneUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
  });

  it('POST validation run (runType=test, sync) returns DatasourceTestRun when a datasource exists', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const listRes = await listDatasources(dataplaneUrl, authConfig, { pageSize: 1 });
    const items = normalizeListItems(listRes);
    if (items.length === 0) {
      return;
    }
    const datasourceKey = items[0].key ?? items[0].id ?? items[0].sourceKey;
    if (!datasourceKey) {
      return;
    }
    let systemKey = items[0].systemKey ?? items[0].systemIdOrKey;
    if (!systemKey) {
      const dsRes = await getDatasource(dataplaneUrl, datasourceKey, authConfig);
      if (!dsRes?.success || !dsRes.data) {
        return;
      }
      systemKey = dsRes.data.systemKey ?? dsRes.data.systemIdOrKey;
    }
    if (!systemKey) {
      return;
    }
    const body = buildExternalDataSourceValidationRequest({
      systemKey,
      datasourceKey,
      runType: 'test',
      asyncRun: false
    });
    const response = await postValidationRun(dataplaneUrl, authConfig, body);
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data.status !== undefined || response.data.reportVersion !== undefined).toBe(true);
  });

  it('GET validation run/{id} handles unknown run id (404 or error envelope)', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const res = await getValidationRun(dataplaneUrl, authConfig, 'manual-test-nonexistent-run-id');
    expect(res).toBeDefined();
    if (res.success) {
      expect(res.data).toBeDefined();
      return;
    }
    const httpStatus = Number(res.status) || 0;
    const ed = res.errorData && typeof res.errorData === 'object' ? res.errorData : {};
    const detail = String(ed.detail || ed.title || ed.message || '').toLowerCase();
    const msg = String(res.formattedError || res.error || res.message || '').toLowerCase();
    const combined = `${msg} ${detail} ${JSON.stringify(ed).toLowerCase()}`;
    const bodyStatus = Number(ed.statusCode ?? ed.status);
    const looksNotFound =
      httpStatus === 404 ||
      bodyStatus === 404 ||
      res.errorType === 'notfound' ||
      combined.includes('not found') ||
      combined.includes('expired') ||
      combined.includes('"404"') ||
      /\b404\b/.test(combined);
    expect(looksNotFound).toBe(true);
  });
});
