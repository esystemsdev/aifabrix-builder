/**
 * @fileoverview Tests for verify-operations orchestration (plan 150.0).
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/validation/validate', () => ({
  validateExternalSystemComplete: jest.fn()
}));
jest.mock('../../../lib/external-system/test', () => ({
  testExternalSystem: jest.fn(),
  testExternalSystemIntegration: jest.fn()
}));
jest.mock('../../../lib/commands/test-e2e-external', () => ({
  runTestE2EForExternalSystem: jest.fn(),
  syncLocalIfRequested: jest.fn().mockResolvedValue(null)
}));
jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn().mockResolvedValue({ baseDir: 'integration' })
}));
jest.mock('../../../lib/api/lifecycle.api', () => ({
  getSystemLifecycleReport: jest.fn().mockResolvedValue({
    operations: {
      operationalReadinessPercent: 87,
      verdict: 'VERIFIED',
      details: {
        reliability: {
          validation: {
            validation: {
              metricsOutput: {
                icc: { score: 0.87 },
                pds: { score: 0.87 },
                dts: { score: 0.87 }
              }
            }
          },
          integration: {
            validation: {
              metricsOutput: {
                icc: { score: 0.87 },
                pds: { score: 0.87 },
                dts: { score: 0.87 }
              }
            }
          }
        }
      }
    },
    trust: { verdict: 'NOT_VERIFIED' },
    governance: { verdict: 'NOT_VERIFIED' }
  })
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
jest.mock('../../../lib/commands/verify-operations-persist', () => ({
  persistOperationsForSystem: jest.fn().mockResolvedValue({ persisted: 1 })
}));

const { validateExternalSystemComplete } = require('../../../lib/validation/validate');
const { testExternalSystem, testExternalSystemIntegration } = require('../../../lib/external-system/test');
const { runTestE2EForExternalSystem } = require('../../../lib/commands/test-e2e-external');
const { persistOperationsForSystem } = require('../../../lib/commands/verify-operations-persist');
const { runVerifyOperationsForExternalSystem } = require('../../../lib/commands/verify-operations-external');

describe('verify-operations-external', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validateExternalSystemComplete.mockResolvedValue({ valid: true });
    testExternalSystem.mockResolvedValue({ valid: true });
    testExternalSystemIntegration.mockResolvedValue({ success: true });
    runTestE2EForExternalSystem.mockResolvedValue({ success: true, results: [] });
  });

  it('invokes validate → test → test-integration → test-e2e in order', async() => {
    const callOrder = [];
    validateExternalSystemComplete.mockImplementation(async() => {
      callOrder.push('validate');
      return { valid: true };
    });
    testExternalSystem.mockImplementation(async() => {
      callOrder.push('test');
      return { valid: true };
    });
    testExternalSystemIntegration.mockImplementation(async() => {
      callOrder.push('integration');
      return { success: true };
    });
    runTestE2EForExternalSystem.mockImplementation(async() => {
      callOrder.push('e2e');
      return { success: true, results: [] };
    });

    const result = await runVerifyOperationsForExternalSystem('acme-crm', { noSync: true });

    expect(callOrder).toEqual(['validate', 'test', 'integration', 'e2e']);
    expect(result.verdict).toBe('VERIFIED');
    expect(result.operationalReadinessPercent).toBe(87);
    expect(result.readinessMetrics).toEqual({ icc: 87, pds: 87, dts: 87 });
    expect(persistOperationsForSystem).toHaveBeenCalledWith(
      'acme-crm',
      { noSync: true },
      expect.objectContaining({ e2e: true })
    );
  });

  it('stops on first hard fail unless --continue', async() => {
    validateExternalSystemComplete.mockResolvedValue({ valid: false });

    const result = await runVerifyOperationsForExternalSystem('acme-crm', { noSync: true });

    expect(testExternalSystem).not.toHaveBeenCalled();
    expect(result.verdict).toBe('FAILED');
    expect(persistOperationsForSystem).not.toHaveBeenCalled();
  });

  it('continues all steps when --continue is set', async() => {
    validateExternalSystemComplete.mockResolvedValue({ valid: false });
    testExternalSystem.mockResolvedValue({ valid: false });
    testExternalSystemIntegration.mockResolvedValue({ success: false });
    runTestE2EForExternalSystem.mockResolvedValue({ success: false, results: [] });

    const result = await runVerifyOperationsForExternalSystem('acme-crm', {
      noSync: true,
      continue: true
    });

    expect(testExternalSystem).toHaveBeenCalled();
    expect(runTestE2EForExternalSystem).toHaveBeenCalled();
    expect(result.verdict).toBe('FAILED');
  });
});
