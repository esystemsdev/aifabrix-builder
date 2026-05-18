/**
 * @fileoverview Tests for lib/utils/dataplane-cli-version-help.js (plan 142.0).
 */

'use strict';

const {
  buildCliVersionUpgradeNextActions,
  buildCliVersionBlockingLine,
  formatCliVersionGateError
} = require('../../../lib/utils/dataplane-cli-version-help');

describe('dataplane-cli-version-help', () => {
  describe('buildCliVersionUpgradeNextActions', () => {
    it('includes upgrade command, confirm step, CI hint, and local fallback', () => {
      const lines = buildCliVersionUpgradeNextActions('2.45.0', '2.44.0');
      expect(lines).toHaveLength(4);
      expect(lines[0]).toContain('npm install -g @aifabrix/builder@2.45.0');
      expect(lines[1]).toContain('aifabrix auth status');
      expect(lines[2]).toMatch(/--validate.*exit 3/);
      expect(lines[3]).toContain('2.44.0');
    });

    it('uses safe placeholders when versions are missing', () => {
      const lines = buildCliVersionUpgradeNextActions('', '');
      expect(lines[0]).toContain('the dataplane minimum');
      expect(lines[3]).toContain('this CLI');
    });
  });

  describe('buildCliVersionBlockingLine', () => {
    it('includes both versions and the action verb', () => {
      const line = buildCliVersionBlockingLine('2.45.0', '2.44.0');
      expect(line).toContain('2.45.0');
      expect(line).toContain('2.44.0');
      expect(line).toMatch(/Upgrade/i);
    });
  });

  describe('formatCliVersionGateError', () => {
    it('combines blocking line + Next actions with a blank separator', () => {
      const out = formatCliVersionGateError('2.45.0', '2.44.0');
      const parts = out.split('\n\n');
      expect(parts.length).toBeGreaterThanOrEqual(2);
      expect(out).toContain('Next actions');
      expect(out).toContain('npm install -g @aifabrix/builder@2.45.0');
    });
  });
});
