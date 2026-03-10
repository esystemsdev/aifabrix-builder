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

    it('auth endpoints return responses (parallel)', async() => {
      const token = authConfig.token || authConfig.bearer;
      expect(token).toBeDefined();
      const [clientToken, login, roles, rolesRefresh, permissions, permissionsRefresh, validate, diagnostics, deviceCode] = await Promise.all([
        getClientToken(controllerUrl, 'POST'),
        getAuthLogin(controllerUrl, 'http://localhost/callback', undefined, authConfig),
        getAuthRoles(controllerUrl, authConfig, environment, undefined),
        refreshAuthRoles(controllerUrl, authConfig),
        getAuthPermissions(controllerUrl, authConfig, environment, undefined),
        refreshAuthPermissions(controllerUrl, authConfig),
        validateToken(token, controllerUrl, authConfig, environment, undefined),
        getAuthLoginDiagnostics(controllerUrl, environment),
        initiateDeviceCodeFlow(controllerUrl, environment)
      ]);
      expect(clientToken).toBeDefined();
      expect(login).toBeDefined();
      expect(roles).toBeDefined();
      expect(rolesRefresh).toBeDefined();
      expect(permissions).toBeDefined();
      expect(permissionsRefresh).toBeDefined();
      expect(validate).toBeDefined();
      expect(diagnostics).toBeDefined();
      expect(deviceCode).toBeDefined();
    });
  });

  describe('applications.api', () => {
    it('GET /api/v1/applications returns list', async() => {
      const response = await listApplications(controllerUrl, authConfig, { pageSize: 10 });
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data) || (response.data && typeof response.data === 'object')).toBe(true);
    });

    it('GET application by key and status when app exists (parallel)', async() => {
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
      const [appResponse, statusResponse] = await Promise.all([
        getApplication(controllerUrl, appKey, authConfig),
        environment ? getApplicationStatus(controllerUrl, environment, appKey, authConfig) : Promise.resolve(null)
      ]);
      expect(appResponse).toBeDefined();
      expect(appResponse.success).toBe(true);
      if (environment && statusResponse !== null) {
        expect(statusResponse).toBeDefined();
      }
    });
  });
});
