/**
 * Tests for secrets set command
 *
 * @fileoverview Tests for secrets set command implementation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock dependencies BEFORE requiring any modules
jest.mock('fs');
jest.mock('os');

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock config BEFORE requiring secrets-set command
jest.mock('../../../lib/config', () => ({
  getAifabrixSecretsPath: jest.fn()
}));

// Mock paths BEFORE requiring secrets-set command
jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const { handleSecretsSet } = require('../../../lib/commands/secrets-set');
const config = require('../../../lib/config');
const logger = require('../../../lib/utils/logger');
const pathsUtil = require('../../../lib/utils/paths');

describe('secrets set command', () => {
  const mockHomeDir = '/home/test';
  const mockUserSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
  const mockGeneralSecretsPath = '/project/secrets.yaml';

  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variables to prevent supports-color issues
    process.env.FORCE_COLOR = '0';
    process.env.NO_COLOR = '1';
    process.env.TERM = 'dumb';

    os.homedir.mockReturnValue(mockHomeDir);
    pathsUtil.getAifabrixHome.mockReturnValue(path.join(mockHomeDir, '.aifabrix'));

    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('');
    fs.writeFileSync.mockImplementation(() => {});
    fs.mkdirSync.mockImplementation(() => {});

    config.getAifabrixSecretsPath.mockResolvedValue(null);
  });

  describe('handleSecretsSet', () => {
    describe('validation', () => {
      it('should throw error if key is missing', async() => {
        await expect(handleSecretsSet(null, 'value', {})).rejects.toThrow('Secret key is required and must be a string');
        await expect(handleSecretsSet(undefined, 'value', {})).rejects.toThrow('Secret key is required and must be a string');
        await expect(handleSecretsSet('', 'value', {})).rejects.toThrow('Secret key is required and must be a string');
      });

      it('should throw error if key is not a string', async() => {
        await expect(handleSecretsSet(123, 'value', {})).rejects.toThrow('Secret key is required and must be a string');
        await expect(handleSecretsSet({}, 'value', {})).rejects.toThrow('Secret key is required and must be a string');
      });

      it('should throw error if value is missing', async() => {
        await expect(handleSecretsSet('key', null, {})).rejects.toThrow('Secret value is required');
        await expect(handleSecretsSet('key', undefined, {})).rejects.toThrow('Secret value is required');
        await expect(handleSecretsSet('key', '', {})).rejects.toThrow('Secret value is required');
      });
    });

    describe('saving to user secrets file', () => {
      it('should save secret to user secrets file when --shared is not set', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = { shared: false };

        fs.existsSync.mockReturnValue(false); // File doesn't exist yet

        await handleSecretsSet(key, value, options);

        expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(mockUserSecretsPath), { recursive: true, mode: 0o700 });
        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[0]).toBe(mockUserSecretsPath);
        expect(writeCall[1]).toContain(key);
        expect(writeCall[1]).toContain(value);
        expect(writeCall[2]).toEqual({ mode: 0o600 });
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(`Secret '${key}' saved to user secrets file`));
      });

      it('should merge with existing secrets in user file', async() => {
        const key = 'new-keyKeyVault';
        const value = 'new-value';
        const existingSecrets = {
          'existing-keyKeyVault': 'existing-value'
        };

        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(yaml.dump(existingSecrets));

        await handleSecretsSet(key, value, {});

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];
        const parsed = yaml.load(writtenContent);
        expect(parsed['existing-keyKeyVault']).toBe('existing-value');
        expect(parsed[key]).toBe(value);
      });

      it('should support full URLs as values', async() => {
        const key = 'keycloak-public-server-urlKeyVault';
        const value = 'https://mydomain.com/keycloak';
        const options = {};

        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[1]).toContain(value);
      });

      it('should support environment variable interpolation in values', async() => {
        const key = 'keycloak-public-server-urlKeyVault';
        const value = 'https://${KEYCLOAK_HOST}:${KEYCLOAK_PORT}';
        const options = {};

        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[1]).toContain(value);
      });
    });

    describe('saving to general secrets file', () => {
      it('should save secret to general secrets file when --shared is set', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = { shared: true };

        config.getAifabrixSecretsPath.mockResolvedValue(mockGeneralSecretsPath);
        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(config.getAifabrixSecretsPath).toHaveBeenCalled();
        expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(mockGeneralSecretsPath), { recursive: true, mode: 0o700 });
        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[0]).toBe(mockGeneralSecretsPath);
        expect(writeCall[1]).toContain(key);
        expect(writeCall[1]).toContain(value);
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(`Secret '${key}' saved to general secrets file`));
      });

      it('should throw error if general secrets path is not configured', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = { shared: true };

        config.getAifabrixSecretsPath.mockResolvedValue(null);

        await expect(handleSecretsSet(key, value, options)).rejects.toThrow('General secrets file not configured');
      });

      it('should handle absolute paths for general secrets file', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = { shared: true };
        const absolutePath = '/absolute/path/secrets.yaml';

        config.getAifabrixSecretsPath.mockResolvedValue(absolutePath);
        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[0]).toBe(absolutePath);
      });

      it('should handle relative paths for general secrets file', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = { shared: true };
        const relativePath = './secrets.yaml';

        config.getAifabrixSecretsPath.mockResolvedValue(relativePath);
        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        // Should resolve relative path
        expect(writeCall[0]).toContain('secrets.yaml');
      });

      it('should merge with existing secrets in general file', async() => {
        const key = 'new-keyKeyVault';
        const value = 'new-value';
        const options = { shared: true };
        const existingSecrets = {
          'existing-keyKeyVault': 'existing-value'
        };

        config.getAifabrixSecretsPath.mockResolvedValue(mockGeneralSecretsPath);
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(yaml.dump(existingSecrets));

        await handleSecretsSet(key, value, options);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];
        const parsed = yaml.load(writtenContent);
        expect(parsed['existing-keyKeyVault']).toBe('existing-value');
        expect(parsed[key]).toBe(value);
      });
    });

    describe('error handling', () => {
      it('should handle file read errors gracefully', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = {};

        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockImplementation(() => {
          throw new Error('Permission denied');
        });

        await handleSecretsSet(key, value, options);

        // Should still write the file (with empty existing secrets)
        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not read existing secrets file'));
      });

      it('should handle YAML parse errors gracefully', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = {};

        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('invalid: yaml: content: [unclosed');

        // YAML parsing will fail, but should be caught and handled gracefully
        // The function should still succeed by treating existing secrets as empty
        await handleSecretsSet(key, value, options);

        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not read existing secrets file'));
        expect(fs.writeFileSync).toHaveBeenCalled();
      });

      it('should handle directory creation errors', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = {};

        fs.existsSync.mockReturnValue(false);
        fs.mkdirSync.mockImplementation(() => {
          throw new Error('Cannot create directory');
        });

        await expect(handleSecretsSet(key, value, options)).rejects.toThrow('Cannot create directory');
      });
    });

    describe('edge cases', () => {
      it('should handle special characters in keys', async() => {
        const key = 'key-with-special-chars-123KeyVault';
        const value = 'value';
        const options = {};

        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[1]).toContain(key);
      });

      it('should handle special characters in values', async() => {
        const key = 'test-keyKeyVault';
        const value = 'value with spaces and special chars: !@#$%^&*()';
        const options = {};

        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[1]).toContain(value);
      });

      it('should handle options.shared as boolean true', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = { shared: true };

        config.getAifabrixSecretsPath.mockResolvedValue(mockGeneralSecretsPath);
        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(config.getAifabrixSecretsPath).toHaveBeenCalled();
      });

      it('should handle options.shared as string "shared"', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = { 'shared': true };

        config.getAifabrixSecretsPath.mockResolvedValue(mockGeneralSecretsPath);
        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(config.getAifabrixSecretsPath).toHaveBeenCalled();
      });
    });

    describe('path resolution with aifabrix-home override', () => {
      it('should respect config.yaml aifabrix-home override when saving to user secrets', async() => {
        const overrideHome = '/custom/aifabrix';
        const overrideSecretsPath = path.join(overrideHome, 'secrets.local.yaml');
        pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);

        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = {};

        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
        expect(fs.mkdirSync).toHaveBeenCalledWith(overrideHome, { recursive: true, mode: 0o700 });
        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[0]).toBe(overrideSecretsPath);
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(overrideSecretsPath));
      });

      it('should use paths.getAifabrixHome() instead of os.homedir()', async() => {
        const overrideHome = '/workspace/.aifabrix';
        const overrideSecretsPath = path.join(overrideHome, 'secrets.local.yaml');
        pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);

        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = {};

        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        // Verify paths.getAifabrixHome() was called
        expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
        // Verify it wrote to the override path, not the default os.homedir() path
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[0]).toBe(overrideSecretsPath);
        // Verify it did NOT use os.homedir() path
        const defaultPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
        expect(writeCall[0]).not.toBe(defaultPath);
      });
    });
  });
});

