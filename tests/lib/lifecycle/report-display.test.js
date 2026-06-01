/**
 * @fileoverview Tests for certification TTY display (plan 150.0).
 */

'use strict';

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));

const logger = require('../../../lib/utils/logger');
const {
  displayVerifyOperationsTTY,
  displayLifecycleReportTTY
} = require('../../../lib/lifecycle/report-display');
const { VERDICT } = require('../../../lib/lifecycle/product-model');

describe('report-display verify-operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseResult = {
    verdict: VERDICT.VERIFIED,
    operationalReadinessPercent: 94,
    readinessMetrics: { icc: 85, pds: 64, dts: 100 },
    warnings: [],
    details: {
      connectivity: { credentials: true, authentication: true, authorization: true },
      contracts: { openApi: true, mappings: true },
      runtime: { sync: true, crud: true, execution: true },
      reliability: {
        validation: true,
        unitTests: true,
        integrationTests: true,
        e2eTests: true
      }
    }
  };

  it('default TTY omits Integration Tests label unless --details', () => {
    displayVerifyOperationsTTY('acme-crm', baseResult, { details: false });
    const output = logger.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Operational Readiness');
    expect(output).toContain('OPERATIONS VERIFIED');
    expect(output).not.toContain('Integration Tests');
    expect(output).not.toContain('E2E Tests');
    expect(output).not.toContain('Integration contract coverage');
    expect(output).not.toContain('Pipeline determinism');
    expect(output).not.toContain('Readiness breakdown');
  });

  it('--details TTY shows human-readable readiness metrics and verification steps', () => {
    displayVerifyOperationsTTY('acme-crm', baseResult, { details: true });
    const output = logger.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('Readiness breakdown');
    expect(output).toContain('Integration contract coverage');
    expect(output).toContain('Pipeline determinism');
    expect(output).toContain('Data trust');
    expect(output).not.toContain('ICC');
    expect(output).not.toContain('PDS');
    expect(output).not.toContain('DTS');
    expect(output).toContain('Verification steps');
    expect(output).toContain('Integration Tests');
    expect(output).toContain('E2E Tests');
  });

  it('lifecycle recommendations show copy-pastable CLI commands', () => {
    displayLifecycleReportTTY('test-e2e-hubspot', {
      certification: { level: 'NONE', status: 'NOT_CERTIFIED' },
      operations: { verdict: 'NOT_VERIFIED' },
      trust: { verdict: 'NOT_VERIFIED' },
      governance: { verdict: 'NOT_VERIFIED' },
      recommendations: [
        { code: 'OPERATIONS_NOT_VERIFIED', action: 'Run verify-operations' },
        { code: 'TRUST_NOT_VERIFIED', action: 'Run verify-trust' },
        { code: 'GOVERNANCE_NOT_VERIFIED', action: 'Run verify-governance' }
      ]
    });
    const output = logger.log.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('aifabrix verify-operations test-e2e-hubspot');
    expect(output).toContain('aifabrix verify-trust test-e2e-hubspot');
    expect(output).toContain('aifabrix verify-governance test-e2e-hubspot');
    expect(output).not.toContain('Run: Run verify-operations');
  });
});
