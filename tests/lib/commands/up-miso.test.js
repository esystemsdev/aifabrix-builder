/**
 * Tests for up-miso command
 *
 * @fileoverview Tests for up-miso command implementation
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

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/infrastructure');
jest.mock('../../../lib/app');
jest.mock('../../../lib/commands/up-common');

const { handleUpMiso, parseImageOptions } = require('../../../lib/commands/up-miso');
const config = require('../../../lib/core/config');
const infra = require('../../../lib/infrastructure');
const app = require('../../../lib/app');
const { ensureAppFromTemplate, patchEnvOutputPathForDeployOnly, validateEnvOutputPathFolderOrNull } = require('../../../lib/commands/up-common');

describe('up-miso command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    infra.checkInfraHealth.mockResolvedValue({ postgres: 'healthy', redis: 'healthy' });
    config.getAifabrixBuilderDir = config.getAifabrixBuilderDir || jest.fn();
    config.getAifabrixBuilderDir.mockResolvedValue(null);
    ensureAppFromTemplate.mockResolvedValue(false);
    app.runApp.mockResolvedValue();
  });

  describe('parseImageOptions', () => {
    it('should parse key=value pairs from array', () => {
      expect(parseImageOptions(['keycloak=myreg/k:v1', 'miso-controller=myreg/m:v1'])).toEqual({
        keycloak: 'myreg/k:v1',
        'miso-controller': 'myreg/m:v1'
      });
    });

    it('should parse single string', () => {
      expect(parseImageOptions('keycloak=myreg/k:v1')).toEqual({ keycloak: 'myreg/k:v1' });
    });

    it('should return empty object for empty or invalid', () => {
      expect(parseImageOptions([])).toEqual({});
      expect(parseImageOptions(undefined)).toEqual({});
      expect(parseImageOptions(['no-equals'])).toEqual({});
    });
  });

  describe('handleUpMiso', () => {
    it('should throw when infra is not up', async() => {
      infra.checkInfraHealth.mockResolvedValue({ postgres: 'unknown', redis: 'unknown' });

      await expect(handleUpMiso({})).rejects.toThrow('Infrastructure is not up. Run \'aifabrix up-infra\' first.');
      expect(ensureAppFromTemplate).not.toHaveBeenCalled();
    });

    it('should ensure keycloak and miso-controller from template', async() => {
      await handleUpMiso({});

      expect(infra.checkInfraHealth).toHaveBeenCalledWith(undefined, { strict: true });
      expect(ensureAppFromTemplate).toHaveBeenCalledWith('keycloak');
      expect(ensureAppFromTemplate).toHaveBeenCalledWith('miso-controller');
    });

    it('should validate env output path and patch for deploy-only for keycloak and miso-controller', async() => {
      await handleUpMiso({});

      expect(validateEnvOutputPathFolderOrNull).toHaveBeenCalledWith('keycloak');
      expect(validateEnvOutputPathFolderOrNull).toHaveBeenCalledWith('miso-controller');
      expect(patchEnvOutputPathForDeployOnly).toHaveBeenCalledWith('keycloak');
      expect(patchEnvOutputPathForDeployOnly).toHaveBeenCalledWith('miso-controller');
    });

    it('should run keycloak then miso-controller', async() => {
      await handleUpMiso({});

      expect(app.runApp).toHaveBeenCalledTimes(2);
      expect(app.runApp).toHaveBeenNthCalledWith(1, 'keycloak', expect.objectContaining({ skipEnvOutputPath: true, skipInfraCheck: true }));
      expect(app.runApp).toHaveBeenNthCalledWith(2, 'miso-controller', expect.objectContaining({ skipEnvOutputPath: true, skipInfraCheck: true }));
    });

    it('should pass image overrides from --image options to runApp', async() => {
      await handleUpMiso({
        image: ['keycloak=myreg/keycloak:v1', 'miso-controller=myreg/miso:v2']
      });

      expect(app.runApp).toHaveBeenNthCalledWith(1, 'keycloak', expect.objectContaining({ image: 'myreg/keycloak:v1' }));
      expect(app.runApp).toHaveBeenNthCalledWith(2, 'miso-controller', expect.objectContaining({ image: 'myreg/miso:v2' }));
    });
  });
});
