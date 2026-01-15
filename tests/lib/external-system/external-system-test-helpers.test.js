/**
 * Tests for External System Test Helpers Module
 *
 * @fileoverview Unit tests for lib/external-system/test-helpers.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../../../lib/utils/logger');
const { validateAgainstSchema } = require('../../../lib/utils/external-system-validators');
const externalSystemSchema = require('../../../lib/schema/external-system.schema.json');

// Mock dependencies
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  return mockChalk;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/utils/external-system-validators', () => ({
  validateAgainstSchema: jest.fn()
}));

jest.mock('../../../lib/schema/external-system.schema.json', () => ({
  type: 'object',
  properties: {
    key: { type: 'string' },
    displayName: { type: 'string' }
  },
  required: ['key']
}), { virtual: true });

const {
  initializeTestResults,
  validateSystemFilesForTest,
  validateDatasourceFilesForTest
} = require('../../../lib/external-system/test-helpers');

describe('External System Test Helpers Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeTestResults', () => {
    it('should initialize test results with correct structure', () => {
      const result = initializeTestResults();

      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [],
        systemResults: [],
        datasourceResults: []
      });
    });

    it('should return a new object each time', () => {
      const result1 = initializeTestResults();
      const result2 = initializeTestResults();

      expect(result1).not.toBe(result2);
      result1.valid = false;
      expect(result2.valid).toBe(true);
    });
  });

  describe('validateSystemFilesForTest', () => {
    it('should validate system files and update results when valid', () => {
      const systemFiles = [
        {
          path: '/path/to/system1.json',
          data: {
            key: 'system1',
            displayName: 'System 1'
          }
        },
        {
          path: '/path/to/system2.json',
          data: {
            key: 'system2',
            displayName: 'System 2'
          }
        }
      ];

      validateAgainstSchema.mockReturnValue({ valid: true, errors: [] });

      const results = initializeTestResults();
      validateSystemFilesForTest(systemFiles, results);

      expect(logger.log).toHaveBeenCalledWith(chalk.blue('📋 Validating system files...'));
      expect(validateAgainstSchema).toHaveBeenCalledTimes(2);
      expect(results.valid).toBe(true);
      expect(results.errors).toEqual([]);
      expect(results.systemResults).toHaveLength(2);
      expect(results.systemResults[0]).toEqual({
        file: '/path/to/system1.json',
        valid: true,
        errors: []
      });
      expect(results.systemResults[1]).toEqual({
        file: '/path/to/system2.json',
        valid: true,
        errors: []
      });
    });

    it('should mark results as invalid when system file validation fails', () => {
      const systemFiles = [
        {
          path: '/path/to/system1.json',
          data: {
            key: 'system1'
            // missing displayName
          }
        }
      ];

      validateAgainstSchema.mockReturnValue({
        valid: false,
        errors: ['displayName is required']
      });

      const results = initializeTestResults();
      validateSystemFilesForTest(systemFiles, results);

      expect(results.valid).toBe(false);
      expect(results.errors).toEqual(['displayName is required']);
      expect(results.systemResults[0]).toEqual({
        file: '/path/to/system1.json',
        valid: false,
        errors: ['displayName is required']
      });
    });

    it('should handle multiple system files with mixed validation results', () => {
      const systemFiles = [
        {
          path: '/path/to/system1.json',
          data: { key: 'system1', displayName: 'System 1' }
        },
        {
          path: '/path/to/system2.json',
          data: { key: 'system2' }
        }
      ];

      validateAgainstSchema
        .mockReturnValueOnce({ valid: true, errors: [] })
        .mockReturnValueOnce({ valid: false, errors: ['displayName is required'] });

      const results = initializeTestResults();
      validateSystemFilesForTest(systemFiles, results);

      expect(results.valid).toBe(false);
      expect(results.errors).toEqual(['displayName is required']);
      expect(results.systemResults).toHaveLength(2);
      expect(results.systemResults[0].valid).toBe(true);
      expect(results.systemResults[1].valid).toBe(false);
    });

    it('should use file property if path is not available', () => {
      const systemFiles = [
        {
          file: '/path/to/system1.json',
          data: { key: 'system1', displayName: 'System 1' }
        }
      ];

      validateAgainstSchema.mockReturnValue({ valid: true, errors: [] });

      const results = initializeTestResults();
      validateSystemFilesForTest(systemFiles, results);

      expect(results.systemResults[0].file).toBe('/path/to/system1.json');
    });

    it('should handle empty system files array', () => {
      const systemFiles = [];

      const results = initializeTestResults();
      validateSystemFilesForTest(systemFiles, results);

      expect(logger.log).toHaveBeenCalledWith(chalk.blue('📋 Validating system files...'));
      expect(validateAgainstSchema).not.toHaveBeenCalled();
      expect(results.systemResults).toEqual([]);
    });

    it('should handle system files with no errors array in validation result', () => {
      const systemFiles = [
        {
          path: '/path/to/system1.json',
          data: { key: 'system1', displayName: 'System 1' }
        }
      ];

      validateAgainstSchema.mockReturnValue({ valid: true });

      const results = initializeTestResults();
      validateSystemFilesForTest(systemFiles, results);

      expect(results.systemResults[0].errors).toEqual([]);
    });
  });

  describe('validateDatasourceFilesForTest', () => {
    const mockValidateSingleDatasource = jest.fn();
    const mockDetermineDatasourcesToTest = jest.fn();

    beforeEach(() => {
      mockValidateSingleDatasource.mockClear();
      mockDetermineDatasourcesToTest.mockClear();
    });

    it('should validate datasource files and update results when valid', () => {
      const datasourceFiles = [
        {
          path: '/path/to/datasource1.json',
          data: { key: 'datasource1' }
        },
        {
          path: '/path/to/datasource2.json',
          data: { key: 'datasource2' }
        }
      ];

      const systemFiles = [
        {
          path: '/path/to/system.json',
          data: { key: 'system1' }
        }
      ];

      const options = { datasource: null, verbose: false };
      const datasourceSchema = { type: 'object' };

      mockDetermineDatasourcesToTest.mockReturnValue(datasourceFiles);
      mockValidateSingleDatasource
        .mockReturnValueOnce({
          key: 'datasource1',
          valid: true,
          errors: []
        })
        .mockReturnValueOnce({
          key: 'datasource2',
          valid: true,
          errors: []
        });

      const results = initializeTestResults();
      validateDatasourceFilesForTest(
        datasourceFiles,
        systemFiles,
        results,
        options,
        mockValidateSingleDatasource,
        mockDetermineDatasourcesToTest
      );

      expect(logger.log).toHaveBeenCalledWith(chalk.blue('📋 Validating datasource files...'));
      expect(mockDetermineDatasourcesToTest).toHaveBeenCalledWith(datasourceFiles, null);
      expect(mockValidateSingleDatasource).toHaveBeenCalledTimes(2);
      expect(results.valid).toBe(true);
      expect(results.datasourceResults).toHaveLength(2);
    });

    it('should mark results as invalid when datasource validation fails', () => {
      const datasourceFiles = [
        {
          path: '/path/to/datasource1.json',
          data: { key: 'datasource1' }
        }
      ];

      const systemFiles = [
        {
          path: '/path/to/system.json',
          data: { key: 'system1' }
        }
      ];

      const options = { datasource: null, verbose: false };

      mockDetermineDatasourcesToTest.mockReturnValue(datasourceFiles);
      mockValidateSingleDatasource.mockReturnValue({
        key: 'datasource1',
        valid: false,
        errors: ['Validation error']
      });

      const results = initializeTestResults();
      validateDatasourceFilesForTest(
        datasourceFiles,
        systemFiles,
        results,
        options,
        mockValidateSingleDatasource,
        mockDetermineDatasourcesToTest
      );

      expect(results.valid).toBe(false);
      expect(results.datasourceResults).toHaveLength(1);
      expect(results.datasourceResults[0].valid).toBe(false);
    });

    it('should filter datasources based on options.datasource', () => {
      const datasourceFiles = [
        {
          path: '/path/to/datasource1.json',
          data: { key: 'datasource1' }
        },
        {
          path: '/path/to/datasource2.json',
          data: { key: 'datasource2' }
        }
      ];

      const systemFiles = [
        {
          path: '/path/to/system.json',
          data: { key: 'system1' }
        }
      ];

      const options = { datasource: 'datasource1', verbose: false };
      const filteredFiles = [datasourceFiles[0]];

      mockDetermineDatasourcesToTest.mockReturnValue(filteredFiles);
      mockValidateSingleDatasource.mockReturnValue({
        key: 'datasource1',
        valid: true,
        errors: []
      });

      const results = initializeTestResults();
      validateDatasourceFilesForTest(
        datasourceFiles,
        systemFiles,
        results,
        options,
        mockValidateSingleDatasource,
        mockDetermineDatasourcesToTest
      );

      expect(mockDetermineDatasourcesToTest).toHaveBeenCalledWith(datasourceFiles, 'datasource1');
      expect(mockValidateSingleDatasource).toHaveBeenCalledTimes(1);
      expect(results.datasourceResults).toHaveLength(1);
    });

    it('should extract system key from system files', () => {
      const datasourceFiles = [
        {
          path: '/path/to/datasource1.json',
          data: { key: 'datasource1' }
        }
      ];

      const systemFiles = [
        {
          path: '/path/to/system.json',
          data: { key: 'system1' }
        }
      ];

      const options = { datasource: null, verbose: false };

      mockDetermineDatasourcesToTest.mockReturnValue(datasourceFiles);
      mockValidateSingleDatasource.mockReturnValue({
        key: 'datasource1',
        valid: true,
        errors: []
      });

      const results = initializeTestResults();
      validateDatasourceFilesForTest(
        datasourceFiles,
        systemFiles,
        results,
        options,
        mockValidateSingleDatasource,
        mockDetermineDatasourcesToTest
      );

      expect(mockValidateSingleDatasource).toHaveBeenCalledWith(
        datasourceFiles[0],
        'system1',
        expect.any(Object),
        false
      );
    });

    it('should handle empty system files array', () => {
      const datasourceFiles = [
        {
          path: '/path/to/datasource1.json',
          data: { key: 'datasource1' }
        }
      ];

      const systemFiles = [];
      const options = { datasource: null, verbose: false };

      mockDetermineDatasourcesToTest.mockReturnValue(datasourceFiles);
      mockValidateSingleDatasource.mockReturnValue({
        key: 'datasource1',
        valid: true,
        errors: []
      });

      const results = initializeTestResults();
      validateDatasourceFilesForTest(
        datasourceFiles,
        systemFiles,
        results,
        options,
        mockValidateSingleDatasource,
        mockDetermineDatasourcesToTest
      );

      expect(mockValidateSingleDatasource).toHaveBeenCalledWith(
        datasourceFiles[0],
        null,
        expect.any(Object),
        false
      );
    });

    it('should pass verbose option to validateSingleDatasource', () => {
      const datasourceFiles = [
        {
          path: '/path/to/datasource1.json',
          data: { key: 'datasource1' }
        }
      ];

      const systemFiles = [
        {
          path: '/path/to/system.json',
          data: { key: 'system1' }
        }
      ];

      const options = { datasource: null, verbose: true };

      mockDetermineDatasourcesToTest.mockReturnValue(datasourceFiles);
      mockValidateSingleDatasource.mockReturnValue({
        key: 'datasource1',
        valid: true,
        errors: []
      });

      const results = initializeTestResults();
      validateDatasourceFilesForTest(
        datasourceFiles,
        systemFiles,
        results,
        options,
        mockValidateSingleDatasource,
        mockDetermineDatasourcesToTest
      );

      expect(mockValidateSingleDatasource).toHaveBeenCalledWith(
        expect.any(Object),
        'system1',
        expect.any(Object),
        true
      );
    });

    it('should handle empty datasource files array', () => {
      const datasourceFiles = [];
      const systemFiles = [
        {
          path: '/path/to/system.json',
          data: { key: 'system1' }
        }
      ];

      const options = { datasource: null, verbose: false };

      mockDetermineDatasourcesToTest.mockReturnValue([]);

      const results = initializeTestResults();
      validateDatasourceFilesForTest(
        datasourceFiles,
        systemFiles,
        results,
        options,
        mockValidateSingleDatasource,
        mockDetermineDatasourcesToTest
      );

      expect(mockValidateSingleDatasource).not.toHaveBeenCalled();
      expect(results.datasourceResults).toEqual([]);
    });

    it('should handle mixed validation results for multiple datasources', () => {
      const datasourceFiles = [
        {
          path: '/path/to/datasource1.json',
          data: { key: 'datasource1' }
        },
        {
          path: '/path/to/datasource2.json',
          data: { key: 'datasource2' }
        }
      ];

      const systemFiles = [
        {
          path: '/path/to/system.json',
          data: { key: 'system1' }
        }
      ];

      const options = { datasource: null, verbose: false };

      mockDetermineDatasourcesToTest.mockReturnValue(datasourceFiles);
      mockValidateSingleDatasource
        .mockReturnValueOnce({
          key: 'datasource1',
          valid: true,
          errors: []
        })
        .mockReturnValueOnce({
          key: 'datasource2',
          valid: false,
          errors: ['Error']
        });

      const results = initializeTestResults();
      validateDatasourceFilesForTest(
        datasourceFiles,
        systemFiles,
        results,
        options,
        mockValidateSingleDatasource,
        mockDetermineDatasourcesToTest
      );

      expect(results.valid).toBe(false);
      expect(results.datasourceResults).toHaveLength(2);
      expect(results.datasourceResults[0].valid).toBe(true);
      expect(results.datasourceResults[1].valid).toBe(false);
    });
  });
});

