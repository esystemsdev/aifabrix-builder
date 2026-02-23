/**
 * Unit tests for push module (lib/app/push.js)
 * Verifies image name is taken from application.yaml image.name so ACR repository matches config.
 *
 * @fileoverview Tests for push image name and variables wrapper
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const pushModule = require('../../../lib/app/push');

jest.mock('../../../lib/utils/paths', () => ({
  detectAppType: jest.fn(),
  resolveApplicationConfigPath: jest.fn()
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn()
}));
jest.mock('../../../lib/deployment/push', () => ({
  validateRegistryURL: jest.fn(() => true),
  checkLocalImageExists: jest.fn(),
  checkAzureCLIInstalled: jest.fn(() => true),
  checkAzureLogin: jest.fn(() => true),
  checkACRAuthentication: jest.fn(() => true),
  authenticateACR: jest.fn(),
  tagImage: jest.fn().mockResolvedValue(),
  pushImage: jest.fn().mockResolvedValue()
}));

const paths = require('../../../lib/utils/paths');
const configFormat = require('../../../lib/utils/config-format');
const pushUtils = require('../../../lib/deployment/push');

describe('lib/app/push', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('pushApp - image name from application.yaml', () => {
    it('should use image.name from config so ACR repository is aifabrix/dataplane not dataplane', async() => {
      const appName = 'dataplane';
      const appPath = path.join('/builder', appName);
      const configPath = path.join(appPath, 'application.yaml');
      const registry = 'aifabrixdevacr.azurecr.io';
      const imageName = 'aifabrix/dataplane';
      const config = {
        app: { key: appName },
        image: { name: imageName, registry }
      };

      paths.detectAppType.mockResolvedValue({ appPath, appType: 'regular', baseDir: 'builder', isExternal: false });
      paths.resolveApplicationConfigPath.mockReturnValue(configPath);
      configFormat.loadConfigFile.mockReturnValue(config);
      pushUtils.checkLocalImageExists.mockResolvedValue(true);

      await pushModule.pushApp(appName, { registry, tag: 'v1.0.0,latest' });

      expect(pushUtils.checkLocalImageExists).toHaveBeenCalledWith(imageName, 'latest');
      expect(pushUtils.tagImage).toHaveBeenCalledWith(
        'aifabrix/dataplane:latest',
        'aifabrixdevacr.azurecr.io/aifabrix/dataplane:v1.0.0'
      );
      expect(pushUtils.tagImage).toHaveBeenCalledWith(
        'aifabrix/dataplane:latest',
        'aifabrixdevacr.azurecr.io/aifabrix/dataplane:latest'
      );
      expect(pushUtils.pushImage).toHaveBeenCalledWith(
        'aifabrixdevacr.azurecr.io/aifabrix/dataplane:v1.0.0',
        registry
      );
      expect(pushUtils.pushImage).toHaveBeenCalledWith(
        'aifabrixdevacr.azurecr.io/aifabrix/dataplane:latest',
        registry
      );
    });

    it('should support variables wrapper (config.variables.image) for image name and registry', async() => {
      const appName = 'dataplane';
      const appPath = path.join('/builder', appName);
      const configPath = path.join(appPath, 'application.yaml');
      const registry = 'myacr.azurecr.io';
      const config = {
        variables: {
          app: { key: appName },
          image: { name: 'aifabrix/dataplane', registry }
        }
      };

      paths.detectAppType.mockResolvedValue({ appPath, appType: 'regular', baseDir: 'builder', isExternal: false });
      paths.resolveApplicationConfigPath.mockReturnValue(configPath);
      configFormat.loadConfigFile.mockReturnValue(config);
      pushUtils.checkLocalImageExists.mockResolvedValue(true);

      await pushModule.pushApp(appName, {});

      expect(pushUtils.checkLocalImageExists).toHaveBeenCalledWith('aifabrix/dataplane', 'latest');
      expect(pushUtils.pushImage).toHaveBeenCalledWith(
        `${registry}/aifabrix/dataplane:latest`,
        registry
      );
    });
  });
});
