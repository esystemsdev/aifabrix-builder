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
});
