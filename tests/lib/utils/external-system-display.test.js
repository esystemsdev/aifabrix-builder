/**
 * Tests for External System Display Helpers
 *
 * @fileoverview Unit tests for external-system-display.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const {
  displayTestResults,
  displayIntegrationTestResults
} = require('../../../lib/utils/external-system-display');

describe('External System Display Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('displayTestResults', () => {
    it('should display test results correctly', () => {
      const results = {
        valid: true,
        systemResults: [{ file: 'system.json', valid: true }],
        datasourceResults: [
          {
            key: 'datasource1',
            file: 'datasource1.json',
            valid: true,
            errors: [],
            warnings: []
          }
        ],
        errors: [],
        warnings: []
      };

      displayTestResults(results, false);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should display verbose output when requested', () => {
      const results = {
        valid: true,
        systemResults: [],
        datasourceResults: [
          {
            key: 'datasource1',
            file: 'datasource1.json',
            valid: true,
            errors: [],
            warnings: ['Warning'],
            fieldMappingResults: { mappedFields: { field1: 'expr1' } },
            metadataSchemaResults: { valid: true }
          }
        ],
        errors: [],
        warnings: []
      };

      displayTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning'));
    });
  });

  describe('displayIntegrationTestResults', () => {
    it('should display integration test results correctly', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true
          }
        ]
      };

      displayIntegrationTestResults(results, false);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should display skipped datasources', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: true,
            reason: 'No test payload'
          }
        ]
      };

      displayIntegrationTestResults(results, false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No test payload'));
    });
  });
});
