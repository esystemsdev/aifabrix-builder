/**
 * @fileoverview Tests for lib/utils/datasource-test-run-debug-display.js
 */

const {
  resolveDebugDisplayMode,
  truncateUtf8String,
  formatDatasourceTestRunDebugBlock,
  pushE2eTimingSummaryLines,
  pushCapacityOperationsSummaryLines,
  parseCapacityScenarioOp,
  parseCapacityDetailKey,
  formatCapacityOperationLabel,
  FULL_MAX_BYTES_PER_STRING,
  RAW_MAX_LINES
} = require('../../../lib/utils/datasource-test-run-debug-display');
const { clearCipCapacityDisplayConfigCacheForTests } = require('../../../lib/utils/load-cip-capacity-display-config');

describe('datasource-test-run-debug-display', () => {
  afterEach(() => {
    clearCipCapacityDisplayConfigCacheForTests();
  });

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

  it('pushE2eTimingSummaryLines prints step durations and sync phase timings', () => {
    const lines = [];
    pushE2eTimingSummaryLines(lines, {
      debug: {
        e2eAsyncDebug: {
          timing: {
            durationSeconds: 12.5,
            wallClockSeconds: 15,
            stepDurations: [
              { step: 'credential', durationSeconds: 1.2 },
              { step: 'sync', durationSeconds: 9.8 }
            ]
          },
          stepDebug: [
            {
              name: 'sync',
              evidence: {
                jobs: [
                  {
                    audit: {
                      phaseTimingsSeconds: {
                        phase1: 0.5,
                        phase2: 0.1,
                        phase3: 8.2,
                        phase4: 0.9
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    });
    expect(lines).toContain('E2E worker: ~12.500s (wall ~15.000s)');
    expect(lines).toContain('  credential: ~1.200s');
    expect(lines).toContain('  sync: ~9.800s');
    expect(lines.some(l => l.includes('Sync phases (first job):') && l.includes('phase3 ~8.200s'))).toBe(true);
  });

  it('parseCapacityScenarioOp extracts scenario operation from capacity key', () => {
    expect(parseCapacityScenarioOp('capacity:create#0')).toBe('create');
    expect(parseCapacityScenarioOp('capacity:list#4')).toBe('list');
    expect(parseCapacityScenarioOp('other')).toBe(null);
  });

  it('parseCapacityDetailKey exposes scenario index for ordering', () => {
    expect(parseCapacityDetailKey('capacity:create#0')).toEqual({ op: 'create', index: 0 });
    expect(parseCapacityDetailKey('capacity:customStep#1')).toEqual({ op: 'customstep', index: 1 });
  });

  it('formatCapacityOperationLabel maps create to insert wording', () => {
    expect(formatCapacityOperationLabel('create')).toContain('insert');
    expect(formatCapacityOperationLabel('update')).toBe('update');
  });

  it('pushCapacityOperationsSummaryLines prints scenario outcomes', () => {
    const lines = [];
    pushCapacityOperationsSummaryLines(lines, {
      datasourceKey: 'ds-a',
      debug: {
        e2eAsyncDebug: {
          stepDebug: [
            {
              name: 'capacity',
              evidence: {
                datasources: [
                  {
                    key: 'ds-a',
                    capabilityDetails: [
                      { key: 'capacity:create#0', success: true },
                      { key: 'capacity:update#1', success: true },
                      { key: 'capacity:get#2', success: false, error: 'HTTP 404' }
                    ]
                  }
                ]
              }
            }
          ]
        }
      }
    });
    expect(lines.some(l => l.includes('Capacity operations:'))).toBe(true);
    expect(lines.some(l => l.includes('insert'))).toBe(true);
    expect(lines.some(l => l.includes('update'))).toBe(true);
    expect(lines.some(l => l.includes('HTTP 404'))).toBe(true);
  });

  it('pushCapacityOperationsSummaryLines sorts by scenario index then schema op order', () => {
    const lines = [];
    pushCapacityOperationsSummaryLines(lines, {
      datasourceKey: 'ds-a',
      debug: {
        e2eAsyncDebug: {
          stepDebug: [
            {
              name: 'capacity',
              evidence: {
                datasources: [
                  {
                    key: 'ds-a',
                    capabilityDetails: [
                      { key: 'capacity:list#4', success: true },
                      { key: 'capacity:create#0', success: true }
                    ]
                  }
                ]
              }
            }
          ]
        }
      }
    });
    const block = lines.join('\n');
    const idxInsert = block.indexOf('insert');
    const idxList = block.indexOf('list');
    expect(idxInsert).toBeGreaterThan(-1);
    expect(idxList).toBeGreaterThan(-1);
    expect(idxInsert).toBeLessThan(idxList);
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
