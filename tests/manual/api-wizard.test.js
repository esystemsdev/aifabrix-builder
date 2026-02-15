/**
 * Manual tests: real API calls to Dataplane wizard API.
 * Requires valid login and discoverable Dataplane. Auth is validated in setup.js.
 *
 * @fileoverview Manual tests for wizard API (Dataplane)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const { getWizardPlatforms, listWizardCredentials } = require('../../lib/api/wizard.api');

describe('Manual API tests – wizard.api (real Dataplane)', () => {
  let dataplaneUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
  });

  it('GET /api/v1/wizard/platforms returns platforms when Dataplane available', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const platforms = await getWizardPlatforms(dataplaneUrl, authConfig);
    expect(Array.isArray(platforms)).toBe(true);
  });

  it('GET /api/v1/wizard/credentials returns response when Dataplane available', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const response = await listWizardCredentials(dataplaneUrl, authConfig, { pageSize: 10 });
    expect(response).toBeDefined();
  });
});
