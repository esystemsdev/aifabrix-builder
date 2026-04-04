/**
 * @fileoverview Tests for datasource-test-run-display.js
 */

const {
  formatDatasourceTestRunSummary,
  formatDatasourceTestRunTTY,
  formatCapabilityFocusSection
} = require('../../../lib/utils/datasource-test-run-display');

describe('datasource-test-run-display', () => {
  const baseEnv = {
    datasourceKey: 'ds1',
    systemKey: 'sys',
    runType: 'e2e',
    status: 'ok',
    developer: { executiveSummary: 'All good' }
  };

  it('formatCapabilityFocusSection returns empty when no focus key', () => {
    expect(formatCapabilityFocusSection(baseEnv, '')).toBe('');
  });

  it('formatCapabilityFocusSection shows missing when key not in capabilities', () => {
    const out = formatCapabilityFocusSection(baseEnv, 'read');
    expect(out).toContain('Capability scope: read');
    expect(out).toContain('No row with key "read"');
  });

  it('formatCapabilityFocusSection shows row and e2e steps', () => {
    const env = {
      ...baseEnv,
      capabilities: [
        {
          key: 'read',
          status: 'ok',
          permission: 'p.read',
          e2e: {
            status: 'ok',
            steps: [{ name: 'list', success: true }, { name: 'get', success: false, error: 'nope' }]
          }
        }
      ]
    };
    const out = formatCapabilityFocusSection(env, 'read');
    expect(out).toContain('Capability scope: read');
    expect(out).toContain('Permission: p.read');
    expect(out).toContain('✓ list');
    expect(out).toContain('✗ get');
    expect(out).toContain('nope');
  });

  it('formatDatasourceTestRunTTY shows §3.9 line when e2e has no capabilities', () => {
    const out = formatDatasourceTestRunTTY(baseEnv);
    expect(out).toContain('No capabilities reported.');
    expect(out.indexOf('No capabilities reported.')).toBeLessThan(out.indexOf('Verdict:'));
  });

  it('formatDatasourceTestRunTTY omits §3.9 line when capabilities present', () => {
    const env = { ...baseEnv, capabilities: [{ key: 'read', status: 'ok' }] };
    expect(formatDatasourceTestRunTTY(env)).not.toContain('No capabilities reported.');
  });

  it('formatDatasourceTestRunTTY omits §3.9 line for non-e2e runType', () => {
    const env = { ...baseEnv, runType: 'test' };
    expect(formatDatasourceTestRunTTY(env)).not.toContain('No capabilities reported.');
  });

  it('formatDatasourceTestRunTTY omits §3.9 line when capability drill-down is set', () => {
    const out = formatDatasourceTestRunTTY(baseEnv, { focusCapabilityKey: 'read' });
    expect(out).not.toContain('No capabilities reported.');
    expect(out).toContain('Capability scope: read');
  });

  it('formatDatasourceTestRunTTY appends focus section when option set', () => {
    const env = {
      ...baseEnv,
      capabilities: [{ key: 'write', status: 'fail' }]
    };
    const out = formatDatasourceTestRunTTY(env, { focusCapabilityKey: 'write' });
    expect(out).toContain('Verdict:');
    expect(out).toContain('Capability scope: write');
    expect(out).toContain('✖ fail');
  });

  it('formatDatasourceTestRunSummary uses focused cap instead of rollup counts', () => {
    const env = {
      ...baseEnv,
      capabilitySummary: { passedCount: 3, totalCount: 10 },
      capabilities: [{ key: 'read', status: 'warn' }]
    };
    const withFocus = formatDatasourceTestRunSummary(env, { focusCapabilityKey: 'read' });
    expect(withFocus).toContain('Cap read:');
    expect(withFocus).toMatch(/Cap read:.*warn/i);
    expect(withFocus).not.toContain('Capabilities: 3/10');

    const noFocus = formatDatasourceTestRunSummary(env);
    expect(noFocus).toContain('Capabilities: 3/10');
  });
});
