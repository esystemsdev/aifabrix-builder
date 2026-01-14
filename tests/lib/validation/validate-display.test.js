/**
 * Tests for Validate Display Functions
 *
 * @fileoverview Unit tests for displayValidationResults function in validate.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/logger');
jest.mock('chalk', () => {
  const createMockFn = (text) => text;
  const mockChalk = createMockFn;
  ['blue', 'green', 'red', 'yellow'].forEach(prop => {
    mockChalk[prop] = createMockFn;
  });
  return mockChalk;
});

const validate = require('../../../lib/validation/validate');
const logger = require('../../../lib/utils/logger');

describe('Validate Display Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('displayValidationResults', () => {
    it('should display success message when validation passes', () => {
      const result = {
        valid: true,
        application: {
          valid: true,
          errors: [],
          warnings: []
        }
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✓ Validation passed!'));
    });

    it('should display failure message when validation fails', () => {
      const result = {
        valid: false,
        application: {
          valid: false,
          errors: ['Error 1', 'Error 2'],
          warnings: []
        }
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✗ Validation failed!'));
    });

    it('should display application validation when valid', () => {
      const result = {
        valid: true,
        application: {
          valid: true,
          errors: [],
          warnings: []
        }
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application configuration is valid'));
    });

    it('should display application validation errors when invalid', () => {
      const result = {
        valid: false,
        application: {
          valid: false,
          errors: ['Missing required field: name', 'Invalid port number'],
          warnings: []
        }
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application configuration has errors:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Missing required field: name'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Invalid port number'));
    });

    it('should display application warnings', () => {
      const result = {
        valid: true,
        application: {
          valid: true,
          errors: [],
          warnings: ['Warning: Deprecated field used', 'Warning: Optional field missing']
        }
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Deprecated field used'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Optional field missing'));
    });

    it('should display external files validation when present', () => {
      const result = {
        valid: true,
        application: {
          valid: true,
          errors: [],
          warnings: []
        },
        externalFiles: [
          {
            file: 'system.json',
            type: 'system',
            valid: true,
            errors: [],
            warnings: []
          },
          {
            file: 'datasource.json',
            type: 'datasource',
            valid: false,
            errors: ['Invalid schema'],
            warnings: []
          }
        ]
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('External Integration Files:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('system.json'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('datasource.json'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Invalid schema'));
    });

    it('should display external file warnings', () => {
      const result = {
        valid: true,
        application: {
          valid: true,
          errors: [],
          warnings: []
        },
        externalFiles: [
          {
            file: 'system.json',
            type: 'system',
            valid: true,
            errors: [],
            warnings: ['Warning: Optional field missing']
          }
        ]
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Optional field missing'));
    });

    it('should display file validation when result.file is present', () => {
      const result = {
        valid: true,
        file: '/path/to/file.json',
        type: 'application',
        errors: [],
        warnings: []
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('File: /path/to/file.json'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Type: application'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('File is valid'));
    });

    it('should display file validation errors when file is invalid', () => {
      const result = {
        valid: false,
        file: '/path/to/file.json',
        type: 'application',
        errors: ['Invalid JSON syntax', 'Missing required field'],
        warnings: []
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('File has errors:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON syntax'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Missing required field'));
    });

    it('should display file warnings', () => {
      const result = {
        valid: true,
        file: '/path/to/file.json',
        type: 'application',
        errors: [],
        warnings: ['Warning: Deprecated syntax']
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Deprecated syntax'));
    });

    it('should display aggregated warnings', () => {
      const result = {
        valid: true,
        application: {
          valid: true,
          errors: [],
          warnings: []
        },
        warnings: ['Global warning 1', 'Global warning 2']
      };

      validate.displayValidationResults(result);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warnings:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Global warning 1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Global warning 2'));
    });

    it('should handle result without application property', () => {
      const result = {
        valid: true,
        file: '/path/to/file.json',
        type: 'application',
        errors: [],
        warnings: []
      };

      expect(() => {
        validate.displayValidationResults(result);
      }).not.toThrow();
    });

    it('should handle result without externalFiles property', () => {
      const result = {
        valid: true,
        application: {
          valid: true,
          errors: [],
          warnings: []
        }
      };

      expect(() => {
        validate.displayValidationResults(result);
      }).not.toThrow();
    });

    it('should handle empty errors array', () => {
      const result = {
        valid: false,
        application: {
          valid: false,
          errors: [],
          warnings: []
        }
      };

      expect(() => {
        validate.displayValidationResults(result);
      }).not.toThrow();
    });

    it('should handle empty warnings array', () => {
      const result = {
        valid: true,
        application: {
          valid: true,
          errors: [],
          warnings: []
        },
        warnings: []
      };

      expect(() => {
        validate.displayValidationResults(result);
      }).not.toThrow();
    });
  });
});

