/**
 * @fileoverview Tests for agent trust response mapping.
 */

const {
  mapRunResponseToTrustRun,
  mapLatestResultToTrustRun
} = require('../../../lib/datasource/agent-trust-map');

describe('agent-trust-map', () => {
  it('maps dataplane run response to trust run', () => {
    const run = mapRunResponseToTrustRun({
      datasourceKey: 'hubspot-deals',
      systemKey: 'hubspot',
      runResponse: {
        id: 'val-1',
        reused: false,
        result: {
          status: 'warning',
          trustDecision: 'usableWithWarnings',
          confidence: 0.72,
          summary: 'Mostly OK',
          validatedAt: '2026-05-18T12:00:00Z',
          inputHash: 'abc',
          contractVersion: '1.0.0',
          findings: [{ severity: 'warning', code: 'X', message: 'warn' }]
        }
      }
    });
    expect(run.status).toBe('warn');
    expect(run.trustDecision).toBe('usableWithWarnings');
    expect(run.cacheHit).toBe(false);
    expect(run.highLevelWarnings.length).toBeGreaterThan(0);
  });

  it('maps latest GET result with cacheHit', () => {
    const run = mapLatestResultToTrustRun({
      datasourceKey: 'hubspot-deals',
      systemKey: 'hubspot',
      latestResult: {
        status: 'passed',
        trustDecision: 'trusted',
        confidence: 0.91,
        summary: 'cached',
        validatedAt: '2026-05-18T12:00:00Z',
        inputHash: 'abc',
        contractVersion: '1.0.0',
        findings: []
      }
    });
    expect(run.readLatest).toBe(true);
    expect(run.cacheHit).toBe(true);
    expect(run.trustDecision).toBe('trusted');
  });
});
