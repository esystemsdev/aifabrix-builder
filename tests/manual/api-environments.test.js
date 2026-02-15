/**
 * Manual tests: real API calls to Controller environments API.
 * Requires valid login. Auth is validated in setup.js.
 *
 * @fileoverview Manual tests for environments API
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const {
  listEnvironments,
  getEnvironment,
  getEnvironmentStatus,
  listEnvironmentApplications,
  listEnvironmentDeployments,
  listEnvironmentRoles,
  listEnvironmentDatasources,
  getEnvironmentApplication
} = require('../../lib/api/environments.api');
const { listApplications } = require('../../lib/api/applications.api');

describe('Manual API tests – environments.api (real Controller)', () => {
  let controllerUrl;
  let authConfig;
  let environment;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    controllerUrl = ctx.controllerUrl;
    authConfig = ctx.authConfig;
    environment = ctx.environment;
  });

  it('GET /api/v1/environments returns list', async() => {
    const response = await listEnvironments(controllerUrl, authConfig, { pageSize: 20 });
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
  });

  it('GET /api/v1/environments/{envKey} returns environment', async() => {
    if (!environment) {
      return;
    }
    const response = await getEnvironment(controllerUrl, environment, authConfig);
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
  });

  it('GET /api/v1/environments/{envKey}/status returns response', async() => {
    if (!environment) {
      return;
    }
    const response = await getEnvironmentStatus(controllerUrl, environment, authConfig);
    expect(response).toBeDefined();
  });

  it('GET /api/v1/environments/{envKey}/applications returns list', async() => {
    if (!environment) {
      return;
    }
    const response = await listEnvironmentApplications(controllerUrl, environment, authConfig, { pageSize: 10 });
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
  });

  it('GET /api/v1/environments/{envKey}/deployments returns list', async() => {
    if (!environment) {
      return;
    }
    const response = await listEnvironmentDeployments(controllerUrl, environment, authConfig, { pageSize: 5 });
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
  });

  it('GET /api/v1/environments/{envKey}/roles returns response', async() => {
    if (!environment) {
      return;
    }
    const response = await listEnvironmentRoles(controllerUrl, environment, authConfig);
    expect(response).toBeDefined();
  });

  it('GET /api/v1/environments/{envKey}/datasources returns response', async() => {
    if (!environment) {
      return;
    }
    const response = await listEnvironmentDatasources(controllerUrl, environment, authConfig);
    expect(response).toBeDefined();
  });

  it('GET /api/v1/environments/{envKey}/applications/{appKey} returns app when exists', async() => {
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
    const response = await getEnvironmentApplication(controllerUrl, environment, appKey, authConfig);
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
  });
});
