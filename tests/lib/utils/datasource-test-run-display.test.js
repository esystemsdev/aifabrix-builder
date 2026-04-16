/**
 * @fileoverview Unit tests for DatasourceTestRun TTY string builders (glyphs + structure).
 */

const {
  formatDatasourceTestRunSummary,
  formatDatasourceTestRunTTY,
  formatCapabilityFocusSection
} = require('../../../lib/utils/datasource-test-run-display');

function stripAnsi(s) {
  const ESC = String.fromCharCode(27);
  const re = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
  return String(s).replace(re, '');
}

function baseEnvelope(overrides = {}) {
  return {
    datasourceKey: 'hubspot.users',
    systemKey: 'hubspot',
    runType: 'integration',
    status: 'ok',
    developer: { executiveSummary: '✔ Suitable for production use.' },
    ...overrides
  };
}

describe('datasource-test-run-display', () => {
  describe('formatDatasourceTestRunSummary', () => {
    it('includes datasource key, status glyph, and uppercase status', () => {
      const s = formatDatasourceTestRunSummary(baseEnvelope({ status: 'warn' }));
      expect(s).toContain('hubspot.users');
      expect(s).toContain('⚠');
      expect(s).toContain('WARN');
    });

    it('returns empty string when envelope missing', () => {
      expect(formatDatasourceTestRunSummary(null)).toBe('');
    });
  });

  describe('formatDatasourceTestRunTTY', () => {
    it('renders header block with Datasource / Run / Status lines', () => {
      const tty = stripAnsi(formatDatasourceTestRunTTY(baseEnvelope()));
      expect(tty).toContain('Datasource:');
      expect(tty).toContain('hubspot.users');
      expect(tty).toContain('hubspot');
      expect(tty).toContain('Run:');
      expect(tty).toContain('integration');
      expect(tty).toContain('Status:');
      expect(tty).toContain('ok');
    });

    it('renders integration steps with ✔ / ✖ glyphs', () => {
      const tty = stripAnsi(
        formatDatasourceTestRunTTY(
          baseEnvelope({
            integration: {
              stepResults: [
                { name: 'config', success: true },
                { name: 'credential', success: false, error: 'bad token' }
              ]
            }
          })
        )
      );
      expect(tty).toContain('Integration steps:');
      expect(tty).toContain('✔ config');
      expect(tty).toContain('✖ credential');
      expect(tty).toContain('bad token');
    });

    it('includes capability focus section when focus key set', () => {
      const env = baseEnvelope({
        capabilities: [{ key: 'read', status: 'ok', permission: 'x' }]
      });
      const tty = stripAnsi(formatDatasourceTestRunTTY(env, { focusCapabilityKey: 'read' }));
      expect(tty).toContain('Capability scope: read');
    });
  });

  describe('formatCapabilityFocusSection', () => {
    it('uses ✔ / ✖ in embedded capability E2E step lines', () => {
      const env = baseEnvelope({
        capabilities: [
          {
            key: 'deal.read',
            status: 'fail',
            e2e: {
              status: 'fail',
              steps: [{ name: 'probe', success: true }, { name: 'mutate', success: false, error: 'nope' }]
            }
          }
        ]
      });
      const block = stripAnsi(formatCapabilityFocusSection(env, 'deal.read'));
      expect(block).toContain('deal.read');
      expect(block).toContain('✔ probe');
      expect(block).toContain('✖ mutate');
    });
  });
});
