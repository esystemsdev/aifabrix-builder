/**
 * @fileoverview Tests for lib/lifecycle/product-model.js
 */

'use strict';

const {
  computeOperationalReadinessPercent,
  buildOperationsChecksFromSteps,
  worstConfidencePercent,
  verdictFromPassed,
  formatRecommendationAction,
  VERDICT
} = require('../../../lib/lifecycle/product-model');

describe('product-model', () => {
  it('computes operational readiness from checks', () => {
    const allPass = Object.fromEntries(
      Object.keys(require('../../../lib/lifecycle/product-model').OPERATIONS_WEIGHTS).map(k => [k, true])
    );
    expect(computeOperationalReadinessPercent(allPass)).toBe(100);
  });

  it('builds operations checks from step outcomes', () => {
    const checks = buildOperationsChecksFromSteps({
      validation: true,
      unit: true,
      integration: false,
      e2e: false
    });
    expect(checks.validation).toBe(true);
    expect(checks.integrationTests).toBe(false);
    expect(checks.credentials).toBe(false);
  });

  it('worstConfidencePercent uses minimum datasource confidence', () => {
    expect(worstConfidencePercent([0.95, 0.82, 0.91])).toBe(82);
    expect(worstConfidencePercent([])).toBeNull();
  });

  it('maps verdict from passed boolean', () => {
    expect(verdictFromPassed(true)).toBe(VERDICT.VERIFIED);
    expect(verdictFromPassed(false)).toBe(VERDICT.FAILED);
  });

  it('formatRecommendationAction returns full CLI command from code', () => {
    expect(
      formatRecommendationAction('test-e2e-hubspot', {
        code: 'OPERATIONS_NOT_VERIFIED',
        action: 'Run verify-operations'
      })
    ).toBe('aifabrix verify-operations test-e2e-hubspot');
  });

  it('formatRecommendationAction preserves already formatted action', () => {
    expect(
      formatRecommendationAction('test-e2e-hubspot', {
        code: 'TRUST_NOT_VERIFIED',
        action: 'aifabrix verify-trust test-e2e-hubspot'
      })
    ).toBe('aifabrix verify-trust test-e2e-hubspot');
  });
});
