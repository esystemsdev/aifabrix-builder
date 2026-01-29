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
jest.mock('../../../lib/core/secrets');
jest.mock('../../../lib/infrastructure');
jest.mock('../../../lib/app');
jest.mock('../../../lib/utils/local-secrets');
jest.mock('../../../lib/commands/up-common');

const { handleUpMiso, parseImageOptions } = require('../../../lib/commands/up-miso');
const config = require('../../../lib/core/config');
const secrets = require('../../../lib/core/secrets');
const infra = require('../../../lib/infrastructure');
const app = require('../../../lib/app');
const { saveLocalSecret } = require('../../../lib/utils/local-secrets');
const { ensureAppFromTemplate } = require('../../../lib/commands/up-common');

describe('up-miso command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    infra.checkInfraHealth.mockResolvedValue({ postgres: 'healthy', redis: 'healthy' });
    config.getDeveloperId.mockResolvedValue('0');
    config.getAifabrixBuilderDir = config.getAifabrixBuilderDir || jest.fn();
    config.getAifabrixBuilderDir.mockResolvedValue(null);
    ensureAppFromTemplate.mockResolvedValue(false);
    saveLocalSecret.mockResolvedValue();
    secrets.generateEnvFile.mockResolvedValue('/path/to/.env');
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

      await expect(handleUpMiso({})).rejects.toThrow('Infrastructure is not up. Run \'aifabrix up\' first.');
      expect(ensureAppFromTemplate).not.toHaveBeenCalled();
    });

    it('should ensure keycloak and miso-controller from template', async() => {
      await handleUpMiso({});

      expect(ensureAppFromTemplate).toHaveBeenCalledWith('keycloak');
      expect(ensureAppFromTemplate).toHaveBeenCalledWith('miso-controller');
    });

    it('should set secrets with correct ports for developer 0', async() => {
      config.getDeveloperId.mockResolvedValue('0');

      await handleUpMiso({});

      expect(saveLocalSecret).toHaveBeenCalledWith('keycloak-public-server-urlKeyVault', 'http://localhost:8082');
      expect(saveLocalSecret).toHaveBeenCalledWith('miso-controller-web-server-url', 'http://localhost:3000');
    });

    it('should set secrets with offset ports for developer 1', async() => {
      config.getDeveloperId.mockResolvedValue('1');

      await handleUpMiso({});

      expect(saveLocalSecret).toHaveBeenCalledWith('keycloak-public-server-urlKeyVault', 'http://localhost:8182');
      expect(saveLocalSecret).toHaveBeenCalledWith('miso-controller-web-server-url', 'http://localhost:3100');
    });

    it('should call generateEnvFile without force for both apps', async() => {
      await handleUpMiso({});

      expect(secrets.generateEnvFile).toHaveBeenCalledWith('keycloak', undefined, 'docker', false, true);
      expect(secrets.generateEnvFile).toHaveBeenCalledWith('miso-controller', undefined, 'docker', false, true);
    });

    it('should run keycloak then miso-controller', async() => {
      await handleUpMiso({});

      expect(app.runApp).toHaveBeenCalledTimes(2);
      expect(app.runApp).toHaveBeenNthCalledWith(1, 'keycloak', expect.any(Object));
      expect(app.runApp).toHaveBeenNthCalledWith(2, 'miso-controller', expect.any(Object));
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
