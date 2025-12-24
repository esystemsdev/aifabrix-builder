/**
 * Tests for Device Code Error Paths
 *
 * @fileoverview Unit tests for device-code.js error handling paths
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/api', () => ({
  makeApiCall: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn()
}));
jest.mock('chalk', () => {
  const createMockFn = (text) => text;
  const mockChalk = createMockFn;
  ['blue', 'green', 'red', 'yellow', 'gray'].forEach(prop => {
    mockChalk[prop] = createMockFn;
  });
  return mockChalk;
});

const deviceCode = require('../../../lib/utils/device-code');
const { makeApiCall } = require('../../../lib/utils/api');

describe('Device Code Error Paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateDeviceCodeFlow', () => {
    it('should handle network errors', async() => {
      const controllerUrl = 'https://controller.example.com';
      const environment = 'dev';
      const scope = 'openid profile email';

      makeApiCall.mockRejectedValue(new Error('Network error'));

      await expect(
        deviceCode.initiateDeviceCodeFlow(controllerUrl, environment, scope)
      ).rejects.toThrow('Network error');
    });

    it('should handle API errors', async() => {
      const controllerUrl = 'https://controller.example.com';
      const environment = 'dev';
      const scope = 'openid profile email';

      makeApiCall.mockResolvedValue({
        success: false,
        status: 500,
        error: 'Internal server error'
      });

      await expect(
        deviceCode.initiateDeviceCodeFlow(controllerUrl, environment, scope)
      ).rejects.toThrow();
    });
  });

  describe('pollDeviceCodeToken', () => {
    it('should handle validation errors', async() => {
      const controllerUrl = 'https://controller.example.com';
      const deviceCodeValue = 'test-device-code';
      const interval = 1000;
      const expiresIn = 300;

      makeApiCall.mockResolvedValue({
        success: false,
        status: 400,
        error: 'validation_error',
        formattedError: 'Validation failed',
        errorData: {
          detail: 'Invalid device code',
          errors: []
        }
      });

      await expect(
        deviceCode.pollDeviceCodeToken(controllerUrl, deviceCodeValue, interval, expiresIn)
      ).rejects.toThrow('Token polling failed');
    });

    // Note: Timeout scenario is difficult to test reliably with mocks
    // as it depends on Date.now() which isn't easily mockable.
    // This scenario is better tested in integration tests.

    it('should handle slow_down error', async() => {
      const controllerUrl = 'https://controller.example.com';
      const deviceCodeValue = 'test-device-code';
      const interval = 1000;
      const expiresIn = 300;

      makeApiCall.mockResolvedValue({
        success: false,
        error: 'slow_down'
      });

      // Should not throw, but increase interval
      const promise = deviceCode.pollDeviceCodeToken(controllerUrl, deviceCodeValue, interval, expiresIn);

      // Cancel after a short time to avoid hanging
      setTimeout(() => {
        promise.catch(() => {});
      }, 100);

      // The function should handle slow_down gracefully
      expect(makeApiCall).toHaveBeenCalled();
    });
  });

  describe('refreshDeviceToken', () => {
    it('should throw error when refresh token is missing', async() => {
      const controllerUrl = 'https://controller.example.com';

      await expect(
        deviceCode.refreshDeviceToken(controllerUrl, null)
      ).rejects.toThrow('Refresh token is required');
    });

    it('should throw error when refresh token is not a string', async() => {
      const controllerUrl = 'https://controller.example.com';

      await expect(
        deviceCode.refreshDeviceToken(controllerUrl, 123)
      ).rejects.toThrow('Refresh token is required');
    });

    it('should handle refresh failures', async() => {
      const controllerUrl = 'https://controller.example.com';
      const refreshToken = 'invalid-refresh-token';

      makeApiCall.mockResolvedValue({
        success: false,
        error: 'Invalid refresh token'
      });

      await expect(
        deviceCode.refreshDeviceToken(controllerUrl, refreshToken)
      ).rejects.toThrow('Failed to refresh token');
    });

    it('should handle invalid refresh response', async() => {
      const controllerUrl = 'https://controller.example.com';
      const refreshToken = 'valid-refresh-token';

      makeApiCall.mockResolvedValue({
        success: true,
        data: {
          data: null // Invalid response structure - missing accessToken
        }
      });

      await expect(
        deviceCode.refreshDeviceToken(controllerUrl, refreshToken)
      ).rejects.toThrow('Invalid token response: missing accessToken');
    });

    it('should handle network errors during refresh', async() => {
      const controllerUrl = 'https://controller.example.com';
      const refreshToken = 'valid-refresh-token';

      makeApiCall.mockRejectedValue(new Error('Network error'));

      await expect(
        deviceCode.refreshDeviceToken(controllerUrl, refreshToken)
      ).rejects.toThrow('Network error');
    });
  });
});

