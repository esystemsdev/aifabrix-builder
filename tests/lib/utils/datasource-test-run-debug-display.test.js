/**
 * @fileoverview Tests for lib/utils/datasource-test-run-debug-display.js
 */

const {
  resolveDebugDisplayMode,
  truncateUtf8String,
  formatDatasourceTestRunDebugBlock,
  FULL_MAX_BYTES_PER_STRING,
  RAW_MAX_LINES
} = require('../../../lib/utils/datasource-test-run-debug-display');

describe('datasource-test-run-debug-display', () => {
  it('resolveDebugDisplayMode maps Commander values', () => {
    expect(resolveDebugDisplayMode(undefined)).toBe(null);
    expect(resolveDebugDisplayMode(false)).toBe(null);
    expect(resolveDebugDisplayMode(true)).toBe('summary');
    expect(resolveDebugDisplayMode('full')).toBe('full');
    expect(resolveDebugDisplayMode('RAW')).toBe('raw');
    expect(resolveDebugDisplayMode('unknown')).toBe('summary');
  });

  it('truncateUtf8String respects UTF-8 byte cap', () => {
    expect(truncateUtf8String('ab', 10)).toBe('ab');
    const twoByte = '\u00e9';
    expect(Buffer.byteLength(twoByte, 'utf8')).toBe(2);
    expect(truncateUtf8String(`${twoByte}${twoByte}`, 4)).toBe(`${twoByte}${twoByte}`);
    expect(truncateUtf8String(`${twoByte}${twoByte}`, 2)).toContain('truncated');
    const long = 'x'.repeat(100);
    const t = truncateUtf8String(long, 20);
    expect(t).toContain('truncated');
    expect(t.length).toBeLessThan(long.length);
  });

  it('formatDatasourceTestRunDebugBlock summary lists ref layout', () => {
    const out = formatDatasourceTestRunDebugBlock(
      {
        audit: { traceRefs: ['https://trace/a', 'https://trace/b'], executionIds: ['exec-1'] },
        debug: { payloadRefs: [{ key: 'lastRequest', ref: 'audit://payload/1' }] }
      },
      'summary',
      true
    );
    expect(out).toContain('Debug (summary)');
    expect(out).toContain('audit.executionIds:');
    expect(out).toContain('[1] exec-1');
    expect(out).toContain('audit.traceRefs:');
    expect(out).toContain('[1] https://trace/a');
    expect(out).toContain('debug.payloadRefs:');
    expect(out).toContain('lastRequest: audit://payload/1');
  });

  it('formatDatasourceTestRunDebugBlock summary placeholder when no refs', () => {
    const out = formatDatasourceTestRunDebugBlock({ audit: {}, debug: {} }, 'summary', true);
    expect(out).toContain('No audit or debug references');
  });

  it('formatDatasourceTestRunDebugBlock full deep-truncates long strings', () => {
    const huge = 'z'.repeat(FULL_MAX_BYTES_PER_STRING + 500);
    const out = formatDatasourceTestRunDebugBlock(
      { audit: { note: huge }, debug: null, developer: null },
      'full',
      true
    );
    const jsonBlock = out.split('\n').slice(3).join('\n');
    const parsed = JSON.parse(jsonBlock);
    expect(parsed.audit.note.length).toBeLessThan(huge.length);
    expect(parsed.audit.note).toContain('truncated');
  });

  it('formatDatasourceTestRunDebugBlock raw redacts Bearer tokens', () => {
    const out = formatDatasourceTestRunDebugBlock(
      { audit: { h: 'Bearer secret-token' }, debug: null, developer: null },
      'raw',
      true
    );
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('secret-token');
  });

  it('formatDatasourceTestRunDebugBlock raw caps output lines (pretty-printed keys)', () => {
    const audit = {};
    for (let i = 0; i < RAW_MAX_LINES + 25; i += 1) {
      audit[`k${i}`] = i;
    }
    const out = formatDatasourceTestRunDebugBlock(
      { audit, debug: null, developer: null },
      'raw',
      true
    );
    expect(out).toContain('lines omitted');
    expect(out.split('\n').length).toBeLessThanOrEqual(RAW_MAX_LINES + 12);
  });
});
