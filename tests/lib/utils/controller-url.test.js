/**
 * Tests for Controller URL Utility
 *
 * @fileoverview Unit tests for utils/controller-url.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getDefaultControllerUrl, getControllerUrlFromLoggedInUser, resolveControllerUrl, getControllerFromConfig } = require('../../../lib/utils/controller-url');
const envMap = require('../../../lib/utils/env-map');
const devConfig = require('../../../lib/utils/dev-config');
const config = require('../../../lib/core/config');

// Mock modules
jest.mock('../../../lib/utils/env-map');
jest.mock('../../../lib/utils/dev-config');
jest.mock('../../../lib/core/config');

describe('Controller URL Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    it('should handle config read errors gracefully', async() => {
      config.getConfig.mockRejectedValue(new Error('Config file not found'));

      const url = await getControllerUrlFromLoggedInUser();

      expect(url).toBeNull();
    });
  });
});
