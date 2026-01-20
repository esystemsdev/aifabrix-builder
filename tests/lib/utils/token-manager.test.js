/**
 * Tests for Token Manager Module
 *
 * @fileoverview Tests for token-manager.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Mock dependencies
jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/api');
jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn()
}));

const tokenManager = require('../../../lib/utils/token-manager');
const config = require('../../../lib/core/config');
const api = require('../../../lib/utils/api');

describe('Token Manager Module', () => {
  const mockHomeDir = '/mock/home';
  const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock os.homedir
    jest.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);
    // Mock paths.getAifabrixHome() to return default path
    const pathsUtil = require('../../../lib/utils/paths');
    pathsUtil.getAifabrixHome.mockReturnValue(path.join(mockHomeDir, '.aifabrix'));
  });

  describe('loadClientCredentials', () => {
    it('should load credentials from secrets.local.yaml', async() => {
      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      const result = await tokenManager.loadClientCredentials('keycloak');

      expect(result).toEqual({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });
    });

    it('should return null when secrets file does not exist', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      const result = await tokenManager.loadClientCredentials('keycloak');

      expect(result).toBeNull();
    });

    it('should return null when credentials not found', async() => {
      const mockSecrets = {
        'other-app-client-idKeyVault': 'some-id'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      const result = await tokenManager.loadClientCredentials('keycloak');

      expect(result).toBeNull();
    });

    it('should throw error when app name is invalid', async() => {
      await expect(tokenManager.loadClientCredentials('')).rejects.toThrow('App name is required');
      await expect(tokenManager.loadClientCredentials(null)).rejects.toThrow('App name is required');
      await expect(tokenManager.loadClientCredentials(undefined)).rejects.toThrow('App name is required');
    });

    it('should return null when file read fails', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await tokenManager.loadClientCredentials('keycloak');

      expect(result).toBeNull();
    });

    it('should return null when YAML parsing fails', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('invalid: yaml: content: [unclosed');

      const result = await tokenManager.loadClientCredentials('keycloak');

      expect(result).toBeNull();
    });

    it('should return null when secrets file is empty', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('');

      const result = await tokenManager.loadClientCredentials('keycloak');

      expect(result).toBeNull();
    });

    it('should respect config.yaml aifabrix-home override', async() => {
      const overrideHome = '/custom/aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.local.yaml');
      const pathsUtil = require('../../../lib/utils/paths');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);

      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      const result = await tokenManager.loadClientCredentials('keycloak');

      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalledWith(overrideSecretsPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(overrideSecretsPath, 'utf8');
      expect(result).toEqual({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });
    });

    it('should use paths.getAifabrixHome() instead of os.homedir()', async() => {
      const overrideHome = '/workspace/.aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.local.yaml');
      const pathsUtil = require('../../../lib/utils/paths');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);

      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      // Get the current call count before this test
      const initialExistsSyncCalls = fs.existsSync.mock.calls.length;
      const initialReadFileSyncCalls = fs.readFileSync.mock.calls.length;

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockSecrets));

      const result = await tokenManager.loadClientCredentials('keycloak');

      // Verify paths.getAifabrixHome() was called
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      // Verify it read from the override path, not the default os.homedir() path
      // Check only the calls made during this test (after initial calls)
      const newExistsSyncCalls = fs.existsSync.mock.calls.slice(initialExistsSyncCalls);
      const newReadFileSyncCalls = fs.readFileSync.mock.calls.slice(initialReadFileSyncCalls);

      expect(newExistsSyncCalls).toContainEqual([overrideSecretsPath]);
      expect(newReadFileSyncCalls).toContainEqual([overrideSecretsPath, 'utf8']);

      // Verify it did NOT use os.homedir() path in the new calls
      const defaultPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const callsWithDefaultPath = newExistsSyncCalls.filter(call => call[0] === defaultPath);
      expect(callsWithDefaultPath).toHaveLength(0);

      expect(result).toEqual({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });
    });

    it('should return null when only clientId is missing', async() => {
      const mockSecrets = {
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      const result = await tokenManager.loadClientCredentials('keycloak');

      expect(result).toBeNull();
    });

    it('should return null when only clientSecret is missing', async() => {
      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      const result = await tokenManager.loadClientCredentials('keycloak');

      expect(result).toBeNull();
    });
  });

  describe('getDeviceToken', () => {
    it('should get device token from config for controller', async() => {
      const controllerUrl = 'http://localhost:3010';
      const mockToken = {
        controller: controllerUrl,
        token: 'device-token-123',
        refreshToken: 'refresh-token-456',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      config.getDeviceToken.mockResolvedValue(mockToken);

      const result = await tokenManager.getDeviceToken(controllerUrl);

      expect(result).toEqual(mockToken);
      expect(config.getDeviceToken).toHaveBeenCalledWith(controllerUrl);
    });
  });

  describe('getClientToken', () => {
    it('should get client token from config', async() => {
      const mockToken = {
        controller: 'http://localhost:3010',
        token: 'client-token-456',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      config.getClientToken.mockResolvedValue(mockToken);

      const result = await tokenManager.getClientToken('miso', 'keycloak');

      expect(result).toEqual(mockToken);
      expect(config.getClientToken).toHaveBeenCalledWith('miso', 'keycloak');
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 10).toISOString();
      config.isTokenExpired.mockReturnValue(true);
      expect(tokenManager.isTokenExpired(pastDate)).toBe(true);
      expect(config.isTokenExpired).toHaveBeenCalledWith(pastDate);
    });

    it('should return false for valid token', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();
      config.isTokenExpired.mockReturnValue(false);
      expect(tokenManager.isTokenExpired(futureDate)).toBe(false);
      expect(config.isTokenExpired).toHaveBeenCalledWith(futureDate);
    });

    it('should return true for null expiresAt', () => {
      config.isTokenExpired.mockReturnValue(true);
      expect(tokenManager.isTokenExpired(null)).toBe(true);
      expect(config.isTokenExpired).toHaveBeenCalledWith(null);
    });
  });

  describe('shouldRefreshToken', () => {
    it('should return true when token should be refreshed proactively', () => {
      config.shouldRefreshToken.mockReturnValue(true);
      const expiresIn10Minutes = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      expect(tokenManager.shouldRefreshToken(expiresIn10Minutes)).toBe(true);
      expect(config.shouldRefreshToken).toHaveBeenCalledWith(expiresIn10Minutes);
    });

    it('should return false when token does not need proactive refresh', () => {
      config.shouldRefreshToken.mockReturnValue(false);
      const expiresIn20Minutes = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      expect(tokenManager.shouldRefreshToken(expiresIn20Minutes)).toBe(false);
      expect(config.shouldRefreshToken).toHaveBeenCalledWith(expiresIn20Minutes);
    });

    it('should return true for null expiresAt', () => {
      config.shouldRefreshToken.mockReturnValue(true);
      expect(tokenManager.shouldRefreshToken(null)).toBe(true);
      expect(config.shouldRefreshToken).toHaveBeenCalledWith(null);
    });
  });

  describe('refreshClientToken', () => {
    it('should refresh token using credentials from secrets.local.yaml', async() => {
      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'new-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      config.saveClientToken.mockResolvedValue();

      const result = await tokenManager.refreshClientToken('miso', 'keycloak', 'http://localhost:3010');

      expect(result.token).toBe('new-token-123');
      expect(config.saveClientToken).toHaveBeenCalledWith(
        'miso',
        'keycloak',
        'http://localhost:3010',
        'new-token-123',
        expect.any(String)
      );
    });

    it('should refresh token using provided credentials', async() => {
      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'new-token-456',
          expiresIn: 3600
        }
      });

      config.saveClientToken.mockResolvedValue();

      const result = await tokenManager.refreshClientToken(
        'miso',
        'keycloak',
        'http://localhost:3010',
        'provided-client-id',
        'provided-client-secret'
      );

      expect(result.token).toBe('new-token-456');
      expect(api.makeApiCall).toHaveBeenCalledWith(
        'http://localhost:3010/api/v1/auth/token',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-client-id': 'provided-client-id',
            'x-client-secret': 'provided-client-secret'
          })
        })
      );
    });

    it('should throw error when credentials not found', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await expect(
        tokenManager.refreshClientToken('miso', 'keycloak', 'http://localhost:3010')
      ).rejects.toThrow('Client credentials not found');
    });

    it('should throw error when API call fails', async() => {
      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      api.makeApiCall.mockResolvedValue({
        success: false,
        error: 'Authentication failed'
      });

      await expect(
        tokenManager.refreshClientToken('miso', 'keycloak', 'http://localhost:3010')
      ).rejects.toThrow('Failed to refresh token');
    });

    it('should throw error with Unknown error when API call fails without error message', async() => {
      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      api.makeApiCall.mockResolvedValue({
        success: false
      });

      await expect(
        tokenManager.refreshClientToken('miso', 'keycloak', 'http://localhost:3010')
      ).rejects.toThrow('Failed to refresh token: Unknown error');
    });

    it('should throw error when environment is invalid', async() => {
      await expect(
        tokenManager.refreshClientToken('', 'keycloak', 'http://localhost:3010')
      ).rejects.toThrow('Environment is required');

      await expect(
        tokenManager.refreshClientToken(null, 'keycloak', 'http://localhost:3010')
      ).rejects.toThrow('Environment is required');

      await expect(
        tokenManager.refreshClientToken(undefined, 'keycloak', 'http://localhost:3010')
      ).rejects.toThrow('Environment is required');
    });

    it('should throw error when appName is invalid', async() => {
      await expect(
        tokenManager.refreshClientToken('miso', '', 'http://localhost:3010')
      ).rejects.toThrow('App name is required');

      await expect(
        tokenManager.refreshClientToken('miso', null, 'http://localhost:3010')
      ).rejects.toThrow('App name is required');

      await expect(
        tokenManager.refreshClientToken('miso', undefined, 'http://localhost:3010')
      ).rejects.toThrow('App name is required');
    });

    it('should throw error when controllerUrl is invalid', async() => {
      await expect(
        tokenManager.refreshClientToken('miso', 'keycloak', '')
      ).rejects.toThrow('Controller URL is required');

      await expect(
        tokenManager.refreshClientToken('miso', 'keycloak', null)
      ).rejects.toThrow('Controller URL is required');

      await expect(
        tokenManager.refreshClientToken('miso', 'keycloak', undefined)
      ).rejects.toThrow('Controller URL is required');
    });

    it('should throw error when API response is missing token', async() => {
      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          expiresIn: 3600
        }
      });

      await expect(
        tokenManager.refreshClientToken('miso', 'keycloak', 'http://localhost:3010')
      ).rejects.toThrow('Invalid response: missing token');
    });

    it('should throw error when API response data is null', async() => {
      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: null
      });

      await expect(
        tokenManager.refreshClientToken('miso', 'keycloak', 'http://localhost:3010')
      ).rejects.toThrow('Invalid response: missing token');
    });

    it('should calculate expiration from expiresAt when provided', async() => {
      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      const expectedExpiresAt = new Date(Date.now() + 7200000).toISOString();

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'new-token-with-expiresAt',
          expiresAt: expectedExpiresAt
        }
      });

      config.saveClientToken.mockResolvedValue();

      const result = await tokenManager.refreshClientToken('miso', 'keycloak', 'http://localhost:3010');

      expect(result.token).toBe('new-token-with-expiresAt');
      expect(result.expiresAt).toBe(expectedExpiresAt);
      expect(config.saveClientToken).toHaveBeenCalledWith(
        'miso',
        'keycloak',
        'http://localhost:3010',
        'new-token-with-expiresAt',
        expectedExpiresAt
      );
    });

    it('should calculate expiration from expiresIn when expiresAt not provided', async() => {
      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      const expiresIn = 7200; // 2 hours in seconds
      const beforeCall = Date.now();

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'new-token-with-expiresIn',
          expiresIn: expiresIn
        }
      });

      config.saveClientToken.mockResolvedValue();

      const result = await tokenManager.refreshClientToken('miso', 'keycloak', 'http://localhost:3010');

      const afterCall = Date.now();
      const expectedExpiresAt = new Date(beforeCall + expiresIn * 1000).toISOString();
      const actualExpiresAt = new Date(result.expiresAt);

      expect(result.token).toBe('new-token-with-expiresIn');
      // Allow 1 second tolerance for test execution time
      expect(Math.abs(actualExpiresAt.getTime() - new Date(expectedExpiresAt).getTime())).toBeLessThan(1000);
    });

    it('should use default 24 hours expiration when neither expiresAt nor expiresIn provided', async() => {
      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      const beforeCall = Date.now();
      const defaultExpiresIn = 86400; // 24 hours in seconds

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'new-token-default-expiration'
        }
      });

      config.saveClientToken.mockResolvedValue();

      const result = await tokenManager.refreshClientToken('miso', 'keycloak', 'http://localhost:3010');

      const afterCall = Date.now();
      const expectedExpiresAt = new Date(beforeCall + defaultExpiresIn * 1000).toISOString();
      const actualExpiresAt = new Date(result.expiresAt);

      expect(result.token).toBe('new-token-default-expiration');
      // Allow 1 second tolerance for test execution time
      expect(Math.abs(actualExpiresAt.getTime() - new Date(expectedExpiresAt).getTime())).toBeLessThan(1000);
    });
  });

  describe('getOrRefreshClientToken', () => {
    it('should return existing token if valid', async() => {
      const mockToken = {
        controller: 'http://localhost:3010',
        token: 'valid-token-123',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      config.getClientToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(false);

      const result = await tokenManager.getOrRefreshClientToken('miso', 'keycloak', 'http://localhost:3010');

      expect(result.token).toBe('valid-token-123');
      expect(result.controller).toBe('http://localhost:3010');
    });

    it('should refresh token if expired', async() => {
      const mockToken = {
        controller: 'http://localhost:3010',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };

      config.getClientToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(true);

      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'new-token-789',
          expiresIn: 3600
        }
      });

      config.saveClientToken.mockResolvedValue();

      const result = await tokenManager.getOrRefreshClientToken('miso', 'keycloak', 'http://localhost:3010');

      expect(result.token).toBe('new-token-789');
    });

    it('should refresh token if missing', async() => {
      config.getClientToken.mockResolvedValue(null);

      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'new-token-999',
          expiresIn: 3600
        }
      });

      config.saveClientToken.mockResolvedValue();

      const result = await tokenManager.getOrRefreshClientToken('miso', 'keycloak', 'http://localhost:3010');

      expect(result.token).toBe('new-token-999');
      expect(result.controller).toBe('http://localhost:3010');
    });

    it('should refresh token if controller URL does not match', async() => {
      const mockToken = {
        controller: 'http://different-controller:3010',
        token: 'valid-token-wrong-controller',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      config.getClientToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(false);

      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'new-token-controller-mismatch',
          expiresIn: 3600
        }
      });

      config.saveClientToken.mockResolvedValue();

      const result = await tokenManager.getOrRefreshClientToken('miso', 'keycloak', 'http://localhost:3010');

      expect(result.token).toBe('new-token-controller-mismatch');
      expect(result.controller).toBe('http://localhost:3010');
    });

    it('should refresh token if controller URL matches but token is expired', async() => {
      const mockToken = {
        controller: 'http://localhost:3010',
        token: 'expired-token-same-controller',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };

      config.getClientToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(true);

      const mockSecrets = {
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'new-token-expired-same-controller',
          expiresIn: 3600
        }
      });

      config.saveClientToken.mockResolvedValue();

      const result = await tokenManager.getOrRefreshClientToken('miso', 'keycloak', 'http://localhost:3010');

      expect(result.token).toBe('new-token-expired-same-controller');
      expect(result.controller).toBe('http://localhost:3010');
    });
  });

  describe('refreshDeviceToken', () => {
    const controllerUrl = 'http://localhost:3010';
    const refreshToken = 'refresh-token-123';

    beforeEach(() => {
      config.saveDeviceToken.mockResolvedValue();
    });

    it('should refresh device token using refresh token', async() => {
      api.refreshDeviceToken.mockResolvedValue({
        access_token: 'new-access-token-789',
        refresh_token: 'new-refresh-token-456',
        expires_in: 3600
      });

      const result = await tokenManager.refreshDeviceToken(controllerUrl, refreshToken);

      expect(result.token).toBe('new-access-token-789');
      expect(result.refreshToken).toBe('new-refresh-token-456');
      expect(result.expiresAt).toBeDefined();
      expect(api.refreshDeviceToken).toHaveBeenCalledWith(controllerUrl, refreshToken);
      expect(config.saveDeviceToken).toHaveBeenCalledWith(
        controllerUrl,
        'new-access-token-789',
        'new-refresh-token-456',
        expect.any(String)
      );
    });

    it('should use old refresh token if new one not provided', async() => {
      api.refreshDeviceToken.mockResolvedValue({
        access_token: 'new-access-token-789',
        expires_in: 3600
        // No refresh_token in response
      });

      const result = await tokenManager.refreshDeviceToken(controllerUrl, refreshToken);

      expect(result.token).toBe('new-access-token-789');
      expect(result.refreshToken).toBe(refreshToken); // Should keep old refresh token
      expect(config.saveDeviceToken).toHaveBeenCalledWith(
        controllerUrl,
        'new-access-token-789',
        refreshToken,
        expect.any(String)
      );
    });

    it('should throw error when controller URL is missing', async() => {
      await expect(
        tokenManager.refreshDeviceToken(null, refreshToken)
      ).rejects.toThrow('Controller URL is required');
    });

    it('should throw error when refresh token is missing', async() => {
      await expect(
        tokenManager.refreshDeviceToken(controllerUrl, null)
      ).rejects.toThrow('Refresh token is required');
    });

    it('should throw error when API refresh fails', async() => {
      api.refreshDeviceToken.mockRejectedValue(new Error('Refresh failed'));

      await expect(
        tokenManager.refreshDeviceToken(controllerUrl, refreshToken)
      ).rejects.toThrow('Refresh failed');
    });

    it('should throw user-friendly error when refresh token is expired', async() => {
      api.refreshDeviceToken.mockRejectedValue(new Error('Refresh token has expired'));

      await expect(
        tokenManager.refreshDeviceToken(controllerUrl, refreshToken)
      ).rejects.toThrow('Refresh token has expired. Please login again using: aifabrix login');
    });

    it('should throw user-friendly error when refresh token is invalid', async() => {
      api.refreshDeviceToken.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(
        tokenManager.refreshDeviceToken(controllerUrl, refreshToken)
      ).rejects.toThrow('Refresh token has expired. Please login again using: aifabrix login');
    });

    it('should throw user-friendly error on 401 Unauthorized', async() => {
      api.refreshDeviceToken.mockRejectedValue(new Error('Unauthorized: 401'));

      await expect(
        tokenManager.refreshDeviceToken(controllerUrl, refreshToken)
      ).rejects.toThrow('Refresh token has expired. Please login again using: aifabrix login');
    });
  });

  describe('getOrRefreshDeviceToken', () => {
    const controllerUrl = 'http://localhost:3010';

    it('should return existing token if valid', async() => {
      const mockToken = {
        controller: controllerUrl,
        token: 'valid-device-token-123',
        refreshToken: 'refresh-token-456',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      config.getDeviceToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(false);
      config.shouldRefreshToken.mockReturnValue(false);

      const result = await tokenManager.getOrRefreshDeviceToken(controllerUrl);

      expect(result.token).toBe('valid-device-token-123');
      expect(result.controller).toBe(controllerUrl);
    });

    it('should return null when token does not exist', async() => {
      config.getDeviceToken.mockResolvedValue(null);

      const result = await tokenManager.getOrRefreshDeviceToken(controllerUrl);

      expect(result).toBeNull();
    });

    it('should refresh token if expired and refresh token exists', async() => {
      const mockToken = {
        controller: controllerUrl,
        token: 'expired-device-token',
        refreshToken: 'refresh-token-456',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };

      config.getDeviceToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(true);
      config.shouldRefreshToken.mockReturnValue(true);

      api.refreshDeviceToken.mockResolvedValue({
        access_token: 'new-device-token-789',
        refresh_token: 'new-refresh-token-999',
        expires_in: 3600
      });

      config.saveDeviceToken.mockResolvedValue();

      const result = await tokenManager.getOrRefreshDeviceToken(controllerUrl);

      expect(result.token).toBe('new-device-token-789');
      expect(result.controller).toBe(controllerUrl);
      expect(api.refreshDeviceToken).toHaveBeenCalledWith(controllerUrl, 'refresh-token-456');
    });

    it('should proactively refresh token when within 15 minutes of expiry', async() => {
      // Token expires in 10 minutes (within 15-minute proactive refresh window)
      const expiresIn10Minutes = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const mockToken = {
        controller: controllerUrl,
        token: 'device-token-123',
        refreshToken: 'refresh-token-456',
        expiresAt: expiresIn10Minutes
      };

      config.getDeviceToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(false); // Not expired yet
      config.shouldRefreshToken.mockReturnValue(true); // But should refresh proactively

      api.refreshDeviceToken.mockResolvedValue({
        access_token: 'new-device-token-789',
        refresh_token: 'new-refresh-token-999',
        expires_in: 3600
      });

      config.saveDeviceToken.mockResolvedValue();

      const result = await tokenManager.getOrRefreshDeviceToken(controllerUrl);

      expect(result.token).toBe('new-device-token-789');
      expect(result.controller).toBe(controllerUrl);
      expect(api.refreshDeviceToken).toHaveBeenCalledWith(controllerUrl, 'refresh-token-456');
      expect(config.shouldRefreshToken).toHaveBeenCalledWith(expiresIn10Minutes);
    });

    it('should return null when token expired but no refresh token', async() => {
      const mockToken = {
        controller: controllerUrl,
        token: 'expired-device-token',
        expiresAt: new Date(Date.now() - 1000).toISOString()
        // No refreshToken
      };

      config.getDeviceToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(true);
      config.shouldRefreshToken.mockReturnValue(true);

      const logger = require('../../../lib/utils/logger');
      logger.warn.mockImplementation(() => {});

      const result = await tokenManager.getOrRefreshDeviceToken(controllerUrl);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('no refresh token available'));
    });

    it('should return null when refresh fails', async() => {
      const mockToken = {
        controller: controllerUrl,
        token: 'expired-device-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };

      config.getDeviceToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(true);
      config.shouldRefreshToken.mockReturnValue(true);

      api.refreshDeviceToken.mockRejectedValue(new Error('Refresh failed'));

      const logger = require('../../../lib/utils/logger');
      logger.warn.mockImplementation(() => {});

      const result = await tokenManager.getOrRefreshDeviceToken(controllerUrl);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to refresh device token'));
    });

    it('should handle refresh token expiry with user-friendly error', async() => {
      const mockToken = {
        controller: controllerUrl,
        token: 'expired-device-token',
        refreshToken: 'expired-refresh-token',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };

      config.getDeviceToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(true);
      config.shouldRefreshToken.mockReturnValue(true);

      // Simulate refresh token expiry error
      api.refreshDeviceToken.mockRejectedValue(new Error('Refresh token has expired'));

      const logger = require('../../../lib/utils/logger');
      logger.warn.mockImplementation(() => {});

      const result = await tokenManager.getOrRefreshDeviceToken(controllerUrl);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Refresh token expired'));
    });

    it('should handle 401 Unauthorized error as refresh token expiry', async() => {
      const mockToken = {
        controller: controllerUrl,
        token: 'expired-device-token',
        refreshToken: 'expired-refresh-token',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };

      config.getDeviceToken.mockResolvedValue(mockToken);
      config.isTokenExpired.mockReturnValue(true);
      config.shouldRefreshToken.mockReturnValue(true);

      // Simulate 401 error (refresh token expired)
      api.refreshDeviceToken.mockRejectedValue(new Error('Unauthorized: 401'));

      const logger = require('../../../lib/utils/logger');
      logger.warn.mockImplementation(() => {});

      const result = await tokenManager.getOrRefreshDeviceToken(controllerUrl);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('getDeploymentAuth', () => {
    const controllerUrl = 'http://localhost:3010';
    const environment = 'miso';
    const appName = 'keycloak';
    let getOrRefreshDeviceTokenSpy;
    let getOrRefreshClientTokenSpy;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      // Restore spies after each test if they exist
      if (getOrRefreshDeviceTokenSpy) {
        getOrRefreshDeviceTokenSpy.mockRestore();
      }
      if (getOrRefreshClientTokenSpy) {
        getOrRefreshClientTokenSpy.mockRestore();
      }
    });

    it('should return device token when available (Priority 1)', async() => {
      const mockDeviceToken = {
        token: 'device-token-123',
        controller: controllerUrl,
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      // Mock the underlying config functions that getOrRefreshDeviceToken uses
      config.getDeviceToken.mockResolvedValue(mockDeviceToken);
      config.isTokenExpired.mockReturnValue(false);
      config.shouldRefreshToken.mockReturnValue(false); // Token doesn't need proactive refresh

      const result = await tokenManager.getDeploymentAuth(controllerUrl, environment, appName);

      expect(result.type).toBe('bearer');
      expect(result.token).toBe('device-token-123');
      expect(result.controller).toBe(controllerUrl);
    });

    it('should return client token when device token unavailable (Priority 2)', async() => {
      // Mock device token as unavailable
      config.getDeviceToken.mockResolvedValue(null);

      const mockClientToken = {
        token: 'client-token-456',
        controller: controllerUrl,
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      // Mock the underlying config functions that getOrRefreshClientToken uses
      config.getClientToken.mockResolvedValue(mockClientToken);
      config.isTokenExpired.mockReturnValue(false);

      const result = await tokenManager.getDeploymentAuth(controllerUrl, environment, appName);

      expect(result.type).toBe('bearer');
      expect(result.token).toBe('client-token-456');
      expect(result.controller).toBe(controllerUrl);
    });

    it('should return client credentials when device and client tokens unavailable (Priority 3)', async() => {
      // Mock device token as unavailable
      config.getDeviceToken.mockResolvedValue(null);
      // Mock client token as unavailable - this will cause getOrRefreshClientToken to try to refresh
      config.getClientToken.mockResolvedValue(null);
      // Mock refreshClientToken to fail (no credentials available for refresh)
      // This will cause getOrRefreshClientToken to throw, which getDeploymentAuth catches
      // and then falls back to loading credentials directly
      api.makeApiCall.mockRejectedValue(new Error('Credentials not found'));

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump({
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      }));

      const logger = require('../../../lib/utils/logger');
      logger.warn.mockImplementation(() => {});

      const result = await tokenManager.getDeploymentAuth(controllerUrl, environment, appName);

      expect(result.type).toBe('client-credentials');
      expect(result.clientId).toBe('test-client-id');
      expect(result.clientSecret).toBe('test-client-secret');
      expect(result.controller).toBe(controllerUrl);
    });

    it('should throw error when no authentication method available', async() => {
      // Mock device token as unavailable
      config.getDeviceToken.mockResolvedValue(null);
      // Mock client token as unavailable
      config.getClientToken.mockResolvedValue(null);
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await expect(
        tokenManager.getDeploymentAuth(controllerUrl, environment, appName)
      ).rejects.toThrow('No authentication method available');
    });

    it('should handle client token error and fallback to credentials', async() => {
      // Mock device token as unavailable
      config.getDeviceToken.mockResolvedValue(null);
      // Mock client token to throw error
      config.getClientToken.mockRejectedValue(new Error('Client token failed'));

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump({
        'keycloak-client-idKeyVault': 'test-client-id',
        'keycloak-client-secretKeyVault': 'test-client-secret'
      }));

      const logger = require('../../../lib/utils/logger');
      logger.warn.mockImplementation(() => {});

      const result = await tokenManager.getDeploymentAuth(controllerUrl, environment, appName);

      expect(result.type).toBe('client-credentials');
      expect(result.clientId).toBe('test-client-id');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Client token unavailable'));
    });

    it('should throw error when controllerUrl is invalid', async() => {
      await expect(
        tokenManager.getDeploymentAuth('', environment, appName)
      ).rejects.toThrow('Controller URL is required');

      await expect(
        tokenManager.getDeploymentAuth(null, environment, appName)
      ).rejects.toThrow('Controller URL is required');
    });

    it('should throw error when environment is invalid', async() => {
      await expect(
        tokenManager.getDeploymentAuth(controllerUrl, '', appName)
      ).rejects.toThrow('Environment is required');
    });

    it('should throw error when appName is invalid', async() => {
      await expect(
        tokenManager.getDeploymentAuth(controllerUrl, environment, '')
      ).rejects.toThrow('App name is required');
    });
  });

  describe('extractClientCredentials', () => {
    const appKey = 'keycloak';
    const envKey = 'miso';

    it('should return credentials when type is client-credentials and both provided', async() => {
      const authConfig = {
        type: 'client-credentials',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        controller: 'http://localhost:3010'
      };

      const result = await tokenManager.extractClientCredentials(authConfig, appKey, envKey);

      expect(result.clientId).toBe('test-client-id');
      expect(result.clientSecret).toBe('test-client-secret');
    });

    it('should throw error when client-credentials type but clientId missing', async() => {
      const authConfig = {
        type: 'client-credentials',
        clientSecret: 'test-client-secret',
        controller: 'http://localhost:3010'
      };

      await expect(
        tokenManager.extractClientCredentials(authConfig, appKey, envKey)
      ).rejects.toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when client-credentials type but clientSecret missing', async() => {
      const authConfig = {
        type: 'client-credentials',
        clientId: 'test-client-id',
        controller: 'http://localhost:3010'
      };

      await expect(
        tokenManager.extractClientCredentials(authConfig, appKey, envKey)
      ).rejects.toThrow('Client ID and Client Secret are required');
    });

    it('should return credentials from authConfig when bearer type and both provided', async() => {
      const authConfig = {
        type: 'bearer',
        token: 'bearer-token-123',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        controller: 'http://localhost:3010'
      };

      const result = await tokenManager.extractClientCredentials(authConfig, appKey, envKey);

      expect(result.clientId).toBe('test-client-id');
      expect(result.clientSecret).toBe('test-client-secret');
    });

    it('should load credentials from secrets when bearer type and not in authConfig', async() => {
      const authConfig = {
        type: 'bearer',
        token: 'bearer-token-123',
        controller: 'http://localhost:3010'
      };

      const mockSecrets = {
        'keycloak-client-idKeyVault': 'loaded-client-id',
        'keycloak-client-secretKeyVault': 'loaded-client-secret'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(yaml.dump(mockSecrets));

      const result = await tokenManager.extractClientCredentials(authConfig, appKey, envKey);

      expect(result.clientId).toBe('loaded-client-id');
      expect(result.clientSecret).toBe('loaded-client-secret');
      // Should store in authConfig
      expect(authConfig.clientId).toBe('loaded-client-id');
      expect(authConfig.clientSecret).toBe('loaded-client-secret');
    });

    it('should throw error when bearer type and credentials not found in secrets', async() => {
      const authConfig = {
        type: 'bearer',
        token: 'bearer-token-123',
        controller: 'http://localhost:3010'
      };

      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await expect(
        tokenManager.extractClientCredentials(authConfig, appKey, envKey)
      ).rejects.toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when invalid authentication type', async() => {
      const authConfig = {
        type: 'invalid',
        controller: 'http://localhost:3010'
      };

      await expect(
        tokenManager.extractClientCredentials(authConfig, appKey, envKey)
      ).rejects.toThrow('Invalid authentication type');
    });
  });

  describe('getDeviceOnlyAuth', () => {
    const controllerUrl = 'http://localhost:3010';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return bearer auth config when device token is available', async() => {
      // Mock getDeviceToken to return valid token info
      config.getDeviceToken.mockResolvedValue({
        token: 'device-token-123',
        refreshToken: 'refresh-token-123',
        controller: controllerUrl,
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      });
      // Mock shouldRefreshToken to return false (token is still valid)
      config.shouldRefreshToken.mockReturnValue(false);

      const result = await tokenManager.getDeviceOnlyAuth(controllerUrl);

      expect(result).toEqual({
        type: 'bearer',
        token: 'device-token-123',
        controller: controllerUrl
      });
    });

    it('should throw error when device token is not available', async() => {
      config.getDeviceToken.mockResolvedValue(null);

      await expect(
        tokenManager.getDeviceOnlyAuth(controllerUrl)
      ).rejects.toThrow('Device token authentication required. Run "aifabrix login" to authenticate.');
    });

    it('should throw error when getOrRefreshDeviceToken returns null', async() => {
      // Token exists but refresh is needed and fails (returns null)
      config.getDeviceToken.mockResolvedValue({
        token: 'old-token',
        controller: controllerUrl,
        expiresAt: new Date(Date.now() - 1000).toISOString() // Expired
      });
      config.shouldRefreshToken.mockReturnValue(true);

      await expect(
        tokenManager.getDeviceOnlyAuth(controllerUrl)
      ).rejects.toThrow('Device token authentication required. Run "aifabrix login" to authenticate.');
    });
  });
});

