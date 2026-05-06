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

  it('environment endpoints return responses (parallel)', async() => {
    if (!environment) {
      return;
    }
    const [env, status, applications, deployments, roles, datasources] = await Promise.all([
      getEnvironment(controllerUrl, environment, authConfig),
      getEnvironmentStatus(controllerUrl, environment, authConfig),
      listEnvironmentApplications(controllerUrl, environment, authConfig, { pageSize: 10 }),
      listEnvironmentDeployments(controllerUrl, environment, authConfig, { pageSize: 5 }),
      listEnvironmentRoles(controllerUrl, environment, authConfig),
      listEnvironmentDatasources(controllerUrl, environment, authConfig)
    ]);
    expect(env).toBeDefined();
    expect(env.success).toBe(true);
    expect(status).toBeDefined();
    expect(applications).toBeDefined();
    expect(applications.success).toBe(true);
    expect(deployments).toBeDefined();
    expect(deployments.success).toBe(true);
    expect(roles).toBeDefined();
    expect(datasources).toBeDefined();
  });

  it('GET /api/v1/environments/{envKey}/applications/{appKey} returns app when exists', async() => {
    if (!environment) {
      return;
    }

    // This endpoint is environment-scoped; appKey must exist in the environment.
    const listRes = await listEnvironmentApplications(controllerUrl, environment, authConfig, { pageSize: 1 });
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
