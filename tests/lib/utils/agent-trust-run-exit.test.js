/**
 * @fileoverview Tests for agent trust exit codes (plan 143).
 */

const {
  computeExitCodeFromTrustRun,
  computeSystemExitCodeFromTrustRows
} = require('../../../lib/utils/agent-trust-run-exit');

describe('agent-trust-run-exit', () => {
  const baseRun = {
    trustDecision: 'trusted',
    validationStatus: 'passed',
    confidence: 0.9
  };

  it('returns 0 for trusted', () => {
    expect(computeExitCodeFromTrustRun(baseRun)).toBe(0);
  });

  it('returns 1 for notTrusted', () => {
    expect(
      computeExitCodeFromTrustRun({ ...baseRun, trustDecision: 'notTrusted' })
    ).toBe(1);
  });

  it('returns 1 for strict when usableWithWarnings', () => {
    expect(
      computeExitCodeFromTrustRun(
        { ...baseRun, trustDecision: 'usableWithWarnings' },
        { strict: true }
      )
    ).toBe(1);
  });

  it('returns 1 for warnings-as-errors', () => {
    expect(
      computeExitCodeFromTrustRun(
        { ...baseRun, trustDecision: 'usableWithWarnings' },
        { warningsAsErrors: true }
      )
    ).toBe(1);
  });

  it('system rollup fails when any row not trusted', () => {
    const rows = [
      { success: true, trustRun: { ...baseRun, trustDecision: 'trusted' } },
      {
        success: false,
        trustRun: { ...baseRun, trustDecision: 'notTrusted', validationStatus: 'failed' }
      }
    ];
    expect(computeSystemExitCodeFromTrustRows(rows)).toBe(1);
  });
});
