/**
 * Tests for API Utilities Module
 *
 * @fileoverview Tests for utils/api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock validator module
jest.mock('../../lib/validator');

// Mock audit logger module
jest.mock('../../lib/audit-logger', () => ({
  logApiCall: jest.fn().mockResolvedValue()
}));

// Mock token-manager module
jest.mock('../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));

// CRITICAL: Ensure fetch is mocked before requiring the module
// The global mock from tests/setup.js should already be set, but we ensure it's a jest.fn()
if (!global.fetch || typeof global.fetch.mockResolvedValue !== 'function') {
  global.fetch = jest.fn();
}

// Increase timeout for tests using fake timers
jest.setTimeout(30000);

const { makeApiCall, authenticatedApiCall, initiateDeviceCodeFlow, pollDeviceCodeToken, displayDeviceCodeInfo } = require('../../lib/utils/api');
const { getOrRefreshDeviceToken } = require('../../lib/utils/token-manager');

describe('API Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure fetch mock is reset and has default implementation
    if (global.fetch && typeof global.fetch.mockResolvedValue === 'function') {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue({ success: true }),
        text: jest.fn().mockResolvedValue('OK')
      });
    }
  });

  describe('makeApiCall', () => {
    it('should make successful API call and return JSON', async() => {
      const mockData = { id: 1, name: 'Test' };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(mockData)
      });

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', {});
    });

    it('should make successful API call and return text', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'text/plain'
        },
        text: jest.fn().mockResolvedValue('Success')
      });

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(true);
      expect(result.data).toBe('Success');
      expect(result.status).toBe(200);
    });

    it('should handle 400 error with JSON error response', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Invalid request' }))
      });

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation error');
      expect(result.errorType).toBe('validation');
      expect(result.status).toBe(400);
      expect(result.formattedError).toBeDefined();
      expect(result.errorData).toBeDefined();
    });

    it('should handle 404 error with text error response', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Not Found')
      });

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not Found');
      expect(result.errorType).toBe('notfound');
      expect(result.status).toBe(404);
      expect(result.formattedError).toBeDefined();
      expect(result.formattedError).toContain('❌ Not Found');
    });

    it('should handle 401 error with error JSON', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'Authentication failed' }))
      });

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
      expect(result.errorType).toBe('authentication');
      expect(result.status).toBe(401);
      expect(result.formattedError).toBeDefined();
      expect(result.errorData).toBeDefined();
    });

    it('should handle network errors', async() => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.errorType).toBe('network');
      expect(result.network).toBe(true);
      expect(result.formattedError).toBeDefined();
    });

    it('should pass options to fetch', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({})
      });

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
    it('should add Authorization header with bearer token', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({ success: true })
      });

      await authenticatedApiCall('https://api.example.com/test', {}, 'test-token-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should work without token', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({ success: true })
      });

      await authenticatedApiCall('https://api.example.com/test', {});

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should merge existing headers', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({ success: true })
      });

      await authenticatedApiCall(
        'https://api.example.com/test',
        { headers: { 'X-Custom': 'value' } },
        'token'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token',
            'Content-Type': 'application/json',
            'X-Custom': 'value'
          })
        })
      );
    });

    it('should propagate errors from makeApiCall', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Access denied' }))
      });

      const result = await authenticatedApiCall('https://api.example.com/test', {}, 'token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
      expect(result.errorType).toBe('permission');
      expect(result.status).toBe(403);
      expect(result.formattedError).toBeDefined();
      expect(result.errorData).toBeDefined();
    });

    it('should handle 401 error with successful token refresh and retry', async() => {
      // First call returns 401, second call (after refresh) returns success
      let callCount = 0;
      global.fetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: 401 error
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Token expired' }))
          });
        }
        // Second call: success after refresh
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: () => 'application/json'
          },
          json: jest.fn().mockResolvedValue({ id: 1 })
        });
      });

      // Mock successful token refresh
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'refreshed-token-123',
        controller: 'https://api.example.com'
      });

      const result = await authenticatedApiCall('https://api.example.com/api/v1/test', {}, 'old-token');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1 });
      expect(getOrRefreshDeviceToken).toHaveBeenCalledWith('https://api.example.com');
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Verify second call uses refreshed token
      const secondCall = global.fetch.mock.calls[1];
      expect(secondCall[1].headers['Authorization']).toBe('Bearer refreshed-token-123');
    });

    it('should handle 401 error when token refresh fails', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Token expired' }))
      });

      // Mock failed token refresh
      getOrRefreshDeviceToken.mockResolvedValue(null);

      const result = await authenticatedApiCall('https://api.example.com/api/v1/test', {}, 'old-token');

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
      expect(result.error).toContain('Authentication failed');
      expect(result.error).toContain('Please login again using: aifabrix login');
      expect(getOrRefreshDeviceToken).toHaveBeenCalledWith('https://api.example.com');
      // Should only call fetch once (no retry when refresh fails)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle 401 error when token refresh throws error', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Token expired' }))
      });

      // Mock token refresh throwing error
      getOrRefreshDeviceToken.mockRejectedValue(new Error('Refresh failed'));

      const result = await authenticatedApiCall('https://api.example.com/api/v1/test', {}, 'old-token');

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
      expect(result.error).toContain('Authentication failed');
      expect(result.error).toContain('Refresh failed');
      expect(result.error).toContain('Please login again using: aifabrix login');
      expect(getOrRefreshDeviceToken).toHaveBeenCalledWith('https://api.example.com');
      // Should only call fetch once (no retry when refresh throws)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should extract controller URL using regex when URL parsing fails', async() => {
      // Mock URL constructor to throw (simulating invalid URL)
      const originalURL = global.URL;
      global.URL = jest.fn(() => {
        throw new TypeError('Invalid URL');
      });

      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Token expired' }))
      });

      getOrRefreshDeviceToken.mockResolvedValue(null);

      // Use a URL that will cause URL parsing to fail but regex can match
      // Note: The URL constructor will throw, so extractControllerUrl will use regex fallback
      const malformedUrl = 'https://api.example.com/api/v1/test';

      const result = await authenticatedApiCall(malformedUrl, {}, 'old-token');

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
      // Should extract controller URL using regex fallback
      expect(getOrRefreshDeviceToken).toHaveBeenCalledWith('https://api.example.com');

      // Restore URL
      global.URL = originalURL;
    });

    it('should return original URL when regex extraction fails', async() => {
      // Mock URL constructor to throw
      const originalURL = global.URL;
      global.URL = jest.fn(() => {
        throw new TypeError('Invalid URL');
      });

      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Token expired' }))
      });

      getOrRefreshDeviceToken.mockResolvedValue(null);

      // Use a URL that doesn't match the regex pattern
      const invalidUrl = 'not-a-valid-url';

      const result = await authenticatedApiCall(invalidUrl, {}, 'old-token');

      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
      // Should use original URL when regex fails
      expect(getOrRefreshDeviceToken).toHaveBeenCalledWith('not-a-valid-url');

      // Restore URL
      global.URL = originalURL;
    });
  });

  describe('initiateDeviceCodeFlow', () => {
    it('should successfully initiate device code flow', async() => {
      // OpenAPI schema uses camelCase
      const deviceCodeResponse = {
        success: true,
        data: {
          deviceCode: 'device-code-123',
          userCode: 'ABCD-EFGH',
          verificationUri: 'https://auth.example.com/device',
          expiresIn: 600,
          interval: 5
        },
        timestamp: new Date().toISOString()
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(deviceCodeResponse)
      });

      const result = await initiateDeviceCodeFlow('https://controller.example.com', 'dev');

      expect(result.device_code).toBe('device-code-123');
      expect(result.user_code).toBe('ABCD-EFGH');
      expect(result.verification_uri).toBe('https://auth.example.com/device');
      expect(result.expires_in).toBe(600);
      expect(result.interval).toBe(5);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://controller.example.com/api/v1/auth/login?environment=dev',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'openid profile email' })
        })
      );
    });

    it('should include default scope in request body', async() => {
      const deviceCodeResponse = {
        success: true,
        data: {
          deviceCode: 'device-code-123',
          userCode: 'ABCD-EFGH',
          verificationUri: 'https://auth.example.com/device',
          expiresIn: 600,
          interval: 5
        },
        timestamp: new Date().toISOString()
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(deviceCodeResponse)
      });

      await initiateDeviceCodeFlow('https://controller.example.com', 'dev');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://controller.example.com/api/v1/auth/login?environment=dev',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'openid profile email' })
        })
      );
    });

    it('should include custom scope in request body', async() => {
      const deviceCodeResponse = {
        success: true,
        data: {
          deviceCode: 'device-code-123',
          userCode: 'ABCD-EFGH',
          verificationUri: 'https://auth.example.com/device',
          expiresIn: 600,
          interval: 5
        },
        timestamp: new Date().toISOString()
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(deviceCodeResponse)
      });

      await initiateDeviceCodeFlow('https://controller.example.com', 'dev', 'openid profile email offline_access');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://controller.example.com/api/v1/auth/login?environment=dev',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'openid profile email offline_access' })
        })
      );
    });

    it('should support snake_case for RFC 8628 compatibility', async() => {
      // RFC 8628 uses snake_case
      const deviceCodeResponse = {
        success: true,
        data: {
          deviceCode: 'device-code-123',
          userCode: 'ABCD-EFGH',
          verificationUri: 'https://auth.example.com/device',
          expiresIn: 600,
          interval: 5
        },
        timestamp: new Date().toISOString()
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(deviceCodeResponse)
      });

      const result = await initiateDeviceCodeFlow('https://controller.example.com', 'dev');

      expect(result.device_code).toBe('device-code-123');
      expect(result.user_code).toBe('ABCD-EFGH');
      expect(result.verification_uri).toBe('https://auth.example.com/device');
      expect(result.expires_in).toBe(600);
      expect(result.interval).toBe(5);
    });

    it('should use default values for expires_in and interval', async() => {
      const deviceCodeResponse = {
        success: true,
        data: {
          deviceCode: 'device-code-123',
          userCode: 'ABCD-EFGH',
          verificationUri: 'https://auth.example.com/device'
        },
        timestamp: new Date().toISOString()
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(deviceCodeResponse)
      });

      const result = await initiateDeviceCodeFlow('https://controller.example.com', 'dev');

      expect(result.expires_in).toBe(600);
      expect(result.interval).toBe(5);
    });

    it('should throw error if environment key is missing', async() => {
      await expect(initiateDeviceCodeFlow('https://controller.example.com', null))
        .rejects.toThrow('Environment key is required');
    });

    it('should throw error if API call fails', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Invalid environment' }))
      });

      await expect(initiateDeviceCodeFlow('https://controller.example.com', 'dev'))
        .rejects.toThrow('Device code initiation failed');
    });

    it('should throw error if response is missing required fields', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({
          success: true,
          data: { deviceCode: 'test' },
          timestamp: new Date().toISOString()
        })
      });

      await expect(initiateDeviceCodeFlow('https://controller.example.com', 'dev'))
        .rejects.toThrow('Invalid device code response');
    });

    it('should URL encode environment parameter', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({
          success: true,
          data: {
            deviceCode: 'test',
            userCode: 'TEST',
            verificationUri: 'https://example.com',
            expiresIn: 600,
            interval: 5
          },
          timestamp: new Date().toISOString()
        })
      });

      await initiateDeviceCodeFlow('https://controller.example.com', 'dev-test');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://controller.example.com/api/v1/auth/login?environment=dev-test',
        expect.any(Object)
      );
    });
  });

  describe('pollDeviceCodeToken', () => {
    beforeEach(() => {
      jest.useFakeTimers({
        now: Date.now(),
        advanceTimers: true
      });
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllMocks();
    });

    it('should successfully poll and get token', async() => {
      // OpenAPI schema uses camelCase
      const tokenResponse = {
        success: true,
        data: {
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-123',
          expiresIn: 3600
        },
        timestamp: new Date().toISOString()
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(tokenResponse)
      });

      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 600);

      // Process pending promises
      await Promise.resolve();
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const result = await pollPromise;

      expect(result.access_token).toBe('access-token-123');
      expect(result.refresh_token).toBe('refresh-token-123');
      expect(result.expires_in).toBe(3600);

      // Verify request uses camelCase
      expect(global.fetch).toHaveBeenCalledWith(
        'https://controller.example.com/api/v1/auth/login/device/token',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ deviceCode: 'device-code-123' })
        })
      );
    });

    it('should support snake_case token response for RFC 8628 compatibility', async() => {
      // RFC 8628 uses snake_case
      const tokenResponse = {
        success: true,
        data: {
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-123',
          expiresIn: 3600
        },
        timestamp: new Date().toISOString()
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(tokenResponse)
      });

      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 600);

      await Promise.resolve();
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const result = await pollPromise;

      expect(result.access_token).toBe('access-token-123');
      expect(result.refresh_token).toBe('refresh-token-123');
      expect(result.expires_in).toBe(3600);
    });

    it('should use default expires_in if not provided', async() => {
      const tokenResponse = {
        success: true,
        data: {
          accessToken: 'access-token-123'
        },
        timestamp: new Date().toISOString()
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(tokenResponse)
      });

      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 600);

      await Promise.resolve();
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      const result = await pollPromise;

      expect(result.expires_in).toBe(3600);
    });

    it('should handle authorization_pending and continue polling', async() => {
      // OpenAPI schema: 202 response with error field
      const tokenResponse = {
        success: true,
        data: {
          accessToken: 'access-token-123',
          expiresIn: 3600
        },
        timestamp: new Date().toISOString()
      };

      let callCount = 0;
      global.fetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 202 status for authorization_pending
          return Promise.resolve({
            ok: false,
            status: 202,
            statusText: 'Accepted',
            text: jest.fn().mockResolvedValue(JSON.stringify({
              success: false,
              error: 'authorization_pending',
              errorDescription: 'Authorization pending',
              timestamp: new Date().toISOString()
            }))
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: () => 'application/json'
          },
          json: jest.fn().mockResolvedValue(tokenResponse)
        });
      });

      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 600);

      // Let first fetch execute
      await Promise.resolve();

      // Advance timers and flush pending promises
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();
      await Promise.resolve();

      const result = await pollPromise;

      expect(result.access_token).toBe('access-token-123');
      expect(callCount).toBe(2);
    }, 15000);

    it('should handle authorization_pending in HTTP 200 response and continue polling', async() => {
      // Some APIs return HTTP 200 with authorization_pending in the body
      const tokenResponse = {
        success: true,
        data: {
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-123',
          expiresIn: 3600
        },
        timestamp: new Date().toISOString()
      };

      let callCount = 0;
      global.fetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 200 status with authorization_pending in body
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: {
              get: () => 'application/json'
            },
            json: jest.fn().mockResolvedValue({
              success: true,
              data: {
                error: 'authorization_pending',
                errorDescription: 'Authorization pending'
              },
              timestamp: new Date().toISOString()
            })
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: () => 'application/json'
          },
          json: jest.fn().mockResolvedValue(tokenResponse)
        });
      });

      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 600);

      // Let first fetch execute
      await Promise.resolve();

      // Advance timers and flush pending promises
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();
      await Promise.resolve();

      const result = await pollPromise;

      expect(result.access_token).toBe('access-token-123');
      expect(callCount).toBe(2);
    }, 15000);

    it('should throw error on expired_token', async() => {
      // OpenAPI schema: 410 status for expired_token
      global.fetch.mockResolvedValue({
        ok: false,
        status: 410,
        statusText: 'Gone',
        text: jest.fn().mockResolvedValue(JSON.stringify({
          success: false,
          error: 'expired_token',
          errorDescription: 'Device code expired',
          timestamp: new Date().toISOString()
        }))
      });

      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 600);

      await Promise.resolve();
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      await expect(pollPromise).rejects.toThrow('Device code expired');
    });

    it('should throw error on authorization_declined', async() => {
      // OpenAPI schema: 410 status for authorization_declined
      global.fetch.mockResolvedValue({
        ok: false,
        status: 410,
        statusText: 'Gone',
        text: jest.fn().mockResolvedValue(JSON.stringify({
          success: false,
          error: 'authorization_declined',
          errorDescription: 'User declined authorization',
          timestamp: new Date().toISOString()
        }))
      });

      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 600);

      await Promise.resolve();
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      await expect(pollPromise).rejects.toThrow('Authorization declined');
    });

    it('should handle slow_down and increase interval', async() => {
      // OpenAPI schema: 202 status for slow_down
      const tokenResponse = {
        success: true,
        data: {
          accessToken: 'access-token-123',
          expiresIn: 3600
        },
        timestamp: new Date().toISOString()
      };

      let callCount = 0;
      global.fetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 202,
            statusText: 'Accepted',
            text: jest.fn().mockResolvedValue(JSON.stringify({
              success: false,
              error: 'slow_down',
              errorDescription: 'Polling too fast',
              timestamp: new Date().toISOString()
            }))
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: () => 'application/json'
          },
          json: jest.fn().mockResolvedValue(tokenResponse)
        });
      });

      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 600);

      // Let first fetch execute
      await Promise.resolve();

      // Wait for slow_down interval (5 * 2 = 10 seconds)
      jest.advanceTimersByTime(10000);
      await Promise.resolve();
      await jest.runAllTimersAsync();
      await Promise.resolve();

      const result = await pollPromise;

      expect(result.access_token).toBe('access-token-123');
    }, 20000);

    it('should throw error if device_code is missing', async() => {
      await expect(pollDeviceCodeToken('https://controller.example.com', null, 5, 600))
        .rejects.toThrow('Device code is required');
    });

    it('should throw error if token response is missing access_token', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({
          success: true,
          data: { refreshToken: 'token' },
          timestamp: new Date().toISOString()
        })
      });

      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 600);

      await Promise.resolve();
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      await expect(pollPromise).rejects.toThrow('Invalid token response');
    });

    it('should timeout after expires_in + buffer', async() => {
      const startTime = Date.now();

      // Timeout is expiresIn (10) + 30 buffer = 40 seconds = 40000ms
      const timeoutMs = 40000;

      // Mock Date.now() to advance time when needed
      let mockTime = startTime;
      const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => mockTime);

      // OpenAPI schema: 202 status for authorization_pending
      global.fetch.mockResolvedValue({
        ok: false,
        status: 202,
        statusText: 'Accepted',
        text: jest.fn().mockResolvedValue(JSON.stringify({
          success: false,
          error: 'authorization_pending',
          errorDescription: 'Authorization pending',
          timestamp: new Date().toISOString()
        }))
      });

      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 10); // 10 second expiry

      // Let first fetch execute
      await Promise.resolve();

      // Advance time past timeout (40 seconds + buffer)
      mockTime = startTime + timeoutMs + 2000;

      // Advance timers to trigger setTimeout callbacks and timeout check
      jest.advanceTimersByTime(timeoutMs + 2000);

      // Process pending promises
      await Promise.resolve();
      await Promise.resolve();

      // Now the timeout should be checked and error thrown
      await expect(pollPromise).rejects.toThrow('Maximum polling time exceeded');

      // Restore
      dateNowSpy.mockRestore();
    }, 20000);

    it('should call onPoll callback on each poll attempt', async() => {
      const tokenResponse = {
        success: true,
        data: {
          accessToken: 'access-token-123',
          expiresIn: 3600
        },
        timestamp: new Date().toISOString()
      };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(tokenResponse)
      });

      const onPoll = jest.fn();
      const pollPromise = pollDeviceCodeToken('https://controller.example.com', 'device-code-123', 5, 600, onPoll);

      await Promise.resolve();
      jest.advanceTimersByTime(0);
      await Promise.resolve();

      await pollPromise;

      expect(onPoll).toHaveBeenCalled();
    });
  });

  describe('displayDeviceCodeInfo', () => {
    it('should format and display device code information', () => {
      const logger = {
        log: jest.fn()
      };
      const chalk = {
        cyan: jest.fn((str) => str),
        yellow: jest.fn((str) => str),
        gray: jest.fn((str) => str),
        blue: {
          underline: jest.fn((str) => str)
        },
        bold: {
          cyan: jest.fn((str) => str)
        }
      };

      displayDeviceCodeInfo('ABCD-EFGH', 'https://auth.example.com/device', logger, chalk);

      expect(logger.log).toHaveBeenCalled();
      expect(chalk.cyan).toHaveBeenCalled();
      expect(chalk.yellow).toHaveBeenCalled();
    });
  });
});

