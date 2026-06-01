/**
 * @fileoverview Tests for verify-trust external rollup (plan 150.0).
 */

'use strict';

jest.mock('../../../lib/commands/test-trust-external', () => ({
  runTestTrustForExternalSystem: jest.fn()
}));

const { runTestTrustForExternalSystem } = require('../../../lib/commands/test-trust-external');
const {
  runVerifyTrustForExternalSystem,
  mapTrustDatasourceRows
} = require('../../../lib/commands/verify-trust-external');

describe('verify-trust-external', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses worst datasource confidence for system rollup', async() => {
    runTestTrustForExternalSystem.mockResolvedValue({
      success: false,
      systemKey: 'acme-crm',
      results: [
        {
          key: 'acme-crm-a',
          success: true,
          trustRun: { confidence: 0.95, trustDecision: 'trusted' }
        },
        {
          key: 'acme-crm-b',
          success: false,
          trustRun: { confidence: 0.72, trustDecision: 'notTrusted' }
        }
      ]
    });

    const result = await runVerifyTrustForExternalSystem('acme-crm', {});
    expect(result.businessContextConfidencePercent).toBe(72);
    expect(result.verdict).toBe('FAILED');
  });

  it('mapTrustDatasourceRows marks failed rows', () => {
    const rows = mapTrustDatasourceRows([
      { key: 'ds-a', success: true, trustRun: { confidence: 0.9, trustDecision: 'trusted' } },
      { key: 'ds-b', success: false, error: 'api error' }
    ]);
    expect(rows[0].verdict).toBe('VERIFIED');
    expect(rows[1].verdict).toBe('FAILED');
  });
});
