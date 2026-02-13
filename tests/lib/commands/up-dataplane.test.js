/**
 * Tests for up-dataplane command
 *
 * @fileoverview Tests for up-dataplane command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn(),
  resolveEnvironment: jest.fn(),
  getAifabrixBuilderDir: jest.fn().mockResolvedValue(null)
}));
jest.mock('../../../lib/utils/app-register-auth');
jest.mock('../../../lib/utils/controller-url');
jest.mock('../../../lib/app/register');
jest.mock('../../../lib/app/rotate-secret');
jest.mock('../../../lib/utils/app-existence');
jest.mock('../../../lib/app');
jest.mock('../../../lib/commands/up-common');
jest.mock('../../../lib/utils/paths', () => ({
  getBuilderPath: jest.fn(),
  resolveApplicationConfigPath: jest.fn()
}));
jest.mock('../../../lib/utils/config-format', () => ({
  loadConfigFile: jest.fn()
}));

const path = require('path');
const { handleUpDataplane, buildDataplaneImageRef } = require('../../../lib/commands/up-dataplane');
const config = require('../../../lib/core/config');
const pathsUtil = require('../../../lib/utils/paths');
const configFormat = require('../../../lib/utils/config-format');
const { checkAuthentication } = require('../../../lib/utils/app-register-auth');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { registerApplication } = require('../../../lib/app/register');
const { rotateSecret } = require('../../../lib/app/rotate-secret');
const { checkApplicationExists } = require('../../../lib/utils/app-existence');
const app = require('../../../lib/app');
const { ensureAppFromTemplate } = require('../../../lib/commands/up-common');

describe('up-dataplane command', () => {
  const cwd = process.cwd();

  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('http://localhost:3000');
    config.resolveEnvironment.mockResolvedValue('dev');
    config.getConfig.mockResolvedValue({ environment: 'dev' });
    checkAuthentication.mockResolvedValue({ apiUrl: 'http://localhost:3000', token: 'token' });
    ensureAppFromTemplate.mockResolvedValue(false);
    checkApplicationExists.mockResolvedValue(false);
    registerApplication.mockResolvedValue();
    rotateSecret.mockResolvedValue();
    app.deployApp.mockResolvedValue({});
    app.runApp.mockResolvedValue();
  });

  describe('buildDataplaneImageRef', () => {
    it('should return undefined when application config does not exist', () => {
      pathsUtil.getBuilderPath.mockReturnValue(path.join(cwd, 'builder', 'dataplane'));
      pathsUtil.resolveApplicationConfigPath.mockImplementation(() => {
        throw new Error('Application config not found');
      });
      expect(buildDataplaneImageRef('myreg.azurecr.io')).toBeUndefined();
    });

    it('should build registry/name:tag from application config', () => {
      const builderPath = path.join(cwd, 'builder', 'dataplane');
      pathsUtil.getBuilderPath.mockReturnValue(builderPath);
      pathsUtil.resolveApplicationConfigPath.mockReturnValue(path.join(builderPath, 'application.yaml'));
      configFormat.loadConfigFile.mockReturnValue({
        app: { key: 'dataplane' },
        image: { name: 'aifabrix/dataplane', tag: 'v1' }
      });

      expect(buildDataplaneImageRef('myreg.azurecr.io')).toBe('myreg.azurecr.io/aifabrix/dataplane:v1');
    });
  });

  describe('handleUpDataplane', () => {
    it('should throw when environment is not dev', async() => {
      config.getConfig.mockResolvedValue({ environment: 'tst' });

      await expect(handleUpDataplane({})).rejects.toThrow(
        'Dataplane is only supported in dev environment. Set with: aifabrix auth config --set-environment dev.'
      );
      expect(checkApplicationExists).not.toHaveBeenCalled();
      expect(registerApplication).not.toHaveBeenCalled();
    });

    it('should ensure dataplane from template', async() => {
      await handleUpDataplane({});

      expect(ensureAppFromTemplate).toHaveBeenCalledWith('dataplane');
    });

    it('should call register then deploy then run locally when app not registered', async() => {
      checkApplicationExists.mockResolvedValue(false);

      await handleUpDataplane({});

      expect(checkApplicationExists).toHaveBeenCalledWith('dataplane', 'http://localhost:3000', 'dev', expect.any(Object));
      expect(registerApplication).toHaveBeenCalledWith('dataplane', expect.any(Object));
      expect(rotateSecret).not.toHaveBeenCalled();
      expect(app.deployApp).toHaveBeenCalledWith('dataplane', expect.any(Object));
      expect(app.runApp).toHaveBeenCalledWith('dataplane', {});
    });

    it('should call rotateSecret (not register) then deploy then run locally when app already registered', async() => {
      checkApplicationExists.mockResolvedValue(true);

      await handleUpDataplane({});

      expect(checkApplicationExists).toHaveBeenCalledWith('dataplane', 'http://localhost:3000', 'dev', expect.any(Object));
      expect(rotateSecret).toHaveBeenCalledWith('dataplane', expect.any(Object));
      expect(registerApplication).not.toHaveBeenCalled();
      expect(app.deployApp).toHaveBeenCalledWith('dataplane', expect.any(Object));
      expect(app.runApp).toHaveBeenCalledWith('dataplane', {});
    });

    it('should pass image override to register and deploy then run locally', async() => {
      await handleUpDataplane({ image: 'myreg/dataplane:latest' });

      expect(registerApplication).toHaveBeenCalledWith('dataplane', expect.objectContaining({
        imageOverride: 'myreg/dataplane:latest',
        image: 'myreg/dataplane:latest'
      }));
      expect(app.deployApp).toHaveBeenCalledWith('dataplane', expect.objectContaining({
        imageOverride: 'myreg/dataplane:latest',
        image: 'myreg/dataplane:latest'
      }));
      expect(app.runApp).toHaveBeenCalledWith('dataplane', {});
    });
  });
});
