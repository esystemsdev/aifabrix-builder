/**
 * Tests for lib/utils/deployment-errors.js
 *
 * @fileoverview Unit tests for deployment error handling
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/audit-logger', () => ({
  logDeploymentFailure: jest.fn().mockResolvedValue(),
  maskSensitiveData: jest.fn((msg) => msg)
}));

jest.mock('../../../lib/utils/api-error-handler', () => ({
  parseErrorResponse: jest.fn()
}));

const { handleDeploymentError, handleDeploymentErrors } = require('../../../lib/utils/deployment-errors');
const auditLogger = require('../../../lib/audit-logger');
const { parseErrorResponse } = require('../../../lib/utils/api-error-handler');

describe('deployment-errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditLogger.maskSensitiveData.mockImplementation((msg) => msg);
  });

  describe('handleDeploymentError', () => {
    it('should handle null error', () => {
      const result = handleDeploymentError(null);
      expect(result).toEqual({
        message: 'Unknown error',
        code: 'UNKNOWN',
        timeout: false,
        status: undefined,
        data: undefined
      });
    });

    it('should handle undefined error', () => {
      const result = handleDeploymentError(undefined);
      expect(result).toEqual({
        message: 'Unknown error',
        code: 'UNKNOWN',
        timeout: false,
        status: undefined,
        data: undefined
      });
    });

    it('should handle Error object', () => {
      const error = new Error('Test error');
      error.code = 'TEST_CODE';
      const result = handleDeploymentError(error);
      expect(result.message).toBe('Test error');
      expect(result.code).toBe('TEST_CODE');
      expect(result.timeout).toBe(false);
    });

    it('should handle timeout error', () => {
      const error = new Error('Timeout');
      error.code = 'ECONNABORTED';
      const result = handleDeploymentError(error);
      expect(result.timeout).toBe(true);
    });

    it('should extract status from error.status', () => {
      const error = { message: 'Error', status: 404 };
      const result = handleDeploymentError(error);
      expect(result.status).toBe(404);
    });

    it('should extract status from error.response.status', () => {
      const error = {
        message: 'Error',
        response: { status: 500 }
      };
      const result = handleDeploymentError(error);
      expect(result.status).toBe(500);
    });

    it('should extract data from error.data', () => {
      const error = { message: 'Error', data: { detail: 'Details' } };
      const result = handleDeploymentError(error);
      expect(result.data).toEqual({ detail: 'Details' });
    });

    it('should extract data from error.response.data', () => {
      const error = {
        message: 'Error',
        response: { data: { detail: 'Details' } }
      };
      const result = handleDeploymentError(error);
      expect(result.data).toEqual({ detail: 'Details' });
    });

    it('should mask sensitive data in error message', () => {
      auditLogger.maskSensitiveData.mockReturnValue('Masked message');
      const error = new Error('Sensitive data');
      const result = handleDeploymentError(error);
      expect(auditLogger.maskSensitiveData).toHaveBeenCalledWith('Sensitive data');
      expect(result.message).toBe('Masked message');
    });
  });

  describe('handleDeploymentErrors', () => {
    it('should re-throw validation errors as Error objects', async() => {
      const error = new Error('Controller URL must use HTTPS');
      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Controller URL must use HTTPS');
      expect(auditLogger.logDeploymentFailure).not.toHaveBeenCalled();
    });

    it('should re-throw validation errors as strings', async() => {
      const error = 'Invalid environment key';
      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Invalid environment key');
      expect(auditLogger.logDeploymentFailure).not.toHaveBeenCalled();
    });

    it('should re-throw validation errors as objects with message', async() => {
      const error = { message: 'Environment key is required' };
      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Environment key is required');
      expect(auditLogger.logDeploymentFailure).not.toHaveBeenCalled();
    });

    it('should handle string errors', async() => {
      const error = 'Network error occurred';
      parseErrorResponse.mockReturnValue({
        message: 'Network error occurred',
        formatted: 'Network error occurred',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Network error occurred');
      expect(auditLogger.logDeploymentFailure).toHaveBeenCalledWith('app1', 'https://example.com', error);
    });

    it('should handle Error objects', async() => {
      const error = new Error('Deployment failed');
      parseErrorResponse.mockReturnValue({
        message: 'Deployment failed',
        formatted: 'Deployment failed',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Deployment failed');
      expect(auditLogger.logDeploymentFailure).toHaveBeenCalledWith('app1', 'https://example.com', error);
    });

    it('should handle objects with message property', async() => {
      const error = { message: 'Custom error' };
      parseErrorResponse.mockReturnValue({
        message: 'Custom error',
        formatted: 'Custom error',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Custom error');
    });

    it('should skip audit logging when alreadyLogged is true', async() => {
      const error = new Error('Deployment failed');
      parseErrorResponse.mockReturnValue({
        message: 'Deployment failed',
        formatted: 'Deployment failed',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com', true)).rejects.toThrow('Deployment failed');
      expect(auditLogger.logDeploymentFailure).not.toHaveBeenCalled();
    });

    it('should handle audit logging errors gracefully', async() => {
      const error = new Error('Deployment failed');
      auditLogger.logDeploymentFailure.mockRejectedValue(new Error('Audit log failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      parseErrorResponse.mockReturnValue({
        message: 'Deployment failed',
        formatted: 'Deployment failed',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Deployment failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[AUDIT LOG ERROR] Failed to log deployment failure: Audit log failed');
      consoleErrorSpy.mockRestore();
    });

    it('should extract error data from error.response.data', async() => {
      const error = {
        message: 'API Error',
        response: {
          status: 400,
          data: { detail: 'Validation failed' }
        }
      };
      parseErrorResponse.mockReturnValue({
        message: 'Validation failed',
        formatted: 'Validation failed',
        data: { detail: 'Validation failed' }
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Validation failed');
      expect(parseErrorResponse).toHaveBeenCalledWith({ detail: 'Validation failed' }, 400, false);
    });

    it('should handle errorData as undefined', async() => {
      const error = new Error('Error without data');
      parseErrorResponse.mockReturnValue({
        message: 'Error without data',
        formatted: 'Error without data',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Error without data');
      // safeError.status is undefined, but parseErrorResponse receives 0 (from safeError.status || 0)
      expect(parseErrorResponse).toHaveBeenCalledWith('Error without data', 0, false);
    });

    it('should handle errorResponse as Error object', async() => {
      const error = {
        message: 'Error',
        data: new Error('Nested error')
      };
      parseErrorResponse.mockReturnValue({
        message: 'Nested error',
        formatted: 'Nested error',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Nested error');
    });

    it('should handle errorResponse as null', async() => {
      const error = {
        message: 'Error',
        data: null
      };
      parseErrorResponse.mockReturnValue({
        message: 'Error',
        formatted: 'Error',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Error');
    });

    it('should detect network errors', async() => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      parseErrorResponse.mockReturnValue({
        message: 'Connection refused',
        formatted: 'Connection refused',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Connection refused');
      // safeError.status is undefined, but parseErrorResponse receives 0 (from safeError.status || 0)
      expect(parseErrorResponse).toHaveBeenCalledWith(expect.anything(), 0, true);
    });

    it('should detect ENOTFOUND network errors', async() => {
      const error = new Error('Host not found');
      error.code = 'ENOTFOUND';
      parseErrorResponse.mockReturnValue({
        message: 'Host not found',
        formatted: 'Host not found',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Host not found');
      // safeError.status is undefined, but parseErrorResponse receives 0 (from safeError.status || 0)
      expect(parseErrorResponse).toHaveBeenCalledWith(expect.anything(), 0, true);
    });

    it('should detect timeout errors', async() => {
      const error = new Error('Timeout');
      error.code = 'ECONNABORTED';
      parseErrorResponse.mockReturnValue({
        message: 'Timeout',
        formatted: 'Timeout',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Timeout');
      // safeError.status is undefined, but parseErrorResponse receives 0 (from safeError.status || 0)
      expect(parseErrorResponse).toHaveBeenCalledWith(expect.anything(), 0, true);
    });

    it('should handle parseErrorResponse returning invalid result', async() => {
      const error = new Error('Deployment failed');
      parseErrorResponse.mockReturnValue(null);

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Deployment failed');
    });

    it('should handle parseErrorResponse throwing error', async() => {
      const error = new Error('Deployment failed');
      parseErrorResponse.mockImplementation(() => {
        throw new Error('Parse failed');
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Deployment failed');
    });

    it('should handle parseErrorResponse returning non-object', async() => {
      const error = new Error('Deployment failed');
      parseErrorResponse.mockReturnValue('string instead of object');

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Deployment failed');
    });

    it('should handle parsedError.message being undefined', async() => {
      const error = new Error('Deployment failed');
      parseErrorResponse.mockReturnValue({
        formatted: 'Formatted error',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Deployment failed');
    });

    it('should throw error for invalid error message type', async() => {
      const error = new Error('Deployment failed');
      parseErrorResponse.mockReturnValue({
        message: 123, // Invalid type
        formatted: 'Formatted error',
        data: undefined
      });

      await expect(handleDeploymentErrors(error, 'app1', 'https://example.com')).rejects.toThrow('Invalid error message type: number');
    });

    it('should attach formatted error properties', async() => {
      const error = new Error('Deployment failed');
      parseErrorResponse.mockReturnValue({
        message: 'Deployment failed',
        formatted: 'Formatted: Deployment failed',
        data: { detail: 'Details' }
      });

      try {
        await handleDeploymentErrors(error, 'app1', 'https://example.com');
      } catch (thrownError) {
        expect(thrownError.formatted).toBe('Formatted: Deployment failed');
        expect(thrownError.status).toBeUndefined();
        expect(thrownError.data).toEqual({ detail: 'Details' });
        expect(thrownError._logged).toBe(true);
      }
    });

    it('should attach status from safeError', async() => {
      const error = {
        message: 'Error',
        status: 404
      };
      parseErrorResponse.mockReturnValue({
        message: 'Error',
        formatted: 'Error',
        data: undefined
      });

      try {
        await handleDeploymentErrors(error, 'app1', 'https://example.com');
      } catch (thrownError) {
        expect(thrownError.status).toBe(404);
      }
    });
  });
});

