/**
 * @fileoverview Tests for operational readiness metric rollup (422.0).
 */

'use strict';

const {
  metricScorePercent,
  metricsFromEnvelope,
  rollupReadinessMetrics,
  extractReadinessMetricsFromLifecycleReport
} = require('../../../lib/lifecycle/operations-readiness-metrics');

describe('operations-readiness-metrics', () => {
  const hubspotMetrics = {
    icc: { score: 0.85, percentage: 84.62 },
    pds: { score: 0.64, percentage: 64.0 },
    dts: { score: 1.0, percentage: 100.0 }
  };

  it('reads metrics from validation.metricsOutput', () => {
    const env = { validation: { metricsOutput: hubspotMetrics } };
    expect(metricsFromEnvelope(env)).toEqual({ icc: 85, pds: 64, dts: 100 });
  });

  it('rollup uses min across validation and integration legs', () => {
    const reliability = {
      validation: { validation: { metricsOutput: hubspotMetrics } },
      integration: {
        validation: {
          metricsOutput: {
            icc: { score: 0.9 },
            pds: { score: 0.5 },
            dts: { score: 0.95 }
          }
        }
      }
    };
    expect(rollupReadinessMetrics(reliability)).toEqual({
      icc: 85,
      pds: 50,
      dts: 95
    });
  });

  it('extracts metrics from lifecycle operations reliability block', () => {
    const report = {
      operations: {
        operationalReadinessPercent: 64,
        details: {
          reliability: {
            validation: { validation: { metricsOutput: hubspotMetrics } },
            integration: { validation: { metricsOutput: hubspotMetrics } }
          }
        }
      }
    };
    expect(extractReadinessMetricsFromLifecycleReport(report)).toEqual({
      icc: 85,
      pds: 64,
      dts: 100
    });
  });

  it('metricScorePercent prefers score over percentage', () => {
    expect(metricScorePercent({ score: 0.85, percentage: 84.62 })).toBe(85);
  });
});
