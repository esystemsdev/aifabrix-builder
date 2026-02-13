/**
 * Validation Error Formatters Tests
 *
 * Comprehensive unit tests for validation error formatting functions
 *
 * @fileoverview Tests for validation-errors.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const validationErrors = require('../../../../lib/utils/error-formatters/validation-errors');

describe('Validation Error Formatters', () => {
  describe('formatValidationError', () => {
    it('should format validation error with detail field', () => {
      const errorData = {
        detail: 'Validation failed',
        errors: []
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('❌ Validation Error');
      expect(result).toContain('Validation failed');
    });

    it('should format validation error with title field', () => {
      const errorData = {
        title: 'Validation Error Title',
        errors: []
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('❌ Validation Error');
      expect(result).toContain('Validation Error Title');
    });

    it('should format validation error with errorDescription field', () => {
      const errorData = {
        errorDescription: 'Error description',
        error: 'ERROR_CODE',
        errors: []
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('❌ Validation Error');
      expect(result).toContain('Error description');
      expect(result).toContain('Error code: ERROR_CODE');
    });

    it('should format validation error with message field', () => {
      const errorData = {
        message: 'Validation message',
        errors: []
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('❌ Validation Error');
      expect(result).toContain('Validation message');
    });

    it('should format validation error with error field', () => {
      const errorData = {
        error: 'Validation error',
        errors: []
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('❌ Validation Error');
      expect(result).toContain('Validation error');
    });

    it('should format validation error with errors array', () => {
      const errorData = {
        errors: [
          { field: 'name', message: 'Name is required' },
          { field: 'email', message: 'Email is invalid' }
        ]
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('Validation errors:');
      expect(result).toContain('name: Name is required');
      expect(result).toContain('email: Email is invalid');
    });

    it('should format validation error with errors using path field', () => {
      const errorData = {
        errors: [
          { path: 'user.name', message: 'Invalid name' }
        ]
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('user.name: Invalid name');
    });

    it('should format validation error with errors using loc field', () => {
      const errorData = {
        errors: [
          { loc: ['user', 'email'], message: 'Invalid email' }
        ]
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('user.email: Invalid email');
    });

    it('should format validation error with errors using msg field', () => {
      const errorData = {
        errors: [
          { field: 'age', msg: 'Age must be a number' }
        ]
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('age: Age must be a number');
    });

    it('should format validation error with errors including value', () => {
      const errorData = {
        errors: [
          { field: 'age', message: 'Invalid age', value: 150 }
        ]
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('age: Invalid age (value: 150)');
    });

    it('should format validation error with generic validation field', () => {
      const errorData = {
        errors: [
          { field: 'validation', message: 'General validation error' }
        ]
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('• General validation error');
      expect(result).not.toContain('validation:');
    });

    it('should format validation error with unknown field', () => {
      const errorData = {
        errors: [
          { field: 'unknown', message: 'Unknown error' }
        ]
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('• Unknown error');
    });

    it('should format validation error with configuration errors array', () => {
      const errorData = {
        errors: [],
        configuration: {
          errors: [
            { field: 'port', message: 'Port must be between 1 and 65535' }
          ]
        }
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('Configuration errors:');
      expect(result).toContain('port: Port must be between 1 and 65535');
    });

    it('should format validation error with configuration errors object', () => {
      const errorData = {
        errors: [],
        configuration: {
          errors: {
            port: 'Port is required',
            host: 'Host is invalid'
          }
        }
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('Configuration errors:');
      expect(result).toContain('configuration.port: Port is required');
      expect(result).toContain('configuration.host: Host is invalid');
    });

    it('should include guidance tips when errors are present', () => {
      const errorData = {
        errors: [
          { field: 'name', message: 'Name is required' }
        ]
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('Tips:');
      expect(result).toContain('Check your application.yaml file');
      expect(result).toContain('Verify field names match');
      expect(result).toContain('Ensure required fields are present');
    });

    it('should not include guidance tips when no errors', () => {
      const errorData = {
        errors: []
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).not.toContain('Tips:');
    });

    it('should include instance when present', () => {
      const errorData = {
        errors: [],
        instance: '/api/v1/applications'
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('Endpoint: /api/v1/applications');
    });

    it('should include correlation ID when present', () => {
      const errorData = {
        errors: [],
        correlationId: 'corr-123'
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('Correlation ID: corr-123');
    });

    it('should handle empty errors array', () => {
      const errorData = {
        errors: []
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('❌ Validation Error');
      expect(result).not.toContain('Validation errors:');
    });

    it('should handle null errors', () => {
      const errorData = {
        errors: null
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('❌ Validation Error');
    });

    it('should handle missing errors field', () => {
      const errorData = {};
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('❌ Validation Error');
    });

    it('should handle errors with missing message', () => {
      const errorData = {
        errors: [
          { field: 'name' }
        ]
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('name: Invalid value');
    });

    it('should handle configuration errors with missing field', () => {
      const errorData = {
        errors: [],
        configuration: {
          errors: [
            { message: 'Configuration error without field' }
          ]
        }
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('configuration: Configuration error without field');
    });

    it('should handle configuration errors with missing message', () => {
      const errorData = {
        errors: [],
        configuration: {
          errors: [
            { field: 'port' }
          ]
        }
      };
      const result = validationErrors.formatValidationError(errorData);
      expect(result).toContain('port: Invalid value');
    });
  });
});

