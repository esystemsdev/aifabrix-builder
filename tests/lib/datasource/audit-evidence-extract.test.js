/**
 * @fileoverview Tests for audit-evidence-extract
 */

'use strict';

const {
  extractAuditEvidenceContext,
  executionIdsFromEnvelope,
  correlationIdFromEnvelope,
  expectedOperationsFromEnvelope
} = require('../../../lib/datasource/audit-evidence-extract');

describe('audit-evidence-extract', () => {
  const sampleEnvelope = {
    datasourceKey: 'test-e2e-hubspot-companies',
    testRunId: 'run-corr-abc',
    audit: { executionIds: ['exec-a', 'exec-b'] },
    debug: { executionIds: ['exec-b', 'exec-c'] },
    capabilities: [
      { key: 'insert', status: 'ok' },
      { key: 'list', status: 'skipped' },
      { key: 'get', status: 'ok' }
    ],
    integration: { sync: { status: 'ok' } }
  };

  it('parses sample validation envelope → ids + ops', () => {
    const ctx = extractAuditEvidenceContext(sampleEnvelope);
    expect(ctx.datasourceKey).toBe('test-e2e-hubspot-companies');
    expect(ctx.correlationId).toBe('run-corr-abc');
    expect(ctx.executionIds).toEqual(['exec-a', 'exec-b', 'exec-c']);
    expect(ctx.expectedOperations).toEqual(expect.arrayContaining(['insert', 'get', 'list']));
  });

  it('executionIdsFromEnvelope dedupes audit and debug', () => {
    expect(executionIdsFromEnvelope(sampleEnvelope)).toEqual(['exec-a', 'exec-b', 'exec-c']);
  });

  it('correlationIdFromEnvelope prefers testRunId', () => {
    expect(correlationIdFromEnvelope({ testRunId: 't1', runId: 'r1' })).toBe('t1');
    expect(correlationIdFromEnvelope({ runId: 'r1' })).toBe('r1');
  });

  it('correlationIdFromEnvelope uses e2eAsyncDebug.requestId instead of ephemeral runId', () => {
    const uuid = '7e889f51-37da-4348-8287-58d56c295764';
    expect(
      correlationIdFromEnvelope({
        testRunId: null,
        runId: 'run-c41ae48d238e',
        debug: { e2eAsyncDebug: { requestId: uuid } }
      })
    ).toBe(uuid);
    expect(correlationIdFromEnvelope({ runId: 'run-c41ae48d238e' })).toBeNull();
  });

  it('[EDGE] missing audit.executionIds → empty ids', () => {
    const ctx = extractAuditEvidenceContext({ datasourceKey: 'ds-1', testRunId: 't1' });
    expect(ctx.executionIds).toEqual([]);
  });

  it('expectedOperationsFromEnvelope includes CRUD capability keys only', () => {
    const ops = expectedOperationsFromEnvelope({
      capabilities: [
        { key: 'mapping', status: 'ok' },
        { key: 'insert', status: 'ok' },
        { key: 'list', status: 'skipped' }
      ]
    });
    expect(ops).toEqual(['insert']);
  });
});
