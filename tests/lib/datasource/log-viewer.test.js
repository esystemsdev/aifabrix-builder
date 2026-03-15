/**
 * Tests for log-viewer.js
 * @fileoverview Unit tests for lib/datasource/log-viewer.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../lib/datasource/resolve-app', () => ({
  resolveAppKeyForDatasource: jest.fn()
}));
jest.mock('../../../lib/utils/paths', () => ({
  getIntegrationPath: jest.fn((app) => `/integration/${app}`)
}));

const fs = require('fs').promises;
jest.mock('fs', () => ({ promises: { readdir: jest.fn(), stat: jest.fn(), readFile: jest.fn() } }));

const {
  getLatestLogPath,
  formatLogContent,
  runLogViewer
} = require('../../../lib/datasource/log-viewer');
const { resolveAppKeyForDatasource } = require('../../../lib/datasource/resolve-app');
const logger = require('../../../lib/utils/logger');

describe('log-viewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveAppKeyForDatasource.mockResolvedValue({ appKey: 'myapp' });
  });

  describe('getLatestLogPath', () => {
    it('should return latest file by mtime for matching pattern', async() => {
      fs.readdir = jest.fn().mockResolvedValue([
        { name: 'test-e2e-2026-01-01T12-00-00-000Z.json', isFile: () => true },
        { name: 'test-e2e-2026-01-02T12-00-00-000Z.json', isFile: () => true }
      ]);
      fs.stat = jest.fn()
        .mockResolvedValueOnce({ mtimeMs: 1000 })
        .mockResolvedValueOnce({ mtimeMs: 2000 });
      const result = await getLatestLogPath('/logs', 'test-e2e-');
      expect(result).toContain('test-e2e-2026-01-02');
    });

    it('should return null when directory does not exist', async() => {
      fs.readdir = jest.fn().mockRejectedValue({ code: 'ENOENT' });
      const result = await getLatestLogPath('/nonexistent', 'test-e2e-');
      expect(result).toBeNull();
    });

    it('should return null when no files match', async() => {
      fs.readdir = jest.fn().mockResolvedValue([{ name: 'other.log', isFile: () => true }]);
      const result = await getLatestLogPath('/logs', 'test-e2e-');
      expect(result).toBeNull();
    });
  });

  describe('formatLogContent', () => {
    it('should format E2E log with request and response', () => {
      formatLogContent({
        request: { sourceIdOrKey: 'ds-key', includeDebug: true },
        response: { success: true, steps: [{ name: 'config', success: true }] }
      }, 'test-e2e', 'test-e2e-123.json');
      expect(logger.log).toHaveBeenCalled();
      const calls = logger.log.mock.calls.map(c => String(c[0]));
      expect(calls.some(s => s.includes('E2E Log') && s.includes('test-e2e-123'))).toBe(true);
      expect(calls.some(s => s.includes('sourceIdOrKey'))).toBe(true);
      expect(calls.some(s => s.includes('✓ config'))).toBe(true);
    });

    it('should show full executionId and execution link when dataplaneUrl in request', () => {
      const fullExecutionId = 'c3a8c6042bd0145a485d3a5abc123def';
      formatLogContent({
        request: {
          sourceIdOrKey: 'test-e2e-sharepoint-documents',
          dataplaneUrl: 'http://localhost:3111'
        },
        response: {
          success: true,
          auditLog: [{ executionId: fullExecutionId }]
        }
      }, 'test-e2e', 'test-e2e-log.json');
      const calls = logger.log.mock.calls.map(c => String(c[0]));
      expect(calls.some(s => s.includes(fullExecutionId) && s.includes('executionId:'))).toBe(true);
      expect(calls.some(s =>
        s.includes('Link:') && s.includes('/api/v1/external/test-e2e-sharepoint-documents/executions/' + fullExecutionId)
      )).toBe(true);
    });

    it('should show full executionId without link when dataplaneUrl missing', () => {
      const fullExecutionId = 'c3a8c6042bd0145a485d3a5';
      formatLogContent({
        request: { sourceIdOrKey: 'my-ds' },
        response: { success: true, auditLog: [{ executionId: fullExecutionId }] }
      }, 'test-e2e');
      const calls = logger.log.mock.calls.map(c => String(c[0]));
      expect(calls.some(s => s.includes(fullExecutionId))).toBe(true);
      expect(calls.some(s => s.includes('Link:') && s.includes('/api/v1/external/'))).toBe(false);
    });

    it('should format integration log with validation and field mapping', () => {
      formatLogContent({
        request: { systemKey: 'sys', datasourceKey: 'ds-key' },
        response: {
          success: true,
          validationResults: { isValid: true },
          fieldMappingResults: { mappingCount: 5 }
        }
      }, 'test-integration', 'test-integration-123.json');
      expect(logger.log).toHaveBeenCalled();
      const calls = logger.log.mock.calls.map(c => String(c[0]));
      expect(calls.some(s => s.includes('Integration Log'))).toBe(true);
      expect(calls.some(s => s.includes('systemKey'))).toBe(true);
      expect(calls.some(s => s.includes('mappingCount'))).toBe(true);
    });
  });

  describe('runLogViewer', () => {
    it('should use --file when provided', async() => {
      fs.readFile = jest.fn().mockResolvedValue(JSON.stringify({
        request: { sourceIdOrKey: 'ds-key' },
        response: { success: true }
      }));
      await runLogViewer('ignored-key', { file: '/path/to/log.json', logType: 'test-e2e' });
      expect(resolveAppKeyForDatasource).not.toHaveBeenCalled();
      expect(fs.readFile).toHaveBeenCalledWith(expect.stringContaining('log.json'), 'utf8');
    });

    it('should resolve app and get latest log when --file not provided', async() => {
      const path = require('path');
      fs.readdir = jest.fn().mockResolvedValue([
        { name: 'test-e2e-2026-01-01T12-00-00-000Z.json', isFile: () => true }
      ]);
      fs.stat = jest.fn().mockResolvedValue({ mtimeMs: 1000 });
      fs.readFile = jest.fn().mockResolvedValue(JSON.stringify({
        request: {},
        response: { success: true }
      }));
      await runLogViewer('my-datasource', { app: 'myapp', logType: 'test-e2e' });
      expect(resolveAppKeyForDatasource).toHaveBeenCalledWith('my-datasource', 'myapp');
      expect(fs.readFile).toHaveBeenCalled();
    });

    it('should throw when no log file found in app logs dir', async() => {
      fs.readdir = jest.fn().mockResolvedValue([]);
      await expect(
        runLogViewer('my-datasource', { logType: 'test-e2e' })
      ).rejects.toThrow('No test-e2e log found');
    });

    it('should throw when datasource key missing and no --file', async() => {
      await expect(
        runLogViewer('', { logType: 'test-e2e' })
      ).rejects.toThrow('Datasource key is required');
    });

    it('should throw when file content is invalid JSON', async() => {
      fs.readFile = jest.fn().mockResolvedValue('not valid json {');
      await expect(
        runLogViewer('any-key', { file: '/path/to/log.json', logType: 'test-e2e' })
      ).rejects.toThrow(/Invalid JSON/);
    });
  });
});
