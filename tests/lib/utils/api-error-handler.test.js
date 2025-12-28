/**
 * Tests for API Error Handler Module
 *
 * @fileoverview Comprehensive tests for api-error-handler.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk before requiring modules that use it
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  mockChalk.bold = jest.fn((text) => text);
  return mockChalk;
});

const {
  parseErrorResponse,
  formatApiError,
  formatPermissionError,
  formatValidationError,
  formatAuthenticationError,
  formatNetworkError,
  formatServerError,
  formatGenericError
} = require('../../../lib/utils/api-error-handler');

describe('API Error Handler', () => {
  describe('parseErrorResponse', () => {
    it('should parse permission error (403)', () => {
      const errorData = {
        url: '/api/v1/environments/miso/applications/register',
        method: 'POST',
        userId: 'admin',
        correlationId: 'corr_123',
        userPermissions: [],
        missingPermissions: ['environments_applications:create'],
        requiredPermissions: ['environments_applications:create']
      };

      const result = parseErrorResponse(errorData, 403, false);

      expect(result.type).toBe('permission');
      expect(result.message).toBe('Permission denied');
      expect(result.data).toEqual(errorData);
      expect(result.formatted).toContain('Permission Denied');
      expect(result.formatted).toContain('environments_applications:create');
    });

    it('should parse permission error with nested structure (RFC 7807)', () => {
      const errorData = {
        type: '/Errors/Forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Access denied. Missing required permission: environments_applications:create.',
        instance: '/api/v1/environments/miso/applications/register',
        required: {
          permissions: ['environments_applications:create'],
          requireAll: false
        },
        missing: {
          permissions: ['environments_applications:create']
        },
        userPermissions: []
      };

      const result = parseErrorResponse(errorData, 403, false);

      expect(result.type).toBe('permission');
      expect(result.message).toBe('Permission denied');
      expect(result.data).toEqual(errorData);
      expect(result.formatted).toContain('Permission Denied');
      expect(result.formatted).toContain('Access denied');
      expect(result.formatted).toContain('environments_applications:create');
      expect(result.formatted).toContain('/api/v1/environments/miso/applications/register');
    });

    it('should parse authentication error (401)', () => {
      const errorData = {
        message: 'Invalid token',
        correlationId: 'corr_123'
      };

      const result = parseErrorResponse(errorData, 401, false);

      expect(result.type).toBe('authentication');
      expect(result.message).toBe('Authentication failed');
      expect(result.data).toEqual(errorData);
      expect(result.formatted).toContain('Authentication Failed');
    });

    it('should parse validation error (400)', () => {
      const errorData = {
        message: 'Validation failed',
        errors: [
          { field: 'name', message: 'Name is required' },
          { field: 'email', message: 'Invalid email format' }
        ],
        correlationId: 'corr_123'
      };

      const result = parseErrorResponse(errorData, 400, false);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Validation failed');
      expect(result.data).toEqual(errorData);
      expect(result.formatted).toContain('Validation Error');
    });

    it('should parse unified error API response (RFC 7807)', () => {
      const errorData = {
        type: '/Errors/BadRequest',
        title: 'Bad Request',
        status: 400,
        detail: 'Pipeline validation failed',
        instance: '/api/v1/pipeline/miso/validate',
        errors: [
          {
            field: 'validation',
            message: 'INVALID_APPLICATION_SCHEMA'
          },
          {
            field: 'validation',
            message: 'Failed to validate default: Cannot read properties of undefined (reading \'presets\')'
          }
        ]
      };

      const result = parseErrorResponse(errorData, 400, false);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Pipeline validation failed');
      expect(result.data).toEqual(errorData);
      expect(result.formatted).toContain('Validation Error');
      expect(result.formatted).toContain('Pipeline validation failed');
      expect(result.formatted).toContain('INVALID_APPLICATION_SCHEMA');
      expect(result.formatted).toContain('/api/v1/pipeline/miso/validate');
    });

    it('should parse server error (500)', () => {
      const errorData = {
        message: 'Internal server error',
        correlationId: 'corr_123'
      };

      const result = parseErrorResponse(errorData, 500, false);

      expect(result.type).toBe('server');
      expect(result.message).toBe('Server error');
      expect(result.data).toEqual(errorData);
      expect(result.formatted).toContain('Server Error');
    });

    it('should parse network error', () => {
      const errorMessage = 'ECONNREFUSED';

      const result = parseErrorResponse(errorMessage, 0, true);

      expect(result.type).toBe('network');
      expect(result.message).toBe(errorMessage);
      expect(result.formatted).toContain('Network Error');
    });

    it('should parse not found error (404)', () => {
      const errorData = {
        message: 'Not found',
        detail: 'Environment with key \'mis\' not found',
        correlationId: 'corr_123'
      };

      const result = parseErrorResponse(errorData, 404, false);

      expect(result.type).toBe('notfound');
      expect(result.message).toBe('Environment with key \'mis\' not found');
      expect(result.data).toEqual(errorData);
      expect(result.formatted).toContain('❌ Not Found');
      expect(result.formatted).toContain('Environment with key \'mis\' not found');
    });

    it('should parse string error response', () => {
      const errorText = '{"message": "Error occurred", "correlationId": "corr_123"}';

      const result = parseErrorResponse(errorText, 400, false);

      expect(result.type).toBe('validation');
      expect(result.data.message).toBe('Error occurred');
    });

    it('should handle non-JSON string error', () => {
      const errorText = 'Plain text error';

      const result = parseErrorResponse(errorText, 500, false);

      expect(result.type).toBe('server');
      expect(result.data.message).toBe('Plain text error');
    });
  });

  describe('formatPermissionError', () => {
    it('should format permission error with missing permissions', () => {
      const errorData = {
        url: '/api/v1/test',
        method: 'POST',
        missingPermissions: ['perm1', 'perm2'],
        requiredPermissions: ['perm1', 'perm2'],
        correlationId: 'corr_123'
      };

      const formatted = formatPermissionError(errorData);

      expect(formatted).toContain('Permission Denied');
      expect(formatted).toContain('perm1');
      expect(formatted).toContain('perm2');
      expect(formatted).toContain('POST /api/v1/test');
      expect(formatted).toContain('corr_123');
    });

    it('should format permission error with nested structure (RFC 7807)', () => {
      const errorData = {
        type: '/Errors/Forbidden',
        title: 'Forbidden',
        detail: 'Access denied. Missing required permission.',
        instance: '/api/v1/environments/miso/applications/register',
        required: {
          permissions: ['environments_applications:create']
        },
        missing: {
          permissions: ['environments_applications:create']
        }
      };

      const formatted = formatPermissionError(errorData);

      expect(formatted).toContain('Permission Denied');
      expect(formatted).toContain('Access denied');
      expect(formatted).toContain('environments_applications:create');
      expect(formatted).toContain('/api/v1/environments/miso/applications/register');
    });

    it('should format permission error without optional fields', () => {
      const errorData = {
        missingPermissions: ['perm1']
      };

      const formatted = formatPermissionError(errorData);

      expect(formatted).toContain('Permission Denied');
      expect(formatted).toContain('perm1');
    });
  });

  describe('formatValidationError', () => {
    it('should format validation error with field errors', () => {
      const errorData = {
        message: 'Validation failed',
        errors: [
          { field: 'name', message: 'Required' },
          { path: 'email', message: 'Invalid format' }
        ],
        correlationId: 'corr_123'
      };

      const formatted = formatValidationError(errorData);

      expect(formatted).toContain('Validation Error');
      expect(formatted).toContain('Validation failed');
      expect(formatted).toContain('name');
      expect(formatted).toContain('email');
    });

    it('should format validation error without errors array', () => {
      const errorData = {
        message: 'Invalid input',
        correlationId: 'corr_123'
      };

      const formatted = formatValidationError(errorData);

      expect(formatted).toContain('Validation Error');
      expect(formatted).toContain('Invalid input');
    });

    it('should format unified error API response (RFC 7807 Problem Details)', () => {
      const errorData = {
        type: '/Errors/BadRequest',
        title: 'Bad Request',
        status: 400,
        detail: 'Pipeline validation failed',
        instance: '/api/v1/pipeline/miso/validate',
        errors: [
          {
            field: 'validation',
            message: 'INVALID_APPLICATION_SCHEMA'
          },
          {
            field: 'validation',
            message: 'Failed to validate default: Cannot read properties of undefined (reading \'presets\')'
          }
        ]
      };

      const formatted = formatValidationError(errorData);

      expect(formatted).toContain('Validation Error');
      expect(formatted).toContain('Pipeline validation failed');
      expect(formatted).toContain('Validation errors:');
      expect(formatted).toContain('INVALID_APPLICATION_SCHEMA');
      expect(formatted).toContain('Cannot read properties of undefined');
      expect(formatted).toContain('/api/v1/pipeline/miso/validate');
    });

    it('should format unified error API response with title when detail is missing', () => {
      const errorData = {
        type: '/Errors/BadRequest',
        title: 'Bad Request',
        status: 400,
        instance: '/api/v1/pipeline/miso/validate',
        errors: [
          {
            field: 'validation',
            message: 'INVALID_APPLICATION_SCHEMA'
          }
        ]
      };

      const formatted = formatValidationError(errorData);

      expect(formatted).toContain('Validation Error');
      expect(formatted).toContain('Bad Request');
      expect(formatted).toContain('INVALID_APPLICATION_SCHEMA');
    });
  });

  describe('formatAuthenticationError', () => {
    it('should format authentication error with message', () => {
      const errorData = {
        message: 'Token expired',
        correlationId: 'corr_123'
      };

      const formatted = formatAuthenticationError(errorData);

      expect(formatted).toContain('Authentication Failed');
      expect(formatted).toContain('Token expired');
      expect(formatted).toContain('aifabrix login');
    });

    it('should format authentication error without message', () => {
      const errorData = {
        correlationId: 'corr_123'
      };

      const formatted = formatAuthenticationError(errorData);

      expect(formatted).toContain('Authentication Failed');
      expect(formatted).toContain('Your authentication token is invalid or has expired');
    });
  });

  describe('formatNetworkError', () => {
    it('should format ECONNREFUSED error', () => {
      const formatted = formatNetworkError('ECONNREFUSED', {});

      expect(formatted).toContain('Network Error');
      expect(formatted).toContain('Cannot connect to controller');
    });

    it('should format ENOTFOUND error', () => {
      const formatted = formatNetworkError('ENOTFOUND', {});

      expect(formatted).toContain('Network Error');
      expect(formatted).toContain('Controller hostname not found');
    });

    it('should format timeout error', () => {
      const formatted = formatNetworkError('timeout', {});

      expect(formatted).toContain('Network Error');
      expect(formatted).toContain('Request timed out');
    });

    it('should format generic network error', () => {
      const formatted = formatNetworkError('Network error occurred', {});

      expect(formatted).toContain('Network Error');
      expect(formatted).toContain('Network error occurred');
    });

    it('should include correlation ID if provided', () => {
      const errorData = {
        correlationId: 'corr_123'
      };

      const formatted = formatNetworkError('Error', errorData);

      expect(formatted).toContain('corr_123');
    });
  });

  describe('formatServerError', () => {
    it('should format server error with detail field (RFC 7807)', () => {
      const errorData = {
        detail: 'Database connection failed',
        correlationId: 'corr_123'
      };

      const formatted = formatServerError(errorData);

      expect(formatted).toContain('Server Error');
      expect(formatted).toContain('Database connection failed');
      expect(formatted).toContain('corr_123');
    });

    it('should format server error with message', () => {
      const errorData = {
        message: 'Internal server error',
        correlationId: 'corr_123'
      };

      const formatted = formatServerError(errorData);

      expect(formatted).toContain('Server Error');
      expect(formatted).toContain('Internal server error');
      expect(formatted).toContain('corr_123');
    });

    it('should format server error without message', () => {
      const errorData = {};

      const formatted = formatServerError(errorData);

      expect(formatted).toContain('Server Error');
      expect(formatted).toContain('internal server error');
    });
  });

  describe('formatGenericError', () => {
    it('should format generic error with message', () => {
      const errorData = {
        message: 'Something went wrong',
        correlationId: 'corr_123'
      };

      const formatted = formatGenericError(errorData, 404);

      expect(formatted).toContain('Error (HTTP 404)');
      expect(formatted).toContain('Something went wrong');
      expect(formatted).toContain('corr_123');
    });

    it('should format generic error with error field', () => {
      const errorData = {
        error: 'Error occurred',
        correlationId: 'corr_123'
      };

      const formatted = formatGenericError(errorData, 500);

      expect(formatted).toContain('Error (HTTP 500)');
      expect(formatted).toContain('Error occurred');
    });

    it('should format generic error without message', () => {
      const errorData = {};

      const formatted = formatGenericError(errorData, 400);

      expect(formatted).toContain('Error (HTTP 400)');
      expect(formatted).toContain('An error occurred');
    });
  });

  describe('formatApiError', () => {
    it('should format API error response with formattedError', () => {
      const apiResponse = {
        success: false,
        formattedError: 'Formatted error message',
        error: 'Error message',
        status: 403
      };

      const formatted = formatApiError(apiResponse);

      expect(formatted).toBe('Formatted error message');
    });

    it('should format API error response without formattedError', () => {
      const apiResponse = {
        success: false,
        error: { message: 'Error occurred' },
        status: 400
      };

      const formatted = formatApiError(apiResponse);

      expect(formatted).toContain('Validation Error');
    });

    it('should handle network error response', () => {
      const apiResponse = {
        success: false,
        error: 'ECONNREFUSED',
        network: true
      };

      const formatted = formatApiError(apiResponse);

      expect(formatted).toContain('Network Error');
    });

    it('should handle invalid response', () => {
      const formatted = formatApiError(null);

      expect(formatted).toContain('Unknown error occurred');
    });

    it('should handle successful response', () => {
      const apiResponse = {
        success: true,
        data: {}
      };

      const formatted = formatApiError(apiResponse);

      expect(formatted).toContain('Unknown error occurred');
    });
  });
});

