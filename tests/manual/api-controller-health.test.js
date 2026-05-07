/**
 * Manual tests: controller public health endpoint (no auth).
 *
 * @fileoverview Manual API tests for controller-health.api
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { getManualTestAuth } = require('./require-auth');
const { getControllerDeploymentType } = require('../../lib/api/controller-health.api');

describe('Manual API tests (real Controller) — controller health', () => {
  let controllerUrl;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    controllerUrl = ctx.controllerUrl;
  });

  it('GET /api/v1/health returns deployment type (or undefined)', async() => {
    const dt = await getControllerDeploymentType(controllerUrl);
    if (dt === undefined || dt === null) {
      return;
    }
    expect(typeof dt).toBe('string');
    expect(dt.length).toBeGreaterThan(0);
  });
});

