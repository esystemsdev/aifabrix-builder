/**
 * Tests for AI Fabrix Builder Datasource Diff Module
 *
 * @fileoverview Unit tests for datasource-diff.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

// Mock modules
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});
jest.mock('../../../lib/core/diff', () => ({
  compareFiles: jest.fn(),
  formatDiffOutput: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const { compareFiles, formatDiffOutput } = require('../../../lib/core/diff');
const logger = require('../../../lib/utils/logger');

describe('Datasource Diff Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Prevent process.exit from actually exiting
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('compareDatasources', () => {
    it('should compare identical datasource files', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const mockResult = {
        identical: true,
        changed: []
      };

      compareFiles.mockResolvedValue(mockResult);

      const { compareDatasources } = require('../../../lib/datasource/diff');
      await compareDatasources(file1, file2);

      expect(compareFiles).toHaveBeenCalledWith(file1, file2);
      expect(formatDiffOutput).toHaveBeenCalledWith(mockResult);
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should compare different datasource files and exit with code 1', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const mockResult = {
        identical: false,
        changed: [
          { path: 'fieldMappings.field1', oldValue: 'old', newValue: 'new' },
          { path: 'exposed.fields', oldValue: [], newValue: ['field1'] }
        ]
      };

      compareFiles.mockResolvedValue(mockResult);

      const { compareDatasources } = require('../../../lib/datasource/diff');
      await compareDatasources(file1, file2);

      expect(compareFiles).toHaveBeenCalledWith(file1, file2);
      expect(formatDiffOutput).toHaveBeenCalledWith(mockResult);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dataplane-Relevant Changes'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should highlight fieldMappings changes', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const mockResult = {
        identical: false,
        changed: [
          { path: 'fieldMappings.field1', oldValue: 'old', newValue: 'new' },
          { path: 'fieldMappings.field2', oldValue: 'old2', newValue: 'new2' }
        ]
      };

      compareFiles.mockResolvedValue(mockResult);

      const { compareDatasources } = require('../../../lib/datasource/diff');
      await compareDatasources(file1, file2);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Field Mappings'));
    });

    it('should highlight exposed fields changes', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const mockResult = {
        identical: false,
        changed: [
          { path: 'exposed.fields', oldValue: [], newValue: ['field1'] }
        ]
      };

      compareFiles.mockResolvedValue(mockResult);

      const { compareDatasources } = require('../../../lib/datasource/diff');
      await compareDatasources(file1, file2);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Exposed Fields'));
    });

    it('should highlight sync configuration changes', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const mockResult = {
        identical: false,
        changed: [
          { path: 'sync.enabled', oldValue: false, newValue: true }
        ]
      };

      compareFiles.mockResolvedValue(mockResult);

      const { compareDatasources } = require('../../../lib/datasource/diff');
      await compareDatasources(file1, file2);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Sync Configuration'));
    });

    it('should highlight openapi configuration changes', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const mockResult = {
        identical: false,
        changed: [
          { path: 'openapi.endpoint', oldValue: '/old', newValue: '/new' }
        ]
      };

      compareFiles.mockResolvedValue(mockResult);

      const { compareDatasources } = require('../../../lib/datasource/diff');
      await compareDatasources(file1, file2);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('OpenAPI Configuration'));
    });

    it('should highlight mcp configuration changes', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const mockResult = {
        identical: false,
        changed: [
          { path: 'mcp.server', oldValue: 'old', newValue: 'new' }
        ]
      };

      compareFiles.mockResolvedValue(mockResult);

      const { compareDatasources } = require('../../../lib/datasource/diff');
      await compareDatasources(file1, file2);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('MCP Configuration'));
    });

    it('should not display dataplane section if no relevant changes', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const mockResult = {
        identical: false,
        changed: [
          { path: 'description', oldValue: 'old', newValue: 'new' }
        ]
      };

      compareFiles.mockResolvedValue(mockResult);

      const { compareDatasources } = require('../../../lib/datasource/diff');
      await compareDatasources(file1, file2);

      expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Dataplane-Relevant Changes'));
    });

    it('should handle errors from compareFiles', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';

      compareFiles.mockRejectedValue(new Error('Comparison failed'));

      const { compareDatasources } = require('../../../lib/datasource/diff');
      await expect(compareDatasources(file1, file2)).rejects.toThrow('Comparison failed');
    });
  });
});

