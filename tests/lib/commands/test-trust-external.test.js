/**
 * @fileoverview Tests for lib/commands/test-trust-external.js
 */

const path = require('path');

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/commands/upload', () => ({
  uploadExternalSystem: jest.fn().mockResolvedValue({
    authConfig: { type: 'bearer', token: 't' },
    dataplaneUrl: 'http://localhost:3201',
    environment: 'dev'
  })
}));
jest.mock('../../../lib/datasource/agent-trust-run', () => ({
  runDatasourceAgentTrust: jest.fn()
}));
jest.mock('../../../lib/commands/test-e2e-external', () => ({
  resolveExternalIntegrationContext: jest.fn()
}));
jest.mock('../../../lib/external-system/test-auth', () => ({
  setupIntegrationTestAuth: jest.fn().mockResolvedValue({
    authConfig: { type: 'bearer', token: 't' },
    dataplaneUrl: 'http://localhost:3201'
  })
}));

const logger = require('../../../lib/utils/logger');
const { uploadExternalSystem } = require('../../../lib/commands/upload');
const { runDatasourceAgentTrust } = require('../../../lib/datasource/agent-trust-run');
const { resolveExternalIntegrationContext } = require('../../../lib/commands/test-e2e-external');
const { runTestTrustForExternalSystem } = require('../../../lib/commands/test-trust-external');

describe('test-trust-external', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveExternalIntegrationContext.mockReturnValue({
      systemKey: 'hubspot-demo',
      keys: ['hubspot-demo-companies', 'hubspot-demo-deals']
    });
    runDatasourceAgentTrust.mockResolvedValue({
      trustRun: {
        trustDecision: 'trusted',
        validationStatus: 'passed',
        confidence: 0.95,
        datasourceKey: 'hubspot-demo-companies'
      },
      apiError: null
    });
  });

  it('syncs then validates each datasource by default', async() => {
    const result = await runTestTrustForExternalSystem('hubspot-demo', {});

    expect(uploadExternalSystem).toHaveBeenCalledWith('hubspot-demo', {
      minimal: true,
      verbose: false
    });
    const { setupIntegrationTestAuth } = require('../../../lib/external-system/test-auth');
    expect(setupIntegrationTestAuth).not.toHaveBeenCalled();
    expect(runDatasourceAgentTrust).toHaveBeenCalledTimes(2);
    expect(runDatasourceAgentTrust).toHaveBeenCalledWith(
      'hubspot-demo-companies',
      expect.objectContaining({
        app: 'hubspot-demo',
        noSync: true,
        authConfig: expect.any(Object),
        dataplaneUrl: 'http://localhost:3201'
      })
    );
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  it('skips upload when noSync is true', async() => {
    await runTestTrustForExternalSystem('hubspot-demo', { noSync: true });
    expect(uploadExternalSystem).not.toHaveBeenCalled();
    const { setupIntegrationTestAuth } = require('../../../lib/external-system/test-auth');
    expect(setupIntegrationTestAuth).toHaveBeenCalled();
  });

  it('skips upload when Commander sets sync: false', async() => {
    await runTestTrustForExternalSystem('hubspot-demo', { sync: false });
    expect(uploadExternalSystem).not.toHaveBeenCalled();
  });

  it('marks notTrusted as failure', async() => {
    runDatasourceAgentTrust.mockResolvedValue({
      trustRun: {
        trustDecision: 'notTrusted',
        validationStatus: 'failed',
        summary: 'blocked'
      },
      apiError: null
    });
    const result = await runTestTrustForExternalSystem('hubspot-demo', { noSync: true });
    expect(result.success).toBe(false);
    expect(result.results[0].success).toBe(false);
  });

  it('returns success when no datasources', async() => {
    resolveExternalIntegrationContext.mockReturnValue({ systemKey: 'empty', keys: [] });
    const result = await runTestTrustForExternalSystem('empty', { noSync: true });
    expect(result.success).toBe(true);
    expect(logger.log).toHaveBeenCalled();
  });
});
