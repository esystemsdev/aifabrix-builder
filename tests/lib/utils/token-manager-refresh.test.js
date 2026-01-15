/**
 * Tests for Token Manager Refresh Module
 *
 * @fileoverview Unit tests for lib/utils/token-manager-refresh.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock config
jest.mock('../../../lib/core/config', () => ({
  saveClientToken: jest.fn(),
  saveDeviceToken: jest.fn()
}));

// Mock api
jest.mock('../../../lib/utils/api', () => ({
  refreshDeviceToken: jest.fn(),
  makeApiCall: jest.fn()
}));

// Mock token-manager
jest.mock('../../../lib/utils/token-manager', () => ({
  loadClientCredentials: jest.fn()
}));

const config = require('../../../lib/core/config');
const { refreshDeviceToken: apiRefreshDeviceToken, makeApiCall } = require('../../../lib/utils/api');
const { loadClientCredentials } = require('../../../lib/utils/token-manager');
const {
  refreshClientToken,
  refreshDeviceToken,
  validateRefreshTokenParams,
  loadClientCredentialsForRefresh,
  callTokenApi,
  calculateTokenExpiration
} = require('../../../lib/utils/token-manager-refresh');

describe('Token Manager Refresh Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('validateRefreshTokenParams', () => {
    it('should not throw for valid parameters', () => {
      expect(() => validateRefreshTokenParams('dev', 'myapp', 'https://controller.com')).not.toThrow();
    });

    it('should throw if environment is missing', () => {
      expect(() => validateRefreshTokenParams(null, 'myapp', 'https://controller.com'))
        .toThrow('Environment is required');
    });

    it('should throw if environment is not a string', () => {
      expect(() => validateRefreshTokenParams(123, 'myapp', 'https://controller.com'))
        .toThrow('Environment is required');
    });

    it('should throw if appName is missing', () => {
      expect(() => validateRefreshTokenParams('dev', null, 'https://controller.com'))
        .toThrow('App name is required');
    });

    it('should throw if appName is not a string', () => {
      expect(() => validateRefreshTokenParams('dev', 123, 'https://controller.com'))
        .toThrow('App name is required');
    });

    it('should throw if controllerUrl is missing', () => {
      expect(() => validateRefreshTokenParams('dev', 'myapp', null))
        .toThrow('Controller URL is required');
    });

    it('should throw if controllerUrl is not a string', () => {
      expect(() => validateRefreshTokenParams('dev', 'myapp', 123))
        .toThrow('Controller URL is required');
    });
  });

  describe('loadClientCredentialsForRefresh', () => {
    it('should return provided credentials', async() => {
      const result = await loadClientCredentialsForRefresh('myapp', 'client-id', 'client-secret');

      expect(result).toEqual({ clientId: 'client-id', clientSecret: 'client-secret' });
      expect(loadClientCredentials).not.toHaveBeenCalled();
    });

    it('should load credentials from secrets when not provided', async() => {
      loadClientCredentials.mockResolvedValue({
        clientId: 'loaded-client-id',
        clientSecret: 'loaded-client-secret'
      });

      const result = await loadClientCredentialsForRefresh('myapp');

      expect(result).toEqual({
        clientId: 'loaded-client-id',
        clientSecret: 'loaded-client-secret'
      });
      expect(loadClientCredentials).toHaveBeenCalledWith('myapp');
    });

    it('should throw error when credentials not found', async() => {
      loadClientCredentials.mockResolvedValue(null);

      await expect(loadClientCredentialsForRefresh('myapp'))
        .rejects.toThrow('Client credentials not found for app');
    });
  });

  describe('callTokenApi', () => {
    it('should successfully call token API', async() => {
      const controllerUrl = 'https://controller.com';
      const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };
      const response = {
        success: true,
        data: {
          token: 'new-token',
          expiresIn: 3600
        }
      };

      makeApiCall.mockResolvedValue(response);

      const result = await callTokenApi(controllerUrl, credentials);

      expect(makeApiCall).toHaveBeenCalledWith(
        'https://controller.com/api/v1/auth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-client-id': 'client-id',
            'x-client-secret': 'client-secret'
          })
        })
      );
      expect(result).toEqual(response.data);
    });

    it('should throw error when API call fails', async() => {
      const controllerUrl = 'https://controller.com';
      const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };
      const response = {
        success: false,
        error: 'Authentication failed'
      };

      makeApiCall.mockResolvedValue(response);

      await expect(callTokenApi(controllerUrl, credentials))
        .rejects.toThrow('Failed to refresh token: Authentication failed');
    });

    it('should throw error when token is missing in response', async() => {
      const controllerUrl = 'https://controller.com';
      const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };
      const response = {
        success: true,
        data: {
          // Missing token
        }
      };

      makeApiCall.mockResolvedValue(response);

      await expect(callTokenApi(controllerUrl, credentials))
        .rejects.toThrow('Invalid response: missing token');
    });
  });

  describe('calculateTokenExpiration', () => {
    it('should use expiresAt when provided', () => {
      const responseData = {
        expiresAt: '2024-12-31T00:00:00Z'
      };

      const result = calculateTokenExpiration(responseData);

      expect(result).toBe('2024-12-31T00:00:00Z');
    });

    it('should calculate from expiresIn when expiresAt not provided', () => {
      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const responseData = {
        expiresIn: 3600
      };

      const result = calculateTokenExpiration(responseData);

      expect(result).toBe('2024-01-01T01:00:00.000Z');
    });

    it('should use default expiresIn when not provided', () => {
      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const responseData = {};

      const result = calculateTokenExpiration(responseData);

      // Default is 86400 seconds (24 hours)
      expect(result).toBe('2024-01-02T00:00:00.000Z');
    });
  });

  describe('refreshClientToken', () => {
    it('should successfully refresh client token', async() => {
      const environment = 'dev';
      const appName = 'myapp';
      const controllerUrl = 'https://controller.com';
      const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };
      const responseData = {
        token: 'new-token',
        expiresIn: 3600
      };

      loadClientCredentials.mockResolvedValue(credentials);
      makeApiCall.mockResolvedValue({
        success: true,
        data: responseData
      });
      config.saveClientToken.mockResolvedValue();
      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      const result = await refreshClientToken(environment, appName, controllerUrl);

      expect(config.saveClientToken).toHaveBeenCalledWith(
        environment,
        appName,
        controllerUrl,
        'new-token',
        expect.any(String)
      );
      expect(result).toEqual({
        token: 'new-token',
        expiresAt: expect.any(String)
      });
    });

    it('should use provided client credentials', async() => {
      const environment = 'dev';
      const appName = 'myapp';
      const controllerUrl = 'https://controller.com';
      const clientId = 'provided-client-id';
      const clientSecret = 'provided-client-secret';
      const responseData = {
        token: 'new-token',
        expiresIn: 3600
      };

      makeApiCall.mockResolvedValue({
        success: true,
        data: responseData
      });
      config.saveClientToken.mockResolvedValue();

      await refreshClientToken(environment, appName, controllerUrl, clientId, clientSecret);

      expect(loadClientCredentials).not.toHaveBeenCalled();
      expect(makeApiCall).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-client-id': clientId,
            'x-client-secret': clientSecret
          })
        })
      );
    });
  });

  describe('refreshDeviceToken', () => {
    it('should successfully refresh device token', async() => {
      const controllerUrl = 'https://controller.com';
      const refreshToken = 'refresh-token';
      const tokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      };

      apiRefreshDeviceToken.mockResolvedValue(tokenResponse);
      config.saveDeviceToken.mockResolvedValue();
      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      const result = await refreshDeviceToken(controllerUrl, refreshToken);

      expect(apiRefreshDeviceToken).toHaveBeenCalledWith(controllerUrl, refreshToken);
      expect(config.saveDeviceToken).toHaveBeenCalledWith(
        controllerUrl,
        'new-access-token',
        'new-refresh-token',
        expect.any(String)
      );
      expect(result).toEqual({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: expect.any(String)
      });
    });

    it('should use old refresh token when new one not provided', async() => {
      const controllerUrl = 'https://controller.com';
      const refreshToken = 'old-refresh-token';
      const tokenResponse = {
        access_token: 'new-access-token',
        // No refresh_token in response
        expires_in: 3600
      };

      apiRefreshDeviceToken.mockResolvedValue(tokenResponse);
      config.saveDeviceToken.mockResolvedValue();

      const result = await refreshDeviceToken(controllerUrl, refreshToken);

      expect(result.refreshToken).toBe('old-refresh-token');
    });

    it('should throw error if controllerUrl is missing', async() => {
      await expect(refreshDeviceToken(null, 'refresh-token'))
        .rejects.toThrow('Controller URL is required');
    });

    it('should throw error if refreshToken is missing', async() => {
      await expect(refreshDeviceToken('https://controller.com', null))
        .rejects.toThrow('Refresh token is required');
    });

    it('should throw error for expired refresh token', async() => {
      const controllerUrl = 'https://controller.com';
      const refreshToken = 'expired-token';
      const error = new Error('Token expired');

      apiRefreshDeviceToken.mockRejectedValue(error);

      await expect(refreshDeviceToken(controllerUrl, refreshToken))
        .rejects.toThrow('Refresh token has expired. Please login again');
    });

    it('should throw error for invalid refresh token', async() => {
      const controllerUrl = 'https://controller.com';
      const refreshToken = 'invalid-token';
      const error = new Error('Invalid token');

      apiRefreshDeviceToken.mockRejectedValue(error);

      await expect(refreshDeviceToken(controllerUrl, refreshToken))
        .rejects.toThrow('Refresh token has expired. Please login again');
    });

    it('should throw error for 401 unauthorized', async() => {
      const controllerUrl = 'https://controller.com';
      const refreshToken = 'token';
      const error = new Error('401 Unauthorized');

      apiRefreshDeviceToken.mockRejectedValue(error);

      await expect(refreshDeviceToken(controllerUrl, refreshToken))
        .rejects.toThrow('Refresh token has expired. Please login again');
    });

    it('should re-throw other errors', async() => {
      const controllerUrl = 'https://controller.com';
      const refreshToken = 'token';
      const error = new Error('Network error');

      apiRefreshDeviceToken.mockRejectedValue(error);

      await expect(refreshDeviceToken(controllerUrl, refreshToken))
        .rejects.toThrow('Network error');
    });

    it('should use default expiresIn when not provided', async() => {
      const controllerUrl = 'https://controller.com';
      const refreshToken = 'refresh-token';
      const tokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token'
        // No expires_in
      };

      apiRefreshDeviceToken.mockResolvedValue(tokenResponse);
      config.saveDeviceToken.mockResolvedValue();
      jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      const result = await refreshDeviceToken(controllerUrl, refreshToken);

      // Default expires_in is 3600 seconds
      expect(result.expiresAt).toBe('2024-01-01T01:00:00.000Z');
    });
  });
});

