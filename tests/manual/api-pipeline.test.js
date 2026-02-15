/**
 * Manual tests: real API calls to Controller pipeline API.
 * Requires valid login. Auth is validated in setup.js.
 *
 * @fileoverview Manual tests for pipeline API
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const { getPipelineHealth, getPipelineDeployment, validatePipeline } = require('../../lib/api/pipeline.api');
const { listDeployments } = require('../../lib/api/deployments.api');

describe('Manual API tests – pipeline.api (real Controller)', () => {
  let controllerUrl;
  let authConfig;
  let environment;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    controllerUrl = ctx.controllerUrl;
    authConfig = ctx.authConfig;
    environment = ctx.environment;
  });

  it('GET /api/v1/pipeline/{envKey}/health returns health', async() => {
    if (!environment) {
      return;
    }
    const response = await getPipelineHealth(controllerUrl, environment);
    expect(response).toBeDefined();
  });

  it('POST /api/v1/pipeline/{envKey}/validate returns response', async() => {
    if (!environment) {
      return;
    }
    const response = await validatePipeline(controllerUrl, environment, authConfig, {});
    expect(response).toBeDefined();
  });

  it('GET /api/v1/pipeline/{envKey}/deployments/{id} returns deployment when exists', async() => {
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
    const response = await getPipelineDeployment(controllerUrl, environment, deploymentId, authConfig);
    expect(response).toBeDefined();
  });
});
