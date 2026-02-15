/**
 * Manual tests: real API calls to Dataplane credentials API.
 * Requires valid login and discoverable Dataplane. Auth is validated in setup.js.
 *
 * @fileoverview Manual tests for credentials API (Dataplane)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getManualTestAuth } = require('./require-auth');
const { listCredentials } = require('../../lib/api/credentials.api');

describe('Manual API tests – credentials.api (real Dataplane)', () => {
  let dataplaneUrl;
  let authConfig;

  beforeAll(async() => {
    const ctx = await getManualTestAuth();
    dataplaneUrl = ctx.dataplaneUrl;
    authConfig = ctx.authConfig;
  });

  it('GET /api/v1/credential returns response when Dataplane available', async() => {
    if (!dataplaneUrl) {
      return;
    }
    const response = await listCredentials(dataplaneUrl, authConfig, { pageSize: 10 });
    expect(response).toBeDefined();
  });
});
