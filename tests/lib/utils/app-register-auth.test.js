/**
 * Tests for App Register Auth Module
 *
 * @fileoverview Unit tests for lib/utils/app-register-auth.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.yellow = jest.fn((text) => text);
  return mockChalk;
});

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock config
jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn(),
  normalizeControllerUrl: jest.fn((url) => url)
}));

// Mock token-manager
jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));

// Mock error formatter
jest.mock('../../../lib/utils/error-formatters/http-status-errors', () => ({
  formatAuthenticationError: jest.fn((data) => `Formatted auth error: ${data.message || 'Unknown error'}`)
}));

const logger = require('../../../lib/utils/logger');
const { getConfig, normalizeControllerUrl } = require('../../../lib/core/config');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const { formatAuthenticationError } = require('../../../lib/utils/error-formatters/http-status-errors');
const { checkAuthentication } = require('../../../lib/utils/app-register-auth');

// Mock process.exit
const originalExit = process.exit;
beforeAll(() => {
  process.exit = jest.fn();
});

afterAll(() => {
  process.exit = originalExit;
});

describe('App Register Auth Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAuthentication', () => {
    it('should successfully authenticate with provided controller URL', async() => {
      const controllerUrl = 'https://controller.example.com';
      const normalizedUrl = 'https://controller.example.com';
      const token = 'test-token';
      const config = {
        device: {}
      };

      getConfig.mockResolvedValue(config);
      normalizeControllerUrl.mockReturnValue(normalizedUrl);
      getOrRefreshDeviceToken.mockResolvedValue({
        token: token,
        controller: normalizedUrl
      });

      const result = await checkAuthentication(controllerUrl);

      expect(getConfig).toHaveBeenCalled();
      expect(normalizeControllerUrl).toHaveBeenCalledWith(controllerUrl);
      expect(getOrRefreshDeviceToken).toHaveBeenCalledWith(normalizedUrl);
      expect(result).toEqual({
        apiUrl: normalizedUrl,
        token: token,
        controllerUrl: normalizedUrl
      });
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should find token from config when controller URL not provided', async() => {
      const controllerUrl = null;
      const config = {
        device: {
          'https://controller1.example.com': { token: 'token1' },
          'https://controller2.example.com': { token: 'token2' }
        }
      };
      const token = 'token1';
      const foundUrl = 'https://controller1.example.com';

      getConfig.mockResolvedValue(config);
      normalizeControllerUrl.mockReturnValue(foundUrl);
      getOrRefreshDeviceToken.mockResolvedValue({
        token: token,
        controller: foundUrl
      });

      const result = await checkAuthentication(controllerUrl);

      expect(result).toEqual({
        apiUrl: foundUrl,
        token: token,
        controllerUrl: foundUrl
      });
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should try multiple URLs from config until token found', async() => {
      const controllerUrl = null;
      const config = {
        device: {
          'https://controller1.example.com': {},
          'https://controller2.example.com': {}
        }
      };
      const token = 'token2';
      const foundUrl = 'https://controller2.example.com';

      getConfig.mockResolvedValue(config);
      normalizeControllerUrl.mockImplementation((url) => url);
      getOrRefreshDeviceToken
        .mockResolvedValueOnce(null) // First URL fails
        .mockResolvedValueOnce({
          token: token,
          controller: foundUrl
        }); // Second URL succeeds

      const result = await checkAuthentication(controllerUrl);

      expect(getOrRefreshDeviceToken).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        apiUrl: foundUrl,
        token: token,
        controllerUrl: foundUrl
      });
    });

    it('should handle empty string controller URL as null', async() => {
      const controllerUrl = '';
      const config = {
        device: {
          'https://controller.example.com': {}
        }
      };
      const token = 'test-token';
      const foundUrl = 'https://controller.example.com';

      getConfig.mockResolvedValue(config);
      normalizeControllerUrl.mockReturnValue(foundUrl);
      getOrRefreshDeviceToken.mockResolvedValue({
        token: token,
        controller: foundUrl
      });

      const result = await checkAuthentication(controllerUrl);

      expect(result).toEqual({
        apiUrl: foundUrl,
        token: token,
        controllerUrl: foundUrl
      });
    });

    it('should display error and exit when no token found', async() => {
      const controllerUrl = 'https://controller.example.com';
      const normalizedUrl = 'https://controller.example.com';
      const config = {
        device: {}
      };

      getConfig.mockResolvedValue(config);
      normalizeControllerUrl.mockReturnValue(normalizedUrl);
      getOrRefreshDeviceToken.mockResolvedValue(null);
      formatAuthenticationError.mockReturnValue('Formatted auth error: No token found');

      await checkAuthentication(controllerUrl);

      expect(logger.error).toHaveBeenCalledWith('Formatted auth error: No token found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should display error when all config URLs fail', async() => {
      const controllerUrl = null;
      const config = {
        device: {
          'https://controller1.example.com': {},
          'https://controller2.example.com': {}
        }
      };

      getConfig.mockResolvedValue(config);
      normalizeControllerUrl.mockImplementation((url) => url);
      getOrRefreshDeviceToken.mockResolvedValue(null);
      formatAuthenticationError.mockReturnValue('Formatted auth error: No valid authentication found');

      await checkAuthentication(controllerUrl);

      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle error when getting token for provided controller URL', async() => {
      const controllerUrl = 'https://controller.example.com';
      const normalizedUrl = 'https://controller.example.com';
      const config = {
        device: {
          'https://fallback.example.com': {}
        }
      };
      const error = new Error('Token expired');
      const fallbackToken = 'fallback-token';
      const fallbackUrl = 'https://fallback.example.com';

      getConfig.mockResolvedValue(config);
      normalizeControllerUrl.mockReturnValue(normalizedUrl);
      getOrRefreshDeviceToken
        .mockRejectedValueOnce(error) // First URL fails with error
        .mockResolvedValueOnce({
          token: fallbackToken,
          controller: fallbackUrl
        }); // Fallback succeeds

      const result = await checkAuthentication(controllerUrl);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to get token'));
      expect(result).toEqual({
        apiUrl: fallbackUrl,
        token: fallbackToken,
        controllerUrl: fallbackUrl
      });
    });

    it('should handle error when getting config fails', async() => {
      const controllerUrl = 'https://controller.example.com';
      const error = new Error('Config error');

      getConfig.mockRejectedValue(error);
      formatAuthenticationError.mockReturnValue('Formatted auth error: Config error');

      await checkAuthentication(controllerUrl);

      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should use controller from token result when available', async() => {
      const controllerUrl = 'https://controller.example.com';
      const normalizedUrl = 'https://controller.example.com';
      const tokenController = 'https://actual-controller.example.com';
      const token = 'test-token';
      const config = {
        device: {}
      };

      getConfig.mockResolvedValue(config);
      normalizeControllerUrl.mockReturnValue(normalizedUrl);
      getOrRefreshDeviceToken.mockResolvedValue({
        token: token,
        controller: tokenController
      });

      const result = await checkAuthentication(controllerUrl);

      expect(result.controllerUrl).toBe(tokenController);
      expect(result.apiUrl).toBe(tokenController);
    });

    it('should handle whitespace-only controller URL as null', async() => {
      const controllerUrl = '   ';
      const config = {
        device: {
          'https://controller.example.com': {}
        }
      };
      const token = 'test-token';
      const foundUrl = 'https://controller.example.com';

      getConfig.mockResolvedValue(config);
      normalizeControllerUrl.mockReturnValue(foundUrl);
      getOrRefreshDeviceToken.mockResolvedValue({
        token: token,
        controller: foundUrl
      });

      const result = await checkAuthentication(controllerUrl);

      expect(result).toEqual({
        apiUrl: foundUrl,
        token: token,
        controllerUrl: foundUrl
      });
    });

    it('should continue trying URLs even if some fail with errors', async() => {
      const controllerUrl = null;
      const config = {
        device: {
          'https://controller1.example.com': {},
          'https://controller2.example.com': {},
          'https://controller3.example.com': {}
        }
      };
      const token = 'token3';
      const foundUrl = 'https://controller3.example.com';

      getConfig.mockResolvedValue(config);
      normalizeControllerUrl.mockImplementation((url) => url);
      getOrRefreshDeviceToken
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          token: token,
          controller: foundUrl
        });

      const result = await checkAuthentication(controllerUrl);

      expect(getOrRefreshDeviceToken).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        apiUrl: foundUrl,
        token: token,
        controllerUrl: foundUrl
      });
    });
  });
});

