/**
 * Tests for Controller URL Utility
 *
 * @fileoverview Unit tests for utils/controller-url.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getDefaultControllerUrl, resolveControllerUrl } = require('../../../lib/utils/controller-url');
const envMap = require('../../../lib/utils/env-map');
const devConfig = require('../../../lib/utils/dev-config');

// Mock modules
jest.mock('../../../lib/utils/env-map');
jest.mock('../../../lib/utils/dev-config');

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

  describe('resolveControllerUrl', () => {
    it('should return explicit controller option (priority 1)', async() => {
      const options = { controller: 'https://custom.controller.com' };
      const config = { deployment: { controllerUrl: 'https://config.controller.com' } };

      const url = await resolveControllerUrl(options, config);

      expect(url).toBe('https://custom.controller.com');
      expect(envMap.getDeveloperIdNumber).not.toHaveBeenCalled();
    });

    it('should return config controller URL (priority 2)', async() => {
      const options = {};
      const config = { deployment: { controllerUrl: 'https://config.controller.com' } };

      const url = await resolveControllerUrl(options, config);

      expect(url).toBe('https://config.controller.com');
      expect(envMap.getDeveloperIdNumber).not.toHaveBeenCalled();
    });

    it('should return developer ID-based default (priority 3)', async() => {
      const options = {};
      const config = {};

      envMap.getDeveloperIdNumber.mockResolvedValue(1);
      devConfig.getDevPorts.mockReturnValue({ app: 3100 });

      const url = await resolveControllerUrl(options, config);

      expect(url).toBe('http://localhost:3100');
      expect(envMap.getDeveloperIdNumber).toHaveBeenCalledWith(null);
      expect(devConfig.getDevPorts).toHaveBeenCalledWith(1);
    });

    it('should remove trailing slashes from explicit option', async() => {
      const options = { controller: 'https://custom.controller.com/' };
      const config = {};

      const url = await resolveControllerUrl(options, config);

      expect(url).toBe('https://custom.controller.com');
    });

    it('should remove trailing slashes from config URL', async() => {
      const options = {};
      const config = { deployment: { controllerUrl: 'https://config.controller.com/' } };

      const url = await resolveControllerUrl(options, config);

      expect(url).toBe('https://config.controller.com');
    });

    it('should handle null options', async() => {
      const config = { deployment: { controllerUrl: 'https://config.controller.com' } };

      const url = await resolveControllerUrl(null, config);

      expect(url).toBe('https://config.controller.com');
    });

    it('should handle undefined config', async() => {
      const options = {};

      envMap.getDeveloperIdNumber.mockResolvedValue(0);
      devConfig.getDevPorts.mockReturnValue({ app: 3000 });

      const url = await resolveControllerUrl(options, undefined);

      expect(url).toBe('http://localhost:3000');
    });
  });
});
