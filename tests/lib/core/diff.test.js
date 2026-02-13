/**
 * Tests for AI Fabrix Builder Diff Module
 *
 * @fileoverview Unit tests for diff.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Mock modules
jest.mock('fs');
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const fsSync = require('fs');
const logger = require('../../../lib/utils/logger');

describe('Diff Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('compareObjects', () => {
    it('should identify identical objects', () => {
      const { compareObjects } = require('../../../lib/core/diff');
      const obj1 = { key: 'value', nested: { prop: 'test' } };
      const obj2 = { key: 'value', nested: { prop: 'test' } };

      const result = compareObjects(obj1, obj2);

      expect(result.identical).toBe(true);
      expect(result.added).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
      expect(result.changed).toHaveLength(0);
    });

    it('should identify added fields', () => {
      const { compareObjects } = require('../../../lib/core/diff');
      const obj1 = { key: 'value' };
      const obj2 = { key: 'value', newField: 'new' };

      const result = compareObjects(obj1, obj2);

      expect(result.identical).toBe(false);
      expect(result.added).toHaveLength(1);
      expect(result.added[0].path).toBe('newField');
      expect(result.added[0].value).toBe('new');
    });

    it('should identify removed fields', () => {
      const { compareObjects } = require('../../../lib/core/diff');
      const obj1 = { key: 'value', oldField: 'old' };
      const obj2 = { key: 'value' };

      const result = compareObjects(obj1, obj2);

      expect(result.identical).toBe(false);
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0].path).toBe('oldField');
      expect(result.removed[0].value).toBe('old');
    });

    it('should identify changed fields', () => {
      const { compareObjects } = require('../../../lib/core/diff');
      const obj1 = { key: 'value1' };
      const obj2 = { key: 'value2' };

      const result = compareObjects(obj1, obj2);

      expect(result.identical).toBe(false);
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].path).toBe('key');
      expect(result.changed[0].oldValue).toBe('value1');
      expect(result.changed[0].newValue).toBe('value2');
    });

    it('should handle nested objects', () => {
      const { compareObjects } = require('../../../lib/core/diff');
      const obj1 = { nested: { prop: 'old' } };
      const obj2 = { nested: { prop: 'new', newProp: 'value' } };

      const result = compareObjects(obj1, obj2);

      expect(result.identical).toBe(false);
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].path).toBe('nested.prop');
      expect(result.added).toHaveLength(1);
      expect(result.added[0].path).toBe('nested.newProp');
    });

    it('should handle null and undefined values', () => {
      const { compareObjects } = require('../../../lib/core/diff');
      const obj1 = { key: null };
      const obj2 = { key: undefined };

      const result = compareObjects(obj1, obj2);

      expect(result.identical).toBe(false);
      expect(result.changed).toHaveLength(1);
    });

    it('should handle empty objects', () => {
      const { compareObjects } = require('../../../lib/core/diff');
      const obj1 = {};
      const obj2 = {};

      const result = compareObjects(obj1, obj2);

      expect(result.identical).toBe(true);
    });
  });

  describe('identifyBreakingChanges', () => {
    it('should identify removed fields as breaking', () => {
      const { identifyBreakingChanges, compareObjects } = require('../../../lib/core/diff');
      const obj1 = { required: 'field' };
      const obj2 = {};

      const comparison = compareObjects(obj1, obj2);
      const breaking = identifyBreakingChanges(comparison);

      expect(breaking).toHaveLength(1);
      expect(breaking[0].type).toBe('removed_field');
      expect(breaking[0].path).toBe('required');
    });

    it('should identify type changes as breaking', () => {
      const { identifyBreakingChanges, compareObjects } = require('../../../lib/core/diff');
      const obj1 = { field: 'string' };
      const obj2 = { field: 123 };

      const comparison = compareObjects(obj1, obj2);
      const breaking = identifyBreakingChanges(comparison);

      expect(breaking).toHaveLength(1);
      expect(breaking[0].type).toBe('type_change');
      expect(breaking[0].path).toBe('field');
    });

    it('should not identify value-only changes as breaking', () => {
      const { identifyBreakingChanges, compareObjects } = require('../../../lib/core/diff');
      const obj1 = { field: 'value1' };
      const obj2 = { field: 'value2' };

      const comparison = compareObjects(obj1, obj2);
      const breaking = identifyBreakingChanges(comparison);

      expect(breaking).toHaveLength(0);
    });
  });

  describe('compareFiles', () => {
    const noValidate = { validate: false };

    it('should compare identical files', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const content = JSON.stringify({ key: 'value', version: '1.0.0' });

      fsSync.existsSync.mockImplementation((filePath) => filePath === file1 || filePath === file2);
      fsSync.readFileSync.mockReturnValue(content);

      const { compareFiles } = require('../../../lib/core/diff');
      const result = await compareFiles(file1, file2, noValidate);

      expect(result.identical).toBe(true);
      expect(result.version1).toBe('1.0.0');
      expect(result.version2).toBe('1.0.0');
    });

    it('should compare different files', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const content1 = JSON.stringify({ key: 'value1', version: '1.0.0' });
      const content2 = JSON.stringify({ key: 'value2', version: '2.0.0' });

      fsSync.existsSync.mockImplementation((filePath) => filePath === file1 || filePath === file2);
      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === file1) return content1;
        if (filePath === file2) return content2;
        return '';
      });

      const { compareFiles } = require('../../../lib/core/diff');
      const result = await compareFiles(file1, file2, noValidate);

      expect(result.identical).toBe(false);
      expect(result.changed.length).toBeGreaterThanOrEqual(1);
      expect(result.changed.some(c => c.path === 'key')).toBe(true);
      expect(result.versionChanged).toBe(true);
    });

    it('should extract version from metadata', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const content1 = JSON.stringify({ metadata: { version: '1.0.0' } });
      const content2 = JSON.stringify({ metadata: { version: '2.0.0' } });

      fsSync.existsSync.mockImplementation((filePath) => filePath === file1 || filePath === file2);
      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === file1) return content1;
        if (filePath === file2) return content2;
        return '';
      });

      const { compareFiles } = require('../../../lib/core/diff');
      const result = await compareFiles(file1, file2, noValidate);

      expect(result.version1).toBe('1.0.0');
      expect(result.version2).toBe('2.0.0');
      expect(result.versionChanged).toBe(true);
    });

    it('should throw error if file1 is missing', async() => {
      const file1 = '/path/to/nonexistent1.json';
      const file2 = '/path/to/file2.json';

      fsSync.existsSync.mockImplementation((filePath) => filePath === file2);

      const { compareFiles } = require('../../../lib/core/diff');
      await expect(compareFiles(file1, file2)).rejects.toThrow('File not found');
    });

    it('should throw error if file2 is missing', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/nonexistent2.json';

      fsSync.existsSync.mockImplementation((filePath) => filePath === file1);

      const { compareFiles } = require('../../../lib/core/diff');
      await expect(compareFiles(file1, file2)).rejects.toThrow('File not found');
    });

    it('should throw error on invalid JSON in file1', async() => {
      const file1 = '/path/to/invalid1.json';
      const file2 = '/path/to/file2.json';

      fsSync.existsSync.mockImplementation((filePath) => filePath === file1 || filePath === file2);
      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === file1) return 'invalid json {';
        if (filePath === file2) return '{}';
        return '';
      });

      const { compareFiles } = require('../../../lib/core/diff');
      await expect(compareFiles(file1, file2, noValidate)).rejects.toThrow('Failed to parse');
    });

    it('should throw error on invalid JSON in file2', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/invalid2.json';

      fsSync.existsSync.mockImplementation((filePath) => filePath === file1 || filePath === file2);
      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === file1) return '{}';
        if (filePath === file2) return 'invalid json {';
        return '';
      });

      const { compareFiles } = require('../../../lib/core/diff');
      await expect(compareFiles(file1, file2, noValidate)).rejects.toThrow('Failed to parse');
    });

    it('should throw error if file1 path is missing', async() => {
      const { compareFiles } = require('../../../lib/core/diff');
      await expect(compareFiles(null, '/path/to/file2.json')).rejects.toThrow('First file path is required');
      await expect(compareFiles('', '/path/to/file2.json')).rejects.toThrow('First file path is required');
    });

    it('should throw error if file2 path is missing', async() => {
      const { compareFiles } = require('../../../lib/core/diff');
      await expect(compareFiles('/path/to/file1.json', null)).rejects.toThrow('Second file path is required');
      await expect(compareFiles('/path/to/file1.json', '')).rejects.toThrow('Second file path is required');
    });

    it('should calculate summary statistics', async() => {
      const file1 = '/path/to/file1.json';
      const file2 = '/path/to/file2.json';
      const content1 = JSON.stringify({ old: 'value', changed: 'old' });
      const content2 = JSON.stringify({ new: 'value', changed: 'new' });

      fsSync.existsSync.mockImplementation((filePath) => filePath === file1 || filePath === file2);
      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === file1) return content1;
        if (filePath === file2) return content2;
        return '';
      });

      const { compareFiles } = require('../../../lib/core/diff');
      const result = await compareFiles(file1, file2, noValidate);

      expect(result.summary.totalAdded).toBe(1);
      expect(result.summary.totalRemoved).toBe(1);
      expect(result.summary.totalChanged).toBe(1);
    });

    it('should throw on type mismatch (app vs system)', async() => {
      const file1 = '/path/to/app.json';
      const file2 = '/path/to/system.json';
      const appContent = JSON.stringify({
        key: 'myapp',
        displayName: 'My App',
        description: 'An app',
        type: 'standard',
        image: 'img',
        registryMode: 'acr',
        port: 8080
      });
      const systemContent = JSON.stringify({
        key: 'sys1',
        displayName: 'System',
        type: 'openapi',
        authentication: {}
      });

      fsSync.existsSync.mockImplementation((filePath) => filePath === file1 || filePath === file2);
      fsSync.readFileSync.mockImplementation((filePath) => {
        if (filePath === file1) return appContent;
        if (filePath === file2) return systemContent;
        return '{}';
      });

      const { compareFiles } = require('../../../lib/core/diff');
      await expect(compareFiles(file1, file2, noValidate)).rejects.toThrow('Type mismatch');
      await expect(compareFiles(file1, file2, noValidate)).rejects.toThrow('app');
      await expect(compareFiles(file1, file2, noValidate)).rejects.toThrow('system');
    });

    it('should run comparison when types match with validate false', async() => {
      const file1 = '/path/to/a.json';
      const file2 = '/path/to/b.json';
      const content = JSON.stringify({ key: 'v', version: '1.0.0' });

      fsSync.existsSync.mockImplementation((filePath) => filePath === file1 || filePath === file2);
      fsSync.readFileSync.mockReturnValue(content);

      const { compareFiles } = require('../../../lib/core/diff');
      const result = await compareFiles(file1, file2, noValidate);
      expect(result.identical).toBe(true);
    });
  });

  describe('formatDiffOutput', () => {
    it('should display identical files message', () => {
      const { formatDiffOutput } = require('../../../lib/core/diff');
      const result = {
        file1: 'file1.json',
        file2: 'file2.json',
        identical: true
      };

      formatDiffOutput(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Files are identical'));
    });

    it('should display differences', () => {
      const { formatDiffOutput } = require('../../../lib/core/diff');
      const result = {
        file1: 'file1.json',
        file2: 'file2.json',
        identical: false,
        versionChanged: true,
        version1: '1.0.0',
        version2: '2.0.0',
        added: [{ path: 'newField', value: 'new' }],
        removed: [{ path: 'oldField', value: 'old' }],
        changed: [{ path: 'changed', oldValue: 'old', newValue: 'new' }],
        breakingChanges: [{ type: 'removed_field', description: 'Field removed' }],
        summary: {
          totalAdded: 1,
          totalRemoved: 1,
          totalChanged: 1,
          totalBreaking: 1
        }
      };

      formatDiffOutput(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Files are different'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Version'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Breaking Changes'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Added Fields'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Removed Fields'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Changed Fields'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Summary'));
    });
  });
});

