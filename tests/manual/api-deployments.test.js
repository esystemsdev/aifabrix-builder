/**
 * Manual tests: real API calls to Controller deployments API.
 * Requires valid login. Auth is validated in setup.js.
 *
 * @fileoverview Manual tests for deployments API
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const { listDeployments, listApplicationDeployments, getDeployment, getDeploymentLogs } = require('../../lib/api/deployments.api');
const { listApplications } = require('../../lib/api/applications.api');

describe('Manual API tests – deployments.api (real Controller)', () => {
  let controllerUrl;
  let authConfig;
  let environment;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    controllerUrl = ctx.controllerUrl;
    authConfig = ctx.authConfig;
    environment = ctx.environment;
  });

  it('GET /api/v1/environments/{envKey}/deployments returns list', async() => {
    if (!environment) {
      return;
    }
    const response = await listDeployments(controllerUrl, environment, authConfig, { pageSize: 10 });
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
  });

  it('GET /api/v1/environments/{envKey}/applications/{appKey}/deployments returns list', async() => {
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
    const response = await listApplicationDeployments(controllerUrl, environment, appKey, authConfig, { pageSize: 5 });
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
  });

  it('GET /api/v1/environments/{envKey}/deployments/{id} returns deployment when exists', async() => {
    if (!environment) {
      return;
    }
    const listRes = await listDeployments(controllerUrl, environment, authConfig, { pageSize: 1 });
    if (!listRes?.success) {
      return;
    }
    const items = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.items ?? listRes.data?.data ?? []);
    if (items.length === 0) {
      return;
    }
    const deploymentId = items[0].id ?? items[0].deploymentId;
    if (!deploymentId) {
      return;
    }
    const response = await getDeployment(controllerUrl, environment, deploymentId, authConfig);
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
  });

  it('GET /api/v1/environments/{envKey}/deployments/{id}/logs returns logs when deployment exists', async() => {
    if (!environment) {
      return;
    }
    const listRes = await listDeployments(controllerUrl, environment, authConfig, { pageSize: 1 });
    if (!listRes?.success) {
      return;
    }
    const items = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.items ?? listRes.data?.data ?? []);
    if (items.length === 0) {
      return;
    }
    const deploymentId = items[0].id ?? items[0].deploymentId;
    if (!deploymentId) {
      return;
    }
    const response = await getDeploymentLogs(controllerUrl, environment, deploymentId, authConfig, { pageSize: 5 });
    expect(response).toBeDefined();
  });
});
