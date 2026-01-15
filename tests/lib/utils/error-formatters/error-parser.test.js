/**
 * Tests for Error Parser Module
 *
 * @fileoverview Unit tests for lib/utils/error-formatters/error-parser.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

// Mock other error formatters before requiring the module under test
const permissionErrors = require('../../../../lib/utils/error-formatters/permission-errors');
const validationErrors = require('../../../../lib/utils/error-formatters/validation-errors');
const httpStatusErrors = require('../../../../lib/utils/error-formatters/http-status-errors');
const networkErrors = require('../../../../lib/utils/error-formatters/network-errors');

// Set up spies with mock implementations before requiring error-parser
const permissionSpy = jest.spyOn(permissionErrors, 'formatPermissionError').mockImplementation((data) => `Permission error: ${JSON.stringify(data)}`);
const validationSpy = jest.spyOn(validationErrors, 'formatValidationError').mockImplementation((data) => `Validation error: ${JSON.stringify(data)}`);
const authSpy = jest.spyOn(httpStatusErrors, 'formatAuthenticationError').mockImplementation((data) => `Authentication error: ${JSON.stringify(data)}`);
const serverSpy = jest.spyOn(httpStatusErrors, 'formatServerError').mockImplementation((data) => `Server error: ${JSON.stringify(data)}`);
const conflictSpy = jest.spyOn(httpStatusErrors, 'formatConflictError').mockImplementation((data) => `Conflict error: ${JSON.stringify(data)}`);
const notFoundSpy = jest.spyOn(httpStatusErrors, 'formatNotFoundError').mockImplementation((data) => `Not found error: ${JSON.stringify(data)}`);
const genericSpy = jest.spyOn(httpStatusErrors, 'formatGenericError').mockImplementation((data, status) => `Generic error: ${JSON.stringify(data)} (${status})`);
const networkSpy = jest.spyOn(networkErrors, 'formatNetworkError').mockImplementation((msg, data) => `Network error: ${msg} ${JSON.stringify(data)}`);

const { parseErrorResponse } = require('../../../../lib/utils/error-formatters/error-parser');

describe('Error Parser Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply mock implementations after clearAllMocks
    permissionSpy.mockImplementation((data) => `Permission error: ${JSON.stringify(data)}`);
    validationSpy.mockImplementation((data) => `Validation error: ${JSON.stringify(data)}`);
    authSpy.mockImplementation((data) => `Authentication error: ${JSON.stringify(data)}`);
    serverSpy.mockImplementation((data) => `Server error: ${JSON.stringify(data)}`);
    conflictSpy.mockImplementation((data) => `Conflict error: ${JSON.stringify(data)}`);
    notFoundSpy.mockImplementation((data) => `Not found error: ${JSON.stringify(data)}`);
    genericSpy.mockImplementation((data, status) => `Generic error: ${JSON.stringify(data)} (${status})`);
    networkSpy.mockImplementation((msg, data) => `Network error: ${msg} ${JSON.stringify(data)}`);
  });

  describe('parseErrorResponse', () => {
    it('should parse null error response', () => {
      const result = parseErrorResponse(null, 500, false);

      expect(result.type).toBe('generic');
      expect(result.message).toBe('Unknown error');
    });

    it('should parse undefined error response', () => {
      const result = parseErrorResponse(undefined, 500, false);

      expect(result.type).toBe('generic');
      expect(result.message).toBe('Unknown error');
    });

    it('should parse string error response', () => {
      const result = parseErrorResponse('Simple error message', 500, false);

      // Status code takes precedence - 500 should be 'server' type
      expect(result.type).toBe('server');
      expect(result.message).toBe('Simple error message');
    });

    it('should parse JSON string error response', () => {
      const errorJson = JSON.stringify({ message: 'JSON error', detail: 'Details' });
      const result = parseErrorResponse(errorJson, 400, false);

      expect(result.type).toBe('validation');
      expect(validationSpy).toHaveBeenCalled();
    });

    it('should parse object error response', () => {
      const errorData = { message: 'Object error', detail: 'Details' };
      const result = parseErrorResponse(errorData, 400, false);

      expect(result.type).toBe('validation');
      expect(result.data).toEqual(errorData);
    });

    it('should handle network errors', () => {
      const errorMessage = 'ECONNREFUSED';
      const errorData = { controllerUrl: 'http://localhost:3000' };
      const result = parseErrorResponse(errorMessage, 0, true);

      expect(result.type).toBe('network');
      expect(networkSpy).toHaveBeenCalled();
    });

    it('should handle 400 validation error', () => {
      const errorData = { message: 'Validation failed', errors: [] };
      const result = parseErrorResponse(errorData, 400, false);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Validation failed');
      expect(validationSpy).toHaveBeenCalledWith(errorData);
    });

    it('should handle 422 validation error', () => {
      const errorData = { message: 'Unprocessable entity', errors: [] };
      const result = parseErrorResponse(errorData, 422, false);

      expect(result.type).toBe('validation');
      expect(validationSpy).toHaveBeenCalledWith(errorData);
    });

    it('should handle 401 authentication error', () => {
      const errorData = { message: 'Unauthorized', controllerUrl: 'http://localhost:3000' };
      const result = parseErrorResponse(errorData, 401, false);

      expect(result.type).toBe('authentication');
      expect(result.message).toBe('Authentication failed');
      expect(authSpy).toHaveBeenCalledWith(errorData);
    });

    it('should handle 403 permission error', () => {
      const errorData = { message: 'Forbidden', missingPermissions: ['read:app'] };
      const result = parseErrorResponse(errorData, 403, false);

      expect(result.type).toBe('permission');
      expect(result.message).toBe('Permission denied');
      expect(permissionSpy).toHaveBeenCalledWith(errorData);
    });

    it('should handle 404 not found error', () => {
      const errorData = { message: 'Not found' };
      const result = parseErrorResponse(errorData, 404, false);

      expect(result.type).toBe('notfound');
      expect(result.message).toBe('Not found');
      expect(notFoundSpy).toHaveBeenCalledWith(errorData);
    });

    it('should handle 409 conflict error', () => {
      const errorData = { message: 'Conflict' };
      const result = parseErrorResponse(errorData, 409, false);

      expect(result.type).toBe('conflict');
      expect(result.message).toBe('Conflict');
      expect(conflictSpy).toHaveBeenCalledWith(errorData);
    });

    it('should handle 500 server error', () => {
      const errorData = { message: 'Internal server error' };
      const result = parseErrorResponse(errorData, 500, false);

      expect(result.type).toBe('server');
      expect(result.message).toBe('Server error');
      expect(serverSpy).toHaveBeenCalledWith(errorData);
    });

    it('should handle 503 server error', () => {
      const errorData = { message: 'Service unavailable' };
      const result = parseErrorResponse(errorData, 503, false);

      expect(result.type).toBe('server');
      expect(serverSpy).toHaveBeenCalledWith(errorData);
    });

    it('should handle nested error data structure', () => {
      const errorResponse = {
        data: {
          message: 'Nested error',
          errors: []
        }
      };
      const result = parseErrorResponse(errorResponse, 400, false);

      expect(result.type).toBe('validation');
      expect(validationSpy).toHaveBeenCalledWith(errorResponse.data);
    });

    it('should handle generic 4xx errors', () => {
      const errorData = { message: 'Client error' };
      const result = parseErrorResponse(errorData, 418, false);

      expect(result.type).toBe('generic');
      expect(genericSpy).toHaveBeenCalledWith(errorData, 418);
    });

    it('should handle error with detail field', () => {
      const errorData = { detail: 'Error detail', message: 'Error message' };
      const result = parseErrorResponse(errorData, 400, false);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Error detail');
    });

    it('should handle error with title field', () => {
      const errorData = { title: 'Error title' };
      const result = parseErrorResponse(errorData, 400, false);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Error title');
    });

    it('should handle error with errorDescription field', () => {
      const errorData = { errorDescription: 'Error description' };
      const result = parseErrorResponse(errorData, 400, false);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Error description');
    });

    it('should handle error with error field', () => {
      const errorData = { error: 'Error text' };
      const result = parseErrorResponse(errorData, 400, false);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Error text');
    });

    it('should use default message when no message fields present', () => {
      const errorData = {};
      const result = parseErrorResponse(errorData, 400, false);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Validation error');
    });

    it('should handle non-string, non-object error response', () => {
      const result = parseErrorResponse(123, 500, false);

      expect(result.type).toBe('generic');
      expect(result.message).toBe('123');
    });

    it('should handle invalid JSON string gracefully', () => {
      const invalidJson = 'not valid json{';
      const result = parseErrorResponse(invalidJson, 500, false);

      // Status code takes precedence - 500 should be 'server' type
      expect(result.type).toBe('server');
      expect(result.message).toBe(invalidJson);
    });
  });
});

