/**
 * Tests for API Utilities Module
 *
 * @fileoverview Unit tests for lib/utils/api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock dependencies
jest.mock('../../../lib/utils/api-error-handler', () => ({
  parseErrorResponse: jest.fn()
}));

jest.mock('../../../lib/core/audit-logger', () => ({
  logApiCall: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../../lib/utils/device-code', () => ({
  initiateDeviceCodeFlow: jest.fn(),
  pollDeviceCodeToken: jest.fn(),
  displayDeviceCodeInfo: jest.fn(),
  refreshDeviceToken: jest.fn()
}));

jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn(),
  forceRefreshDeviceToken: jest.fn()
}));

// Mock global fetch
global.fetch = jest.fn();

const { parseErrorResponse } = require('../../../lib/utils/api-error-handler');
const auditLogger = require('../../../lib/core/audit-logger');
const { getOrRefreshDeviceToken, forceRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const {
  makeApiCall,
  authenticatedApiCall,
  initiateDeviceCodeFlow,
  pollDeviceCodeToken,
  displayDeviceCodeInfo,
  refreshDeviceToken
} = require('../../../lib/utils/api');

describe('API Utilities Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('makeApiCall', () => {
    it('should make successful API call with JSON response', async() => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue({ data: 'test' }),
        text: jest.fn()
      };

      global.fetch.mockResolvedValue(mockResponse);
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const result = await makeApiCall('https://api.example.com/test');

      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'test' });
      expect(result.status).toBe(200);
      expect(auditLogger.logApiCall).toHaveBeenCalledWith({
        url: 'https://api.example.com/test',
        options: {},
        statusCode: 200,
        duration: 1000,
        success: true
      });
    });

    it('should make successful API call with text response', async() => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('text/plain')
        },
        json: jest.fn(),
        text: jest.fn().mockResolvedValue('text response')
      };

      global.fetch.mockResolvedValue(mockResponse);
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(true);
      expect(result.data).toBe('text response');
      expect(result.status).toBe(200);
    });

    it('should handle error response', async() => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue('{"error": "Invalid request"}')
      };

      global.fetch.mockResolvedValue(mockResponse);
      parseErrorResponse.mockReturnValue({
        type: 'validation',
        message: 'Invalid request',
        data: { error: 'Invalid request' },
        formatted: 'Invalid request'
      });
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid request');
      expect(result.status).toBe(400);
      expect(auditLogger.logApiCall).toHaveBeenCalledWith({
        url: 'https://api.example.com/test',
        options: {},
        statusCode: 400,
        duration: 1000,
        success: false,
        errorInfo: {
          errorType: 'validation',
          errorMessage: 'Invalid request',
          errorData: { error: 'Invalid request' },
          correlationId: undefined
        }
      });
    });

    it('should handle network error', async() => {
      const networkError = new Error('Network error');
      global.fetch.mockRejectedValue(networkError);
      parseErrorResponse.mockReturnValue({
        type: 'network',
        message: 'Network error',
        data: {},
        formatted: 'Network error'
      });
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.network).toBe(true);
      expect(auditLogger.logApiCall).toHaveBeenCalledWith({
        url: 'https://api.example.com/test',
        options: {},
        statusCode: 0,
        duration: 1000,
        success: false,
        errorInfo: {
          errorType: 'network',
          errorMessage: 'Network error',
          network: true
        }
      });
    });

    it('should pass options to fetch', async() => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue({}),
        text: jest.fn()
      };

      global.fetch.mockResolvedValue(mockResponse);
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      };

      await makeApiCall('https://api.example.com/test', options);

      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', options);
    });
  });

  describe('authenticatedApiCall', () => {
    it('should make authenticated API call with bearer token', async() => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue({ data: 'test' }),
        text: jest.fn()
      };

      global.fetch.mockResolvedValue(mockResponse);
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const result = await authenticatedApiCall('https://api.example.com/test', {}, 'token123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result.success).toBe(true);
    });

    it('should handle 401 error with token refresh', async() => {
      const mock401Response = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('{"error": "Unauthorized"}')
      };

      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue({ data: 'success' }),
        text: jest.fn()
      };

      global.fetch
        .mockResolvedValueOnce(mock401Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      parseErrorResponse.mockReturnValue({
        type: 'authentication',
        message: 'Unauthorized',
        data: {},
        formatted: 'Unauthorized'
      });

      forceRefreshDeviceToken.mockResolvedValue({ token: 'refreshed-token' });
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000).mockReturnValueOnce(3000).mockReturnValueOnce(4000);

      const result = await authenticatedApiCall('https://api.example.com/test', {}, 'token123');

      expect(forceRefreshDeviceToken).toHaveBeenCalledWith('https://api.example.com');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'success' });
    });

    it('should return error when token refresh fails', async() => {
      const mock401Response = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('{"error": "Unauthorized"}')
      };

      global.fetch.mockResolvedValue(mock401Response);
      parseErrorResponse.mockReturnValue({
        type: 'authentication',
        message: 'Unauthorized',
        data: {},
        formatted: 'Unauthorized'
      });

      forceRefreshDeviceToken.mockResolvedValue(null);
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const result = await authenticatedApiCall('https://api.example.com/test', {}, 'token123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
      expect(result.error).toContain('aifabrix login');
    });

    it('should handle token refresh error', async() => {
      const mock401Response = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('{"error": "Unauthorized"}')
      };

      global.fetch.mockResolvedValue(mock401Response);
      parseErrorResponse.mockReturnValue({
        type: 'authentication',
        message: 'Unauthorized',
        data: {},
        formatted: 'Unauthorized'
      });

      forceRefreshDeviceToken.mockRejectedValue(new Error('Refresh failed'));
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const result = await authenticatedApiCall('https://api.example.com/test', {}, 'token123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
      expect(result.error).toContain('Refresh failed');
    });

    it('should merge custom headers', async() => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue({}),
        text: jest.fn()
      };

      global.fetch.mockResolvedValue(mockResponse);
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const options = {
        headers: {
          'X-Custom-Header': 'custom-value'
        }
      };

      await authenticatedApiCall('https://api.example.com/test', options, 'token123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
            'Content-Type': 'application/json',
            'X-Custom-Header': 'custom-value'
          })
        })
      );
    });

    it('should make call without token if not provided', async() => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue({}),
        text: jest.fn()
      };

      global.fetch.mockResolvedValue(mockResponse);
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      await authenticatedApiCall('https://api.example.com/test', {});

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.anything()
          })
        })
      );
    });
  });

  describe('Device Code Flow Functions', () => {
    it('should export initiateDeviceCodeFlow', () => {
      expect(initiateDeviceCodeFlow).toBeDefined();
    });

    it('should export pollDeviceCodeToken', () => {
      expect(pollDeviceCodeToken).toBeDefined();
    });

    it('should export displayDeviceCodeInfo', () => {
      expect(displayDeviceCodeInfo).toBeDefined();
    });

    it('should export refreshDeviceToken', () => {
      expect(refreshDeviceToken).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle audit logging failure gracefully', async() => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue({ data: 'test' }),
        text: jest.fn()
      };

      global.fetch.mockResolvedValue(mockResponse);
      auditLogger.logApiCall.mockRejectedValue(new Error('Logging failed'));
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const result = await makeApiCall('https://api.example.com/test');

      // Should still succeed even if logging fails
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'test' });
    });

    it('should parse non-JSON error text', async() => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Plain text error')
      };

      global.fetch.mockResolvedValue(mockResponse);
      parseErrorResponse.mockReturnValue({
        type: 'server',
        message: 'Plain text error',
        data: {},
        formatted: 'Plain text error'
      });
      jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);

      const result = await makeApiCall('https://api.example.com/test');

      expect(parseErrorResponse).toHaveBeenCalledWith('Plain text error', 500, false);
      expect(result.success).toBe(false);
    });
  });
});

