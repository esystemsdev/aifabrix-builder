/**
 * HTTP Status Error Formatters Tests
 *
 * Comprehensive unit tests for HTTP status error formatting functions
 *
 * @fileoverview Tests for http-status-errors.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const httpStatusErrors = require('../../../../lib/utils/error-formatters/http-status-errors');

describe('HTTP Status Error Formatters', () => {
  describe('formatAuthenticationError', () => {
    it('should format authentication error with message', () => {
      const errorData = {
        message: 'Invalid credentials'
      };
      const result = httpStatusErrors.formatAuthenticationError(errorData);
      expect(result).toContain('❌ Authentication Failed');
      expect(result).toContain('Invalid credentials');
      expect(result).toContain('aifabrix login');
    });

    it('should format authentication error without message', () => {
      const errorData = {};
      const result = httpStatusErrors.formatAuthenticationError(errorData);
      expect(result).toContain('❌ Authentication Failed');
      expect(result).toContain('Your authentication token is invalid or has expired');
      expect(result).toContain('aifabrix login');
    });

    it('should include correlation ID when present', () => {
      const errorData = {
        message: 'Token expired',
        correlationId: 'corr-123'
      };
      const result = httpStatusErrors.formatAuthenticationError(errorData);
      expect(result).toContain('Correlation ID: corr-123');
    });
  });

  describe('formatServerError', () => {
    it('should format server error with detail field', () => {
      const errorData = {
        detail: 'Internal server error occurred'
      };
      const result = httpStatusErrors.formatServerError(errorData);
      expect(result).toContain('❌ Server Error');
      expect(result).toContain('Internal server error occurred');
      expect(result).toContain('Please try again later');
    });

    it('should format server error with message field', () => {
      const errorData = {
        message: 'Server error message'
      };
      const result = httpStatusErrors.formatServerError(errorData);
      expect(result).toContain('❌ Server Error');
      expect(result).toContain('Server error message');
    });

    it('should format server error without detail or message', () => {
      const errorData = {};
      const result = httpStatusErrors.formatServerError(errorData);
      expect(result).toContain('❌ Server Error');
      expect(result).toContain('An internal server error occurred');
    });

    it('should include correlation ID when present', () => {
      const errorData = {
        detail: 'Server error',
        correlationId: 'corr-456'
      };
      const result = httpStatusErrors.formatServerError(errorData);
      expect(result).toContain('Correlation ID: corr-456');
    });
  });

  describe('formatConflictError', () => {
    it('should format conflict error for application already exists', () => {
      const errorData = {
        detail: 'Application already exists in this environment'
      };
      const result = httpStatusErrors.formatConflictError(errorData);
      expect(result).toContain('❌ Conflict');
      expect(result).toContain('This application already exists');
      expect(result).toContain('Use a different environment');
      expect(result).toContain('aifabrix app list');
    });

    it('should format conflict error with detail field', () => {
      const errorData = {
        detail: 'Resource conflict occurred'
      };
      const result = httpStatusErrors.formatConflictError(errorData);
      expect(result).toContain('❌ Conflict');
      expect(result).toContain('Resource conflict occurred');
    });

    it('should format conflict error with message field', () => {
      const errorData = {
        message: 'Conflict message'
      };
      const result = httpStatusErrors.formatConflictError(errorData);
      expect(result).toContain('❌ Conflict');
      expect(result).toContain('Conflict message');
    });

    it('should format conflict error without detail or message', () => {
      const errorData = {};
      const result = httpStatusErrors.formatConflictError(errorData);
      expect(result).toContain('❌ Conflict');
      expect(result).toContain('A conflict occurred');
    });

    it('should handle case-insensitive application already exists check', () => {
      const errorData = {
        detail: 'APPLICATION ALREADY EXISTS IN THIS ENVIRONMENT'
      };
      const result = httpStatusErrors.formatConflictError(errorData);
      expect(result).toContain('This application already exists');
    });

    it('should include correlation ID when present', () => {
      const errorData = {
        detail: 'Conflict',
        correlationId: 'corr-789'
      };
      const result = httpStatusErrors.formatConflictError(errorData);
      expect(result).toContain('Correlation ID: corr-789');
    });
  });

  describe('getNotFoundGuidance (tested via formatNotFoundError)', () => {
    it('should return environment-specific guidance', () => {
      const errorData = {
        detail: 'Environment not found'
      };
      const result = httpStatusErrors.formatNotFoundError(errorData);
      expect(result).toContain('Check the environment key spelling');
      expect(result).toContain('List available environments');
      expect(result).toContain('Verify you have access');
    });

    it('should return application-specific guidance', () => {
      const errorData = {
        detail: 'Application not found'
      };
      const result = httpStatusErrors.formatNotFoundError(errorData);
      expect(result).toContain('Check the application key spelling');
      expect(result).toContain('List applications');
      expect(result).toContain('Verify the application exists');
    });

    it('should return generic guidance for other errors', () => {
      const errorData = {
        detail: 'Resource not found'
      };
      const result = httpStatusErrors.formatNotFoundError(errorData);
      expect(result).toContain('Check the resource identifier');
      expect(result).toContain('Verify the resource exists');
      expect(result).toContain('Check your permissions');
    });

    it('should handle case-insensitive detail matching', () => {
      const errorData1 = { detail: 'ENVIRONMENT NOT FOUND' };
      const errorData2 = { detail: 'environment not found' };
      const result1 = httpStatusErrors.formatNotFoundError(errorData1);
      const result2 = httpStatusErrors.formatNotFoundError(errorData2);
      expect(result1).toContain('Check the environment key spelling');
      expect(result2).toContain('Check the environment key spelling');
    });
  });

  describe('formatNotFoundError', () => {
    it('should format not found error with detail', () => {
      const errorData = {
        detail: 'Resource not found'
      };
      const result = httpStatusErrors.formatNotFoundError(errorData);
      expect(result).toContain('❌ Not Found');
      expect(result).toContain('Resource not found');
      expect(result).toContain('Options:');
    });

    it('should format not found error with message', () => {
      const errorData = {
        message: 'Not found message'
      };
      const result = httpStatusErrors.formatNotFoundError(errorData);
      expect(result).toContain('❌ Not Found');
      expect(result).toContain('Not found message');
    });

    it('should format not found error without detail or message', () => {
      const errorData = {};
      const result = httpStatusErrors.formatNotFoundError(errorData);
      expect(result).toContain('❌ Not Found');
      expect(result).toContain('Options:');
    });

    it('should include environment-specific guidance for environment errors', () => {
      const errorData = {
        detail: 'Environment not found'
      };
      const result = httpStatusErrors.formatNotFoundError(errorData);
      expect(result).toContain('Check the environment key spelling');
    });

    it('should include application-specific guidance for application errors', () => {
      const errorData = {
        detail: 'Application not found'
      };
      const result = httpStatusErrors.formatNotFoundError(errorData);
      expect(result).toContain('Check the application key spelling');
    });

    it('should include correlation ID when present', () => {
      const errorData = {
        detail: 'Not found',
        correlationId: 'corr-999'
      };
      const result = httpStatusErrors.formatNotFoundError(errorData);
      expect(result).toContain('Correlation ID: corr-999');
    });
  });

  describe('formatGenericError', () => {
    it('should format generic error with detail field', () => {
      const errorData = {
        detail: 'Generic error detail'
      };
      const result = httpStatusErrors.formatGenericError(errorData, 403);
      expect(result).toContain('❌ Error (HTTP 403)');
      expect(result).toContain('Generic error detail');
    });

    it('should format generic error with message field', () => {
      const errorData = {
        message: 'Generic error message'
      };
      const result = httpStatusErrors.formatGenericError(errorData, 403);
      expect(result).toContain('❌ Error (HTTP 403)');
      expect(result).toContain('Generic error message');
    });

    it('should format generic error with error field', () => {
      const errorData = {
        error: 'Generic error'
      };
      const result = httpStatusErrors.formatGenericError(errorData, 403);
      expect(result).toContain('❌ Error (HTTP 403)');
      expect(result).toContain('Generic error');
    });

    it('should format generic error without detail, message, or error', () => {
      const errorData = {};
      const result = httpStatusErrors.formatGenericError(errorData, 403);
      expect(result).toContain('❌ Error (HTTP 403)');
      expect(result).toContain('An error occurred while processing your request');
    });

    it('should include correlation ID when present', () => {
      const errorData = {
        detail: 'Error',
        correlationId: 'corr-111'
      };
      const result = httpStatusErrors.formatGenericError(errorData, 403);
      expect(result).toContain('Correlation ID: corr-111');
    });

    it('should handle different status codes', () => {
      const errorData = { detail: 'Error' };
      const result400 = httpStatusErrors.formatGenericError(errorData, 400);
      const result500 = httpStatusErrors.formatGenericError(errorData, 500);
      expect(result400).toContain('HTTP 400');
      expect(result500).toContain('HTTP 500');
    });
  });
});

