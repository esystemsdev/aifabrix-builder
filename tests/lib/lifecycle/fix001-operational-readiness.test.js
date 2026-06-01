/**
 * @fileoverview FIX-001 golden parity — verify-operations reads lifecycle GET (422.0).
 */

'use strict';

const FIX001 = {
  operations: {
    operationalReadinessPercent: 64,
    verdict: 'FAILED',
    details: {
      reliability: {
        validation: {
          validation: {
            metricsOutput: {
              icc: { score: 0.85 },
              pds: { score: 0.64 },
              dts: { score: 1.0 }
            }
          }
        },
        integration: {
          validation: {
            metricsOutput: {
              icc: { score: 0.85 },
              pds: { score: 0.64 },
              dts: { score: 1.0 }
            }
          }
        },
        e2e: { status: 'ok', metricsOutput: null }
      }
    }
  },
  certification: { level: 'NONE', status: 'NOT_CERTIFIED' },
  trust: { verdict: 'NOT_VERIFIED' },
  governance: { verdict: 'NOT_VERIFIED' }
};

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/validation/validate', () => ({
  validateExternalSystemComplete: jest.fn().mockResolvedValue({ valid: true })
}));
jest.mock('../../../lib/external-system/test', () => ({
  testExternalSystem: jest.fn().mockResolvedValue({ valid: true }),
  testExternalSystemIntegration: jest.fn().mockResolvedValue({ success: true })
}));
jest.mock('../../../lib/commands/test-e2e-external', () => ({
  runTestE2EForExternalSystem: jest.fn().mockResolvedValue({ success: true, results: [] }),
  syncLocalIfRequested: jest.fn().mockResolvedValue(null)
}));
jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn().mockResolvedValue({ baseDir: 'integration' })
}));
jest.mock('../../../lib/api/lifecycle.api', () => ({
  getSystemLifecycleReport: jest.fn()
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

const { getSystemLifecycleReport } = require('../../../lib/api/lifecycle.api');
const { runVerifyOperationsForExternalSystem } = require('../../../lib/commands/verify-operations-external');
const { displayVerifyOperationsTTY } = require('../../../lib/lifecycle/report-display');
const logger = require('../../../lib/utils/logger');

describe('FIX-001 operational readiness parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSystemLifecycleReport
      .mockResolvedValueOnce(FIX001)
      .mockResolvedValueOnce(FIX001);
  });

  it('verify-operations uses lifecycle GET for 64% FAILED and NONE cert', async() => {
    const result = await runVerifyOperationsForExternalSystem('acme-crm', { noSync: true });

    expect(result.operationalReadinessPercent).toBe(64);
    expect(result.verdict).toBe('FAILED');
    expect(result.certification.level).toBe('NONE');
    expect(result.certification.status).toBe('NOT_CERTIFIED');
    expect(result.operationalReadinessPercent).not.toBe(94);
    expect(result.operationalReadinessPercent).not.toBe(100);
  });

  it('TTY displays FIX-001 readiness percent from lifecycle', () => {
    displayVerifyOperationsTTY('acme-crm', {
      verdict: 'FAILED',
      operationalReadinessPercent: 64,
      readinessMetrics: { icc: 85, pds: 64, dts: 100 },
      warnings: [],
      details: FIX001.operations.details
    }, { details: false });

    const output = logger.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('64%');
    expect(output).not.toContain('94%');
  });
});
