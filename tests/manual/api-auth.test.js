/**
 * Manual tests: real API calls to Controller (auth and applications).
 * Requires valid login (aifabrix login or client credentials). Auth is validated in setup.js.
 *
 * @fileoverview Manual tests for auth and applications APIs
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const {
  getAuthUser,
  getClientToken,
  getAuthLogin,
  getAuthRoles,
  refreshAuthRoles,
  getAuthPermissions,
  refreshAuthPermissions,
  validateToken,
  getAuthLoginDiagnostics,
  initiateDeviceCodeFlow
} = require('../../lib/api/auth.api');
const { listApplications, getApplication, getApplicationStatus } = require('../../lib/api/applications.api');

describe('Manual API tests (real Controller)', () => {
  let controllerUrl;
  let authConfig;
  let environment;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    controllerUrl = ctx.controllerUrl;
    authConfig = ctx.authConfig;
    environment = ctx.environment;
  });

  describe('auth.api', () => {
    it('GET /api/v1/auth/user returns current user', async() => {
      const response = await getAuthUser(controllerUrl, authConfig);
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.authenticated).not.toBe(false);
    });

    it('POST /api/v1/auth/client-token returns response', async() => {
      const response = await getClientToken(controllerUrl, 'POST');
      expect(response).toBeDefined();
    });

    it('GET /api/v1/auth/login returns response', async() => {
      const response = await getAuthLogin(controllerUrl, 'http://localhost/callback', undefined, authConfig);
      expect(response).toBeDefined();
    });

    it('GET /api/v1/auth/roles returns response', async() => {
      const response = await getAuthRoles(controllerUrl, authConfig, environment, undefined);
      expect(response).toBeDefined();
    });

    it('GET /api/v1/auth/roles/refresh returns response', async() => {
      const response = await refreshAuthRoles(controllerUrl, authConfig);
      expect(response).toBeDefined();
    });

    it('GET /api/v1/auth/permissions returns response', async() => {
      const response = await getAuthPermissions(controllerUrl, authConfig, environment, undefined);
      expect(response).toBeDefined();
    });

    it('GET /api/v1/auth/permissions/refresh returns response', async() => {
      const response = await refreshAuthPermissions(controllerUrl, authConfig);
      expect(response).toBeDefined();
    });

    it('POST /api/v1/auth/validate returns response', async() => {
      const token = authConfig.token || authConfig.bearer;
      expect(token).toBeDefined();
      const response = await validateToken(token, controllerUrl, authConfig, environment, undefined);
      expect(response).toBeDefined();
    });

    it('GET /api/v1/auth/login/diagnostics returns diagnostics', async() => {
      const response = await getAuthLoginDiagnostics(controllerUrl, environment);
      expect(response).toBeDefined();
    });

    it('POST /api/v1/auth/login (device code) initiates flow', async() => {
      const response = await initiateDeviceCodeFlow(controllerUrl, environment);
      expect(response).toBeDefined();
    });
  });

  describe('applications.api', () => {
    it('GET /api/v1/applications returns list', async() => {
      const response = await listApplications(controllerUrl, authConfig, { pageSize: 10 });
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data) || (response.data && typeof response.data === 'object')).toBe(true);
    });

    it('GET /api/v1/applications/{appKey} returns application when key exists', async() => {
      const listRes = await listApplications(controllerUrl, authConfig, { pageSize: 1 });
      expect(listRes).toBeDefined();
      expect(listRes.success).toBe(true);
      const items = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.items ?? listRes.data?.data ?? []);
      if (items.length === 0) {
        return;
      }
      const appKey = items[0].key ?? items[0].appKey ?? items[0].id;
      if (!appKey) {
        return;
      }
      const response = await getApplication(controllerUrl, appKey, authConfig);
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });

    it('GET /api/v1/environments/{envKey}/applications/{appKey}/status returns status when app exists', async() => {
      if (!environment) {
        return;
      }
      const listRes = await listApplications(controllerUrl, authConfig, { pageSize: 1 });
      if (!listRes?.success) {
        return;
      }
      const items = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.items ?? listRes.data?.data ?? []);
      if (items.length === 0) {
        return;
      }
      const appKey = items[0].key ?? items[0].appKey ?? items[0].id;
      if (!appKey) {
        return;
      }
      const response = await getApplicationStatus(controllerUrl, environment, appKey, authConfig);
      expect(response).toBeDefined();
    });
  });
});
