/**
 * @fileoverview Tests for datasource-test-run-debug-slice.js
 */

const { buildDebugEnvelopeSlice } = require('../../../lib/utils/datasource-test-run-debug-slice');

describe('datasource-test-run-debug-slice', () => {
  it('includes validation, integration, certificate, and capabilities slices', () => {
    const slice = buildDebugEnvelopeSlice({
      audit: { traceRefs: ['t1'] },
      debug: { mode: 'summary' },
      developer: { executiveSummary: 'ok' },
      validation: { status: 'ok', issues: [{ message: 'a' }] },
      integration: { status: 'ok', stepResults: [{ name: 'fetch', success: true }] },
      certificate: { status: 'passed', blockers: [] },
      capabilitySummary: { passed: 1, total: 2 },
      capabilities: [{ key: 'read', status: 'ok', e2e: { status: 'ok', steps: [] } }]
    });
    expect(slice.validation.status).toBe('ok');
    expect(slice.validation.issues).toHaveLength(1);
    expect(slice.integration.stepResults).toHaveLength(1);
    expect(slice.certificate.status).toBe('passed');
    expect(slice.capabilities).toHaveLength(1);
    expect(slice.capabilities[0].e2e.status).toBe('ok');
  });

  it('caps validation issues at 50 entries (plan §3.7)', () => {
    const issues = Array.from({ length: 51 }, (_, i) => ({ message: `m${i}` }));
    const slice = buildDebugEnvelopeSlice({
      validation: { status: 'warn', issues }
    });
    expect(slice.validation.issues).toHaveLength(50);
    expect(slice.validation.issues[0].message).toBe('m0');
    expect(slice.validation.issues[49].message).toBe('m49');
  });

  it('caps certificate blockers at 30 entries', () => {
    const blockers = Array.from({ length: 31 }, (_, i) => ({ message: `b${i}` }));
    const slice = buildDebugEnvelopeSlice({
      certificate: { status: 'not_passed', blockers }
    });
    expect(slice.certificate.blockers).toHaveLength(30);
  });
});
