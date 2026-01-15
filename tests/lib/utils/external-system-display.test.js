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

    it('should display invalid system results', () => {
      const results = {
        valid: false,
        systemResults: [{ file: 'system.json', valid: false }],
        datasourceResults: [],
        errors: [],
        warnings: []
      };

      displayTestResults(results, false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✗'));
    });

    it('should display invalid datasource results with errors in verbose mode', () => {
      const results = {
        valid: false,
        systemResults: [],
        datasourceResults: [
          {
            key: 'datasource1',
            file: 'datasource1.json',
            valid: false,
            errors: ['Error 1', 'Error 2'],
            warnings: []
          }
        ],
        errors: [],
        warnings: []
      };

      displayTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✗'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Error 1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Error 2'));
    });

    it('should display invalid metadata schema in verbose mode', () => {
      const results = {
        valid: true,
        systemResults: [],
        datasourceResults: [
          {
            key: 'datasource1',
            file: 'datasource1.json',
            valid: true,
            errors: [],
            warnings: [],
            metadataSchemaResults: { valid: false }
          }
        ],
        errors: [],
        warnings: []
      };

      displayTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Metadata schema: ✗ Invalid'));
    });

    it('should display errors array', () => {
      const results = {
        valid: false,
        systemResults: [],
        datasourceResults: [],
        errors: ['Error 1', 'Error 2'],
        warnings: []
      };

      displayTestResults(results, false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('❌ Errors:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Error 1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Error 2'));
    });

    it('should display warnings array', () => {
      const results = {
        valid: true,
        systemResults: [],
        datasourceResults: [],
        errors: [],
        warnings: ['Warning 1', 'Warning 2']
      };

      displayTestResults(results, false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('⚠ Warnings:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning 1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning 2'));
    });

    it('should display failed tests message', () => {
      const results = {
        valid: false,
        systemResults: [],
        datasourceResults: [],
        errors: [],
        warnings: []
      };

      displayTestResults(results, false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('❌ Some tests failed'));
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

    it('should handle empty system results', () => {
      const results = {
        valid: true,
        systemResults: [],
        datasourceResults: [],
        errors: [],
        warnings: []
      };

      displayTestResults(results, false);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should handle empty datasource results', () => {
      const results = {
        valid: true,
        systemResults: [{ file: 'system.json', valid: true }],
        datasourceResults: [],
        errors: [],
        warnings: []
      };

      displayTestResults(results, false);
      expect(logger.log).toHaveBeenCalled();
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

    it('should display no datasources tested message', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: []
      };

      displayIntegrationTestResults(results, false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No datasources tested'));
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

    it('should display failed datasource with error', () => {
      const results = {
        success: false,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: false,
            error: 'Connection failed'
          }
        ]
      };

      displayIntegrationTestResults(results, false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✗'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Error: Connection failed'));
    });

    it('should display failed integration tests message', () => {
      const results = {
        success: false,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: false,
            error: 'Connection failed'
          }
        ]
      };

      displayIntegrationTestResults(results, false);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('❌ Some integration tests failed'));
    });

    it('should display verbose validation results when valid', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true,
              errors: [],
              warnings: []
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Validation: ✓ Valid'));
    });

    it('should display verbose validation results when invalid', () => {
      const results = {
        success: false,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: false,
            validationResults: {
              isValid: false,
              errors: ['Validation error 1', 'Validation error 2'],
              warnings: ['Warning 1']
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Validation: ✗ Invalid'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Validation error 1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Validation error 2'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning 1'));
    });

    it('should display verbose field mapping results', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true
            },
            fieldMappingResults: {
              mappingCount: 5,
              dimensions: { field1: 'metadata.field1', field2: 'metadata.field2', field3: 'metadata.field3' }
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Field mappings: 5 attributes'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dimensions: field1, field2, field3'));
    });

    it('should display verbose field mapping results without access fields', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true
            },
            fieldMappingResults: {
              mappingCount: 3
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Field mappings: 3 attributes'));
    });

    it('should display verbose endpoint test results when configured', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true
            },
            endpointTestResults: {
              endpointConfigured: true
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Endpoint: ✓ Configured'));
    });

    it('should display verbose endpoint test results when not configured', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true
            },
            endpointTestResults: {
              endpointConfigured: false
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Endpoint: Not configured'));
    });

    it('should display all verbose information together', () => {
      const results = {
        success: true,
        systemKey: 'hubspot',
        datasourceResults: [
          {
            key: 'datasource1',
            skipped: false,
            success: true,
            validationResults: {
              isValid: true,
              errors: [],
              warnings: ['Warning']
            },
            fieldMappingResults: {
              mappingCount: 10,
              dimensions: { field1: 'metadata.field1' }
            },
            endpointTestResults: {
              endpointConfigured: true
            }
          }
        ]
      };

      displayIntegrationTestResults(results, true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Validation: ✓ Valid'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Field mappings: 10 attributes'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Endpoint: ✓ Configured'));
    });
  });
});
