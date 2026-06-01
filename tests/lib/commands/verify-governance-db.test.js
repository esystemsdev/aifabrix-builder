/**
 * @fileoverview Tests for verify-governance DB pack path.
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/commands/test-e2e-external', () => ({
  resolveExternalIntegrationContext: jest.fn(),
  syncLocalIfRequested: jest.fn()
}));
jest.mock('../../../lib/api/governance-scenario-pack.api', () => ({
  getDatasourceGovernancePack: jest.fn(),
  runDatasourceGovernanceScenarios: jest.fn()
}));
jest.mock('../../../lib/external-system/integration-auth-context', () => ({
  resolveIntegrationAuth: jest.fn()
}));
jest.mock('../../../lib/lifecycle/verify-step-progress', () => ({
  runWithVerifyStepProgress: jest.fn((_label, work) => work({ setLabel: jest.fn() }))
}));

const { syncLocalIfRequested } = require('../../../lib/commands/test-e2e-external');
const { resolveIntegrationAuth } = require('../../../lib/external-system/integration-auth-context');
const {
  getDatasourceGovernancePack,
  runDatasourceGovernanceScenarios
} = require('../../../lib/api/governance-scenario-pack.api');
const { resolveExternalIntegrationContext } = require('../../../lib/commands/test-e2e-external');
const { runVerifyGovernanceFromDbPacks } = require('../../../lib/commands/verify-governance-db');

describe('verify-governance-db', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveExternalIntegrationContext.mockReturnValue({
      systemKey: 'hubspot-e2e',
      keys: ['hubspot-e2e-companies']
    });
    syncLocalIfRequested.mockResolvedValue({
      authConfig: { type: 'bearer', token: 't' },
      dataplaneUrl: 'http://localhost:3611',
      uploadSkipped: true
    });
    resolveIntegrationAuth.mockResolvedValue({
      authConfig: { type: 'bearer', token: 't' },
      dataplaneUrl: 'http://localhost:3611'
    });
    getDatasourceGovernancePack.mockResolvedValue({ pack: { spec: { scenarios: [] } } });
    runDatasourceGovernanceScenarios.mockResolvedValue({
      summary: { passed: 2, failed: 0, total: 2 },
      policyCoveragePercent: 100,
      dimensionCoveragePercent: 100
    });
  });

  it('reuses upload auth context and does not re-upload scenario packs locally', async() => {
    const options = { env: 'dev', verbose: false };
    await runVerifyGovernanceFromDbPacks('hubspot-e2e', options);

    expect(syncLocalIfRequested).toHaveBeenCalledWith('hubspot-e2e', options);
    expect(options.authConfig).toEqual({ type: 'bearer', token: 't' });
    expect(options.dataplaneUrl).toBe('http://localhost:3611');
    expect(options.silentResolve).toBe(true);
    expect(resolveIntegrationAuth).toHaveBeenCalledWith('hubspot-e2e', options);
  });
});
