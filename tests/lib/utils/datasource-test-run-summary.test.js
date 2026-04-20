/**
 * @fileoverview formatDatasourceTestRunSummary (--summary line shape).
 */

const { formatDatasourceTestRunSummary } = require('../../../lib/utils/datasource-test-run-display');

describe('formatDatasourceTestRunSummary', () => {
  it('returns empty string for null/undefined envelope', () => {
    expect(formatDatasourceTestRunSummary(null)).toBe('');
    expect(formatDatasourceTestRunSummary(undefined)).toBe('');
  });

  it('includes datasource key and uppercased status with separator', () => {
    const line = formatDatasourceTestRunSummary({
      datasourceKey: 'hubspot-users',
      status: 'ok'
    });
    expect(line).toContain('hubspot-users');
    expect(line).toContain('OK');
    expect(line).toMatch(/\|/);
  });

  it('appends capability summary counts when capabilitySummary present', () => {
    const line = formatDatasourceTestRunSummary({
      datasourceKey: 'ds-1',
      status: 'warn',
      capabilitySummary: { passedCount: 2, totalCount: 5 }
    });
    expect(line).toContain('Capabilities: 2/5');
  });

  it('with focusCapabilityKey includes single capability row when present', () => {
    const line = formatDatasourceTestRunSummary(
      {
        datasourceKey: 'ds-1',
        status: 'ok',
        capabilities: [{ key: 'read', status: 'ok' }]
      },
      { focusCapabilityKey: 'read' }
    );
    expect(line).toContain('Cap read:');
    expect(line).toContain('ok');
  });

  it('with focusCapabilityKey shows missing when row absent', () => {
    const line = formatDatasourceTestRunSummary(
      {
        datasourceKey: 'ds-1',
        status: 'ok',
        capabilities: [{ key: 'write', status: 'ok' }]
      },
      { focusCapabilityKey: 'read' }
    );
    expect(line).toContain('Cap read: (missing)');
  });

  it('appends certificate level and glyph when certificate has level', () => {
    const line = formatDatasourceTestRunSummary({
      datasourceKey: 'ds-1',
      status: 'ok',
      certificate: { level: 'L2', status: 'passed' }
    });
    expect(line).toContain('Certificate:');
    expect(line).toContain('L2');
    expect(line).toContain('✔');
  });
});
