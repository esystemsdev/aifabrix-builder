/**
 * @fileoverview Tests for integration debug log cleanup (datasource clean-logs).
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const fs = require('node:fs');
const path = require('path');
const os = require('os');

jest.mock('../../../lib/utils/paths', () => {
  const actual = jest.requireActual('../../../lib/utils/paths');
  return {
    ...actual,
    getIntegrationPath: jest.fn(),
    listIntegrationAppNames: jest.fn()
  };
});

const logger = require('../../../lib/utils/logger');
const { getIntegrationPath, listIntegrationAppNames } = require('../../../lib/utils/paths');
const {
  matchesLogCleanType,
  normalizeLogCleanType,
  listMatchingLogFiles,
  runCleanLogs
} = require('../../../lib/datasource/log-cleaner');

describe('log-cleaner', () => {
  describe('normalizeLogCleanType', () => {
    it('defaults to all', () => {
      expect(normalizeLogCleanType()).toBe('all');
      expect(normalizeLogCleanType('')).toBe('all');
    });

    it('accepts known types', () => {
      expect(normalizeLogCleanType('e2e')).toBe('e2e');
      expect(normalizeLogCleanType('TEST')).toBe('test');
    });

    it('rejects unknown types', () => {
      expect(() => normalizeLogCleanType('bogus')).toThrow(/invalid --type/i);
    });
  });

  describe('matchesLogCleanType', () => {
    it('structural test excludes other test prefixes', () => {
      expect(matchesLogCleanType('test-2026-01-01T00-00-00-000Z.json', 'test')).toBe(true);
      expect(matchesLogCleanType('test-e2e-foo.json', 'test')).toBe(false);
      expect(matchesLogCleanType('test-integration-foo.json', 'test')).toBe(false);
    });

    it('e2e matches only test-e2e prefix', () => {
      expect(matchesLogCleanType('test-e2e-ds.json', 'e2e')).toBe(true);
      expect(matchesLogCleanType('verify-trust-ds.json', 'e2e')).toBe(false);
      expect(matchesLogCleanType('verify-trust-ds.json', 'trust')).toBe(true);
    });
  });

  describe('runCleanLogs', () => {
    let tmpRoot;

    beforeEach(() => {
      jest.clearAllMocks();
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'log-clean-'));
      getIntegrationPath.mockImplementation((appKey) =>
        path.join(tmpRoot, 'integration', appKey)
      );
      listIntegrationAppNames.mockReturnValue(['app-a', 'app-b']);
      fs.mkdirSync(path.join(tmpRoot, 'integration', 'app-a', 'logs'), { recursive: true });
      fs.mkdirSync(path.join(tmpRoot, 'integration', 'app-b', 'logs'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpRoot, 'integration', 'app-a', 'logs', 'test-e2e-ds-1.json'),
        '{}',
        'utf8'
      );
      fs.writeFileSync(
        path.join(tmpRoot, 'integration', 'app-a', 'logs', 'test-2026-01-01T00-00-00-000Z.json'),
        '{}',
        'utf8'
      );
      fs.writeFileSync(
        path.join(tmpRoot, 'integration', 'app-b', 'logs', 'test-integration-ds.json'),
        '{}',
        'utf8'
      );
    });

    afterEach(() => {
      if (tmpRoot && fs.existsSync(tmpRoot)) {
        try {
          fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
        } catch {
          /* best-effort */
        }
      }
    });

    it('dry-run lists files without deleting', async() => {
      const result = await runCleanLogs({ app: 'app-a', dryRun: true, type: 'all' });
      expect(result.paths).toHaveLength(2);
      expect(fs.existsSync(result.paths[0])).toBe(true);
      const joined = logger.log.mock.calls.map(c => String(c[0] ?? '')).join('\n');
      expect(joined).toContain('Would remove');
      expect(joined).toContain('app-a/logs/');
    });

    it('removes only e2e logs for one app', async() => {
      const result = await runCleanLogs({ app: 'app-a', type: 'e2e' });
      expect(result.removedCount).toBe(1);
      expect(fs.existsSync(path.join(tmpRoot, 'integration', 'app-a', 'logs', 'test-e2e-ds-1.json'))).toBe(
        false
      );
      expect(
        fs.existsSync(
          path.join(tmpRoot, 'integration', 'app-a', 'logs', 'test-2026-01-01T00-00-00-000Z.json')
        )
      ).toBe(true);
    });

    it('--all removes matching logs from every integration app', async() => {
      const result = await runCleanLogs({ all: true, type: 'all' });
      expect(result.removedCount).toBe(3);
      await expect(
        listMatchingLogFiles(path.join(tmpRoot, 'integration', 'app-a', 'logs'), 'all')
      ).resolves.toEqual([]);
    });

    it('rejects --app and --all together', async() => {
      await expect(runCleanLogs({ app: 'app-a', all: true })).rejects.toThrow(/not both/i);
    });

    it('outputs JSON when --json', async() => {
      await runCleanLogs({ app: 'app-a', dryRun: true, json: true, type: 'e2e' });
      const jsonLine = logger.log.mock.calls.map(c => c[0]).find(s => typeof s === 'string' && s.startsWith('{'));
      const parsed = JSON.parse(jsonLine);
      expect(parsed.dryRun).toBe(true);
      expect(parsed.type).toBe('e2e');
      expect(parsed.fileCount).toBe(1);
    });
  });

  describe('listMatchingLogFiles', () => {
    it('returns empty array when logs dir missing', async() => {
      const files = await listMatchingLogFiles('/nonexistent/logs', 'all');
      expect(files).toEqual([]);
    });
  });
});
