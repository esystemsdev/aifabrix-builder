/**
 * Manual tests: real API calls to Controller (dimensions + dimension values).
 * Requires valid login. Auth is validated in tests/manual/setup.js.
 *
 * @fileoverview Manual API tests for dimensions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { getManualTestAuth } = require('./require-auth');
const { createDimensionIdempotent, getDimension, listDimensions } = require('../../lib/api/dimensions.api');
const {
  createDimensionValue,
  listDimensionValues,
  deleteDimensionValue
} = require('../../lib/api/dimension-values.api');

function unwrap(res) {
  // Controller APIs in this repo sometimes return:
  // - axios-like: { data: { data: ... } }
  // - builder ApiClient: { success: true, data: ... }
  // - plain objects: ...
  if (res && typeof res === 'object') {
    if (res.success === true && res.data !== undefined) {
      if (res.data && typeof res.data === 'object' && res.data.data !== undefined) return res.data.data;
      return res.data;
    }
    if (res.data && typeof res.data === 'object') {
      if (res.data.success === true && res.data.data !== undefined) return res.data.data;
      if (res.data.data !== undefined) return res.data.data;
      return res.data;
    }
  }
  return res;
}

describe('Manual API tests (real Controller) — dimensions', () => {
  let controllerUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    controllerUrl = ctx.controllerUrl;
    authConfig = ctx.authConfig;
  });

  it('create/get/list dimension and create/list values', async() => {
    const key = `manualTestDim${Date.now()}`;
    const createOut = await createDimensionIdempotent(controllerUrl, authConfig, {
      key,
      displayName: `Manual Test Dim ${key}`,
      description: 'Created by tests/manual/api-dimensions.test.js',
      dataType: 'string',
      isRequired: false
    });
    expect(createOut).toBeDefined();

    const dimGetRes = await getDimension(controllerUrl, authConfig, key, { includeValues: true });
    const dim = unwrap(dimGetRes);
    expect(dim).toBeDefined();
    expect(dim.key).toBe(key);

    const listRes = await listDimensions(controllerUrl, authConfig, { pageSize: 10, search: key });
    const listPayload = unwrap(listRes);
    const items = listPayload?.data ?? listPayload?.items ?? listPayload ?? [];
    expect(Array.isArray(items)).toBe(true);

    const v1 = await createDimensionValue(controllerUrl, authConfig, key, { value: 'emea', displayName: 'EMEA' });
    const v2 = await createDimensionValue(controllerUrl, authConfig, key, { value: 'na', displayName: 'North America' });
    expect(unwrap(v1)?.value).toBe('emea');
    expect(unwrap(v2)?.value).toBe('na');

    const valuesListRes = await listDimensionValues(controllerUrl, authConfig, key, { pageSize: 100 });
    const valuesPayload = unwrap(valuesListRes);
    const values = valuesPayload?.data ?? valuesPayload?.items ?? valuesPayload ?? [];
    expect(Array.isArray(values)).toBe(true);
    const got = new Set(values.map((x) => String(x?.value || '')));
    expect(got.has('emea')).toBe(true);
    expect(got.has('na')).toBe(true);

    const dimGetRes2 = await getDimension(controllerUrl, authConfig, key, { includeValues: true });
    const dim2 = unwrap(dimGetRes2);
    const dimValues = Array.isArray(dim2?.dimensionValues) ? dim2.dimensionValues : [];
    const got2 = new Set(dimValues.map((x) => String(x?.value || '')));
    expect(got2.has('emea')).toBe(true);
    expect(got2.has('na')).toBe(true);

    // Best-effort cleanup (requires ids; skip if the API doesn't return them).
    for (const row of values) {
      const value = String(row?.value || '');
      if (value !== 'emea' && value !== 'na') continue;
      const id = row?.id || row?.dimensionValueId;
      if (!id) continue;
      await deleteDimensionValue(controllerUrl, authConfig, String(id));
    }
  });
});

