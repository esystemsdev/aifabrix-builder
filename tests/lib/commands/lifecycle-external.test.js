/**
 * @fileoverview Tests for lifecycle external runner (plan 150.0).
 */

'use strict';

jest.mock('../../../lib/api/lifecycle.api', () => ({
  getSystemLifecycleReport: jest.fn(),
  runSystemLifecycle: jest.fn()
}));
jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn().mockResolvedValue({ baseDir: 'integration' })
}));
jest.mock('../../../lib/external-system/test-auth', () => ({
  setupIntegrationTestAuth: jest.fn().mockResolvedValue({
    authConfig: { type: 'bearer', token: 't' },
    dataplaneUrl: 'http://localhost:3201'
  })
}));
jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn().mockResolvedValue({})
}));
jest.mock('../../../lib/commands/test-e2e-external', () => ({
  syncLocalIfRequested: jest.fn()
}));
jest.mock('../../../lib/commands/verify-operations-external', () => ({
  runVerifyOperationsForExternalSystem: jest.fn().mockResolvedValue({})
}));
jest.mock('../../../lib/commands/verify-trust-external', () => ({
  runVerifyTrustForExternalSystem: jest.fn().mockResolvedValue({})
}));
jest.mock('../../../lib/commands/verify-governance-external', () => ({
  runVerifyGovernanceForExternalSystem: jest.fn().mockResolvedValue({})
}));

const { getSystemLifecycleReport, runSystemLifecycle } = require('../../../lib/api/lifecycle.api');
const {
  runLifecycleForExternalSystem,
  runMissingVerifyStepsLocally
} = require('../../../lib/commands/lifecycle-external');
const { runVerifyOperationsForExternalSystem } = require('../../../lib/commands/verify-operations-external');
const { runVerifyTrustForExternalSystem } = require('../../../lib/commands/verify-trust-external');
const { VERDICT } = require('../../../lib/lifecycle/product-model');

const SAMPLE_REPORT = {
  systemKey: 'acme-crm',
  certification: { level: 'BRONZE', status: 'TECHNICALLY_READY' },
  operations: { verdict: VERDICT.VERIFIED },
  trust: { verdict: VERDICT.NOT_VERIFIED },
  governance: { verdict: VERDICT.NOT_VERIFIED },
  recommendations: []
};

describe('lifecycle-external', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSystemLifecycleReport.mockResolvedValue(SAMPLE_REPORT);
    runSystemLifecycle.mockResolvedValue({ report: SAMPLE_REPORT, stepsRun: [] });
  });

  it('default path calls GET only, not POST lifecycle/run', async() => {
    await runLifecycleForExternalSystem('acme-crm', {});
    expect(getSystemLifecycleReport).toHaveBeenCalledTimes(1);
    expect(runSystemLifecycle).not.toHaveBeenCalled();
  });

  it('--run uses POST lifecycle/run when API succeeds', async() => {
    const result = await runLifecycleForExternalSystem('acme-crm', { run: true });
    expect(runSystemLifecycle).toHaveBeenCalledWith(
      'http://localhost:3201',
      expect.any(Object),
      'acme-crm',
      {}
    );
    expect(result.source).toBe('api');
  });

  it('runMissingVerifyStepsLocally runs only missing pillars', async() => {
    await runMissingVerifyStepsLocally('acme-crm', SAMPLE_REPORT, { env: 'dev' });
    expect(runVerifyOperationsForExternalSystem).not.toHaveBeenCalled();
    expect(runVerifyTrustForExternalSystem).toHaveBeenCalled();
  });
});
