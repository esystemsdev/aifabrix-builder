/**
 * @fileoverview Smoke tests for formatDatasourceTestRunTTY (plan §16 subset).
 */

const { formatDatasourceTestRunTTY } = require('../../../lib/utils/datasource-test-run-display');

/** Strip ANSI for stable assertions */
function stripAnsi(s) {
  const esc = String.fromCharCode(27);
  return String(s).replace(new RegExp(`${esc}\\[[0-9;]*m`, 'g'), '');
}

describe('formatDatasourceTestRunTTY', () => {
  it('includes datasource and run type in output', () => {
    const raw = formatDatasourceTestRunTTY({
      datasourceKey: 'hubspot.users',
      systemKey: 'hubspot',
      runType: 'test',
      status: 'ok'
    });
    const s = stripAnsi(raw);
    expect(s).toContain('hubspot.users');
    expect(s).toContain('hubspot');
    expect(s).toContain('test');
    expect(s).toContain('Verdict');
  });

  it('for e2e without capabilities prints no-capabilities line when not drilling down', () => {
    const raw = formatDatasourceTestRunTTY({
      datasourceKey: 'x.ds',
      systemKey: 'x',
      runType: 'e2e',
      status: 'ok',
      capabilities: []
    });
    const s = stripAnsi(raw);
    expect(s).toContain('No capabilities reported');
  });

  it('does not print no-capabilities line when --capability drill-down is active', () => {
    const raw = formatDatasourceTestRunTTY(
      {
        datasourceKey: 'x.ds',
        systemKey: 'x',
        runType: 'e2e',
        status: 'ok',
        capabilities: []
      },
      { focusCapabilityKey: 'read' }
    );
    const s = stripAnsi(raw);
    expect(s).not.toContain('No capabilities reported');
    expect(s).toContain('Capability scope: read');
  });
});
