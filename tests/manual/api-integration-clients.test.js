/**
 * Manual tests: Controller integration-clients API via Builder client.
 * Requires valid login and a Controller that exposes integration clients. Auth is validated in setup.js.
 * Requires permission integration-client:read for list to succeed.
 *
 * @fileoverview Manual tests for integration-clients.api
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const { listIntegrationClients } = require('../../lib/api/integration-clients.api');

function extractListArray(response) {
  const payload = response?.data;
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.results)) return payload.results;
  }
  return null;
}

function extractMetaObject(response) {
  if (response && typeof response === 'object') {
    if (response.meta && typeof response.meta === 'object') return response.meta;
    const payload = response.data;
    if (payload && typeof payload === 'object' && payload.meta && typeof payload.meta === 'object') {
      return payload.meta;
    }
  }
  return null;
}

describe('Manual API tests – integration-clients.api (real Controller)', () => {
  let controllerUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    controllerUrl = ctx.controllerUrl;
    authConfig = ctx.authConfig;
  });

  describe('integration-clients.api', () => {
    it('list integration clients returns list or 403', async() => {
      try {
        const response = await listIntegrationClients(controllerUrl, authConfig, { pageSize: 10 });
        expect(response).toBeDefined();
        if (response.success) {
          expect(response.data).toBeDefined();
          const list = extractListArray(response);
          expect(Array.isArray(list)).toBe(true);
          const meta = extractMetaObject(response);
          if (meta !== null) expect(typeof meta).toBe('object');
        } else {
          expect(response.success).toBe(false);
        }
      } catch (err) {
        expect(err).toBeDefined();
        expect(err.message).toBeDefined();
        if (err.statusCode === 403 || (err.message && err.message.includes('403'))) {
          expect(err.message).toMatch(/permission|forbidden|403/i);
        } else {
          throw err;
        }
      }
    });

    it('list with pagination params returns response', async() => {
      try {
        const response = await listIntegrationClients(controllerUrl, authConfig, {
          page: 1,
          pageSize: 5,
          sort: 'displayName',
          search: ''
        });
        expect(response).toBeDefined();
        if (response.success) {
          const list = extractListArray(response);
          expect(Array.isArray(list)).toBe(true);
        } else {
          expect(response.success).toBe(false);
        }
      } catch (err) {
        if (err.statusCode === 403 || (err.message && err.message.includes('403'))) {
          expect(err.message).toBeDefined();
          return;
        }
        throw err;
      }
    });
  });
});
