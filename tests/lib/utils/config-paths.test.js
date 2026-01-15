/**
 * Tests for Config Paths Module
 *
 * @fileoverview Unit tests for lib/utils/config-paths.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  getPathConfig,
  setPathConfig,
  createPathConfigFunctions
} = require('../../../lib/utils/config-paths');

describe('Config Paths Module', () => {
  describe('getPathConfig', () => {
    it('should return path value from config', async() => {
      const getConfigFn = jest.fn().mockResolvedValue({ 'test-key': '/test/path' });
      const result = await getPathConfig(getConfigFn, 'test-key');
      expect(result).toBe('/test/path');
      expect(getConfigFn).toHaveBeenCalled();
    });

    it('should return null if key does not exist', async() => {
      const getConfigFn = jest.fn().mockResolvedValue({});
      const result = await getPathConfig(getConfigFn, 'non-existent-key');
      expect(result).toBeNull();
    });

    it('should return null if config value is falsy', async() => {
      const getConfigFn = jest.fn().mockResolvedValue({ 'test-key': '' });
      const result = await getPathConfig(getConfigFn, 'test-key');
      expect(result).toBeNull();
    });
  });

  describe('setPathConfig', () => {
    it('should set path value in config', async() => {
      const getConfigFn = jest.fn().mockResolvedValue({});
      const saveConfigFn = jest.fn().mockResolvedValue();
      const errorMsg = 'Path is required';

      await setPathConfig(getConfigFn, saveConfigFn, 'test-key', '/test/path', errorMsg);

      expect(getConfigFn).toHaveBeenCalled();
      expect(saveConfigFn).toHaveBeenCalledWith({ 'test-key': '/test/path' });
    });

    it('should throw error if value is not provided', async() => {
      const getConfigFn = jest.fn();
      const saveConfigFn = jest.fn();
      const errorMsg = 'Path is required';

      await expect(setPathConfig(getConfigFn, saveConfigFn, 'test-key', null, errorMsg))
        .rejects.toThrow('Path is required');
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should throw error if value is not a string', async() => {
      const getConfigFn = jest.fn();
      const saveConfigFn = jest.fn();
      const errorMsg = 'Path is required';

      await expect(setPathConfig(getConfigFn, saveConfigFn, 'test-key', 123, errorMsg))
        .rejects.toThrow('Path is required');
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should throw error if value is empty string', async() => {
      const getConfigFn = jest.fn();
      const saveConfigFn = jest.fn();
      const errorMsg = 'Path is required';

      await expect(setPathConfig(getConfigFn, saveConfigFn, 'test-key', '', errorMsg))
        .rejects.toThrow('Path is required');
      expect(saveConfigFn).not.toHaveBeenCalled();
    });

    it('should preserve existing config values', async() => {
      const getConfigFn = jest.fn().mockResolvedValue({ 'other-key': '/other/path' });
      const saveConfigFn = jest.fn().mockResolvedValue();
      const errorMsg = 'Path is required';

      await setPathConfig(getConfigFn, saveConfigFn, 'test-key', '/test/path', errorMsg);

      expect(saveConfigFn).toHaveBeenCalledWith({
        'other-key': '/other/path',
        'test-key': '/test/path'
      });
    });
  });

  describe('createPathConfigFunctions', () => {
    let getConfigFn;
    let saveConfigFn;
    let pathConfigFunctions;

    beforeEach(() => {
      getConfigFn = jest.fn().mockResolvedValue({});
      saveConfigFn = jest.fn().mockResolvedValue();
      pathConfigFunctions = createPathConfigFunctions(getConfigFn, saveConfigFn);
    });

    describe('getAifabrixHomeOverride', () => {
      it('should get aifabrix-home path from config', async() => {
        getConfigFn.mockResolvedValue({ 'aifabrix-home': '/custom/home' });
        const result = await pathConfigFunctions.getAifabrixHomeOverride();
        expect(result).toBe('/custom/home');
      });

      it('should return null if aifabrix-home not in config', async() => {
        const result = await pathConfigFunctions.getAifabrixHomeOverride();
        expect(result).toBeNull();
      });
    });

    describe('setAifabrixHomeOverride', () => {
      it('should set aifabrix-home path in config', async() => {
        await pathConfigFunctions.setAifabrixHomeOverride('/custom/home');
        expect(saveConfigFn).toHaveBeenCalledWith({ 'aifabrix-home': '/custom/home' });
      });

      it('should throw error if home path is not provided', async() => {
        await expect(pathConfigFunctions.setAifabrixHomeOverride(null))
          .rejects.toThrow('Home path is required and must be a string');
      });

      it('should throw error if home path is not a string', async() => {
        await expect(pathConfigFunctions.setAifabrixHomeOverride(123))
          .rejects.toThrow('Home path is required and must be a string');
      });
    });

    describe('getAifabrixSecretsPath', () => {
      it('should get aifabrix-secrets path from config', async() => {
        getConfigFn.mockResolvedValue({ 'aifabrix-secrets': '/custom/secrets' });
        const result = await pathConfigFunctions.getAifabrixSecretsPath();
        expect(result).toBe('/custom/secrets');
      });

      it('should return null if aifabrix-secrets not in config', async() => {
        const result = await pathConfigFunctions.getAifabrixSecretsPath();
        expect(result).toBeNull();
      });
    });

    describe('setAifabrixSecretsPath', () => {
      it('should set aifabrix-secrets path in config', async() => {
        await pathConfigFunctions.setAifabrixSecretsPath('/custom/secrets');
        expect(saveConfigFn).toHaveBeenCalledWith({ 'aifabrix-secrets': '/custom/secrets' });
      });

      it('should throw error if secrets path is not provided', async() => {
        await expect(pathConfigFunctions.setAifabrixSecretsPath(null))
          .rejects.toThrow('Secrets path is required and must be a string');
      });
    });

    describe('getAifabrixEnvConfigPath', () => {
      it('should get aifabrix-env-config path from config', async() => {
        getConfigFn.mockResolvedValue({ 'aifabrix-env-config': '/custom/env-config' });
        const result = await pathConfigFunctions.getAifabrixEnvConfigPath();
        expect(result).toBe('/custom/env-config');
      });

      it('should return null if aifabrix-env-config not in config', async() => {
        const result = await pathConfigFunctions.getAifabrixEnvConfigPath();
        expect(result).toBeNull();
      });
    });

    describe('setAifabrixEnvConfigPath', () => {
      it('should set aifabrix-env-config path in config', async() => {
        await pathConfigFunctions.setAifabrixEnvConfigPath('/custom/env-config');
        expect(saveConfigFn).toHaveBeenCalledWith({ 'aifabrix-env-config': '/custom/env-config' });
      });

      it('should throw error if env config path is not provided', async() => {
        await expect(pathConfigFunctions.setAifabrixEnvConfigPath(null))
          .rejects.toThrow('Env config path is required and must be a string');
      });
    });
  });
});

