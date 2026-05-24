/**
 * Tests for Controller URL Utility
 *
 * @fileoverview Unit tests for utils/controller-url.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  getDefaultControllerUrl,
  getControllerUrlFromLoggedInUser,
  hasStoredDeviceTokenForController,
  isDeviceTokenUsableForController,
  isPlatformAuthValidForController,
  isControllerHealthReachable,
  resolveControllerUrl,
  getControllerFromConfig
} = require('../../../lib/utils/controller-url');
const authApi = require('../../../lib/api/auth.api');
const envMap = require('../../../lib/utils/env-map');
const devConfig = require('../../../lib/utils/dev-config');
const config = require('../../../lib/core/config');
const tokenManager = require('../../../lib/utils/token-manager');

// Mock modules
jest.mock('../../../lib/utils/env-map');
jest.mock('../../../lib/utils/dev-config');
jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeviceToken: jest.fn(),
  isTokenExpired: jest.fn(),
  getOrRefreshDeviceToken: jest.fn()
}));
jest.mock('../../../lib/api/auth.api', () => ({
  getAuthUser: jest.fn()
}));

const originalFetch = global.fetch;

describe('Controller URL Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('getDefaultControllerUrl', () => {
    it('should use port 3000 for developer ID 0', async() => {
      envMap.getDeveloperIdNumber.mockResolvedValue(0);
      devConfig.getDevPorts.mockReturnValue({ app: 3000 });

      const url = await getDefaultControllerUrl();

      expect(url).toBe('http://localhost:3000');
      expect(envMap.getDeveloperIdNumber).toHaveBeenCalledWith(null);
      expect(devConfig.getDevPorts).toHaveBeenCalledWith(0);
    });

    it('should use port 3100 for developer ID 1', async() => {
      envMap.getDeveloperIdNumber.mockResolvedValue(1);
      devConfig.getDevPorts.mockReturnValue({ app: 3100 });

      const url = await getDefaultControllerUrl();

      expect(url).toBe('http://localhost:3100');
      expect(envMap.getDeveloperIdNumber).toHaveBeenCalledWith(null);
      expect(devConfig.getDevPorts).toHaveBeenCalledWith(1);
    });

    it('should use port 3200 for developer ID 2', async() => {
      envMap.getDeveloperIdNumber.mockResolvedValue(2);
      devConfig.getDevPorts.mockReturnValue({ app: 3200 });

      const url = await getDefaultControllerUrl();

      expect(url).toBe('http://localhost:3200');
      expect(envMap.getDeveloperIdNumber).toHaveBeenCalledWith(null);
      expect(devConfig.getDevPorts).toHaveBeenCalledWith(2);
    });
  });

  describe('getControllerFromConfig', () => {
    it('should return controller URL from config', async() => {
      config.getControllerUrl = jest.fn().mockResolvedValue('https://config.controller.com');

      const url = await getControllerFromConfig();

      expect(url).toBe('https://config.controller.com');
      expect(config.getControllerUrl).toHaveBeenCalled();
    });

    it('should return null if controller URL not in config', async() => {
      config.getControllerUrl = jest.fn().mockResolvedValue(null);

      const url = await getControllerFromConfig();

      expect(url).toBeNull();
    });
  });

  describe('resolveControllerUrl', () => {
    it('should return controller URL from config (priority 1)', async() => {
      config.getControllerUrl = jest.fn().mockResolvedValue('https://config.controller.com');

      const url = await resolveControllerUrl();

      expect(url).toBe('https://config.controller.com');
      expect(config.getControllerUrl).toHaveBeenCalled();
    });

    it('should return logged-in user controller URL (priority 2) when config not set', async() => {
      config.getControllerUrl = jest.fn().mockResolvedValue(null);
      config.getConfig.mockResolvedValue({
        device: {
          'https://logged-in.controller.com': {
            token: 'encrypted-token',
            refreshToken: 'refresh-token',
            expiresAt: '2024-12-31T23:59:59.000Z'
          }
        }
      });

      const url = await resolveControllerUrl();

      expect(url).toBe('https://logged-in.controller.com');
    });

    it('should return developer ID-based default (priority 3) when no config or logged-in user', async() => {
      config.getControllerUrl = jest.fn().mockResolvedValue(null);
      config.getConfig.mockResolvedValue({ device: {} });
      envMap.getDeveloperIdNumber.mockResolvedValue(1);
      devConfig.getDevPorts.mockReturnValue({ app: 3100 });

      const url = await resolveControllerUrl();

      expect(url).toBe('http://localhost:3100');
      expect(envMap.getDeveloperIdNumber).toHaveBeenCalledWith(null);
      expect(devConfig.getDevPorts).toHaveBeenCalledWith(1);
    });

    it('should fall back to default when multiple device entries and no config.controller match', async() => {
      config.getControllerUrl = jest.fn().mockResolvedValue(null);
      config.getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': { token: 'a' },
          'http://localhost:3100': { token: 'b' }
        }
      });
      envMap.getDeveloperIdNumber.mockResolvedValue(0);
      devConfig.getDevPorts.mockReturnValue({ app: 3000 });

      const url = await resolveControllerUrl();

      expect(url).toBe('http://localhost:3000');
    });

    it('should remove trailing slashes from config URL', async() => {
      config.getControllerUrl = jest.fn().mockResolvedValue('https://config.controller.com/');

      const url = await resolveControllerUrl();

      expect(url).toBe('https://config.controller.com');
    });
  });

  describe('getControllerUrlFromLoggedInUser', () => {
    it('should return controller URL from logged-in device tokens', async() => {
      config.getConfig.mockResolvedValue({
        device: {
          'https://logged-in.controller.com': {
            token: 'encrypted-token',
            refreshToken: 'refresh-token',
            expiresAt: '2024-12-31T23:59:59.000Z'
          }
        }
      });

      const url = await getControllerUrlFromLoggedInUser();

      expect(url).toBe('https://logged-in.controller.com');
    });

    it('should return null when no device tokens exist', async() => {
      config.getConfig.mockResolvedValue({ device: {} });

      const url = await getControllerUrlFromLoggedInUser();

      expect(url).toBeNull();
    });

    it('should return null when device config is missing', async() => {
      config.getConfig.mockResolvedValue({});

      const url = await getControllerUrlFromLoggedInUser();

      expect(url).toBeNull();
    });

    it('should normalize controller URL', async() => {
      config.getConfig.mockResolvedValue({
        device: {
          'https://logged-in.controller.com/': {
            token: 'encrypted-token',
            refreshToken: 'refresh-token',
            expiresAt: '2024-12-31T23:59:59.000Z'
          }
        }
      });

      const url = await getControllerUrlFromLoggedInUser();

      expect(url).toBe('https://logged-in.controller.com');
    });

    it('should prefer device key matching config.controller when multiple tokens exist', async() => {
      config.getConfig.mockResolvedValue({
        controller: 'http://localhost:3610',
        device: {
          'http://localhost:3600': { token: 'a', expiresAt: '2099-01-01T00:00:00.000Z' },
          'http://localhost:3610': { token: 'b', expiresAt: '2099-01-01T00:00:00.000Z' }
        }
      });

      const url = await getControllerUrlFromLoggedInUser();

      expect(url).toBe('http://localhost:3610');
    });

    it('should return null when multiple device entries and no config.controller device match', async() => {
      config.getConfig.mockResolvedValue({
        controller: 'http://localhost:9999',
        device: {
          'http://localhost:3600': { token: 'a' },
          'http://localhost:3610': { token: 'b' }
        }
      });

      const url = await getControllerUrlFromLoggedInUser();

      expect(url).toBeNull();
    });

    it('should handle config read errors gracefully', async() => {
      config.getConfig.mockRejectedValue(new Error('Config file not found'));

      const url = await getControllerUrlFromLoggedInUser();

      expect(url).toBeNull();
    });
  });

  describe('hasStoredDeviceTokenForController', () => {
    it('should return true when a device key matches (normalized)', async() => {
      config.getConfig.mockResolvedValue({
        device: {
          'https://controller.example.com/': { token: 'x' }
        }
      });
      await expect(hasStoredDeviceTokenForController('https://controller.example.com')).resolves.toBe(true);
    });

    it('should return false when no device entry matches', async() => {
      config.getConfig.mockResolvedValue({
        device: {
          'https://other.example.com': { token: 'x' }
        }
      });
      await expect(hasStoredDeviceTokenForController('https://controller.example.com')).resolves.toBe(false);
    });
  });

  describe('isDeviceTokenUsableForController', () => {
    it('returns false when no stored device entry', async() => {
      config.getConfig.mockResolvedValue({ device: {} });
      await expect(isDeviceTokenUsableForController('http://localhost:3600')).resolves.toBe(false);
      expect(tokenManager.getDeviceToken).not.toHaveBeenCalled();
    });

    it('returns true when stored token is not expired', async() => {
      config.getConfig.mockResolvedValue({
        device: { 'http://localhost:3600': { token: 'x' } }
      });
      tokenManager.getDeviceToken.mockResolvedValue({
        token: 'fresh',
        controller: 'http://localhost:3600'
      });
      tokenManager.isTokenExpired.mockReturnValue(false);
      await expect(isDeviceTokenUsableForController('http://localhost:3600/')).resolves.toBe(true);
      expect(tokenManager.getDeviceToken).toHaveBeenCalled();
    });

    it('returns false when stored token is expired', async() => {
      config.getConfig.mockResolvedValue({
        device: { 'http://localhost:3600': { token: 'stale' } }
      });
      tokenManager.getDeviceToken.mockResolvedValue({
        token: 'stale',
        controller: 'http://localhost:3600'
      });
      tokenManager.isTokenExpired.mockReturnValue(true);
      await expect(isDeviceTokenUsableForController('http://localhost:3600')).resolves.toBe(false);
    });
  });

  describe('isPlatformAuthValidForController', () => {
    it('returns false when no stored device entry', async() => {
      config.getConfig.mockResolvedValue({ device: {} });
      await expect(isPlatformAuthValidForController('http://localhost:3600')).resolves.toBe(false);
      expect(tokenManager.getOrRefreshDeviceToken).not.toHaveBeenCalled();
    });

    it('returns true when refresh succeeds and controller validates token', async() => {
      config.getConfig.mockResolvedValue({
        device: { 'http://localhost:3600': { token: 'enc' } }
      });
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'fresh-access',
        controller: 'http://localhost:3600'
      });
      authApi.getAuthUser.mockResolvedValue({ success: true, data: { authenticated: true } });
      await expect(isPlatformAuthValidForController('http://localhost:3600')).resolves.toBe(true);
      expect(authApi.getAuthUser).toHaveBeenCalledWith('http://localhost:3600', {
        type: 'bearer',
        token: 'fresh-access'
      });
    });

    it('uses local expiry check when controller health is unreachable', async() => {
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));
      config.getConfig.mockResolvedValue({
        device: { 'http://localhost:3600': { token: 'enc' } }
      });
      tokenManager.getDeviceToken.mockResolvedValue({
        token: 'still-valid',
        expiresAt: '2099-01-01T00:00:00.000Z'
      });
      tokenManager.isTokenExpired.mockReturnValue(false);
      await expect(isPlatformAuthValidForController('http://localhost:3600')).resolves.toBe(true);
      expect(tokenManager.getOrRefreshDeviceToken).not.toHaveBeenCalled();
      expect(authApi.getAuthUser).not.toHaveBeenCalled();
    });
  });
});
