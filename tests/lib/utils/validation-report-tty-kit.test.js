/**
 * @fileoverview Tests for validation-report-tty-kit.js
 */

const {
  rollupGlyph,
  verdictLineFromEnvelope,
  verdictLineLocalExternalTest,
  readinessLineFromAggregateStatus,
  readinessLineFromDataReadiness,
  formatDataQualityLines,
  TRUST_LINE_LABELS
} = require('../../../lib/utils/validation-report-tty-kit');

describe('validation-report-tty-kit', () => {
  it('rollupGlyph maps rollups to glyphs', () => {
    expect(rollupGlyph('ok')).toContain('✔');
    expect(rollupGlyph('warn')).toContain('⚠');
    expect(rollupGlyph('fail')).toContain('✖');
  });

  it('verdictLineFromEnvelope covers status and runType branches', () => {
    expect(verdictLineFromEnvelope('skipped', null, 'e2e')).toContain('Skipped');
    expect(verdictLineFromEnvelope('warn', null, 'e2e')).toContain('Limited production');
    expect(verdictLineFromEnvelope('fail', null, 'integration')).toContain('Pipeline not working');
    expect(verdictLineFromEnvelope('fail', null, 'e2e')).toContain('Not usable');
    expect(verdictLineFromEnvelope('fail', null, 'test')).toContain('Configuration invalid');
    expect(verdictLineFromEnvelope('ok', 'not_passed', 'e2e')).toContain('certification gaps');
    expect(verdictLineFromEnvelope('ok', 'passed', 'e2e')).toContain('production use');
  });

  it('verdictLineLocalExternalTest matches local manifest outcomes', () => {
    expect(verdictLineLocalExternalTest('ok')).toContain('continued setup');
    expect(verdictLineLocalExternalTest('warn')).toContain('Limited production');
    expect(verdictLineLocalExternalTest('fail')).toContain('Configuration invalid');
  });

  it('readinessLineFromAggregateStatus reflects status', () => {
    expect(readinessLineFromAggregateStatus('fail')).toContain('Not ready');
    expect(readinessLineFromAggregateStatus('warn')).toContain('Partial');
    expect(readinessLineFromAggregateStatus('ok')).toContain('Ready');
  });

  it('readinessLineFromDataReadiness maps envelope-style values', () => {
    expect(readinessLineFromDataReadiness('not_ready')).toContain('Not ready');
    expect(readinessLineFromDataReadiness('partial')).toContain('Partial');
    expect(readinessLineFromDataReadiness('ready')).toContain('Ready');
    expect(readinessLineFromDataReadiness(null)).toBeNull();
    expect(readinessLineFromDataReadiness('unknown')).toBeNull();
  });

  it('formatDataQualityLines includes trust labels and optional descriptions', () => {
    const rollups = { schema: 'ok', consistency: 'warn', reliability: 'fail' };
    const lines = formatDataQualityLines(rollups, {
      schema: 'a',
      consistency: 'b',
      reliability: 'c'
    });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain(TRUST_LINE_LABELS.schema);
    expect(lines[0]).toContain('a');
    expect(lines[2]).toContain(TRUST_LINE_LABELS.reliability);
    expect(lines[2]).toContain('c');
  });
});
