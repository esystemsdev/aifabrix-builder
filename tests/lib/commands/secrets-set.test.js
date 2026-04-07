/**
 * Tests for secret set command
 *
 * @fileoverview Tests for secret set command implementation
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

// Mock config BEFORE requiring secrets-set command (getSecretsEncryptionKey for local-secrets encrypt path)
jest.mock('../../../lib/core/config', () => ({
  getAifabrixSecretsPath: jest.fn(),
  getSecretsEncryptionKey: jest.fn().mockResolvedValue(null),
  getRemoteServer: jest.fn().mockResolvedValue(null),
  getDeveloperId: jest.fn().mockResolvedValue('1')
}));

// Mock paths BEFORE requiring secrets-set command (getAifabrixWork used by resolveSharedSecretsEndpoint)
jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn(),
  getPrimaryUserSecretsLocalPath: jest.fn(),
  getAifabrixWork: jest.fn(() => null)
}));

jest.mock('../../../lib/api/dev.api', () => ({
  addSecret: jest.fn().mockResolvedValue({})
}));

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const { handleSecretsSet } = require('../../../lib/commands/secrets-set');
const config = require('../../../lib/core/config');
const devApi = require('../../../lib/api/dev.api');
const logger = require('../../../lib/utils/logger');
const pathsUtil = require('../../../lib/utils/paths');
const remoteDevAuth = require('../../../lib/utils/remote-dev-auth');

describe('secret set command', () => {
  const mockHomeDir = '/home/test';
  const mockUserSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
  const mockGeneralSecretsPath = '/project/secrets.yaml';

  beforeAll(() => {
    jest.spyOn(remoteDevAuth, 'getRemoteDevAuth');
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment variables to prevent supports-color issues
    process.env.FORCE_COLOR = '0';
    process.env.NO_COLOR = '1';
    process.env.TERM = 'dumb';

    os.homedir.mockReturnValue(mockHomeDir);
    pathsUtil.getAifabrixHome.mockReturnValue(path.join(mockHomeDir, '.aifabrix'));
    pathsUtil.getPrimaryUserSecretsLocalPath.mockReturnValue(mockUserSecretsPath);
    pathsUtil.getAifabrixWork.mockReturnValue(null);

    remoteDevAuth.getRemoteDevAuth.mockResolvedValue(null);

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

      it('should throw error if key starts with kv://', async() => {
        await expect(handleSecretsSet('kv://my-variable-name', 'value', {})).rejects.toThrow(
          'Secret key must not start with kv://'
        );
        await expect(handleSecretsSet('kv://hubspot-demo/apikey', 'value', {})).rejects.toThrow(
          'Secret key must not start with kv://'
        );
        const err = await handleSecretsSet('kv://my-app/clientSecret', 'x', {}).catch(e => e);
        expect(err.message).toContain('Use the key path without the prefix');
        expect(err.message).toMatch(/my-app\/clientSecret|hubspot-demo\/apiKey/);
      });

      it('should reject kv:// key when --shared is set', async() => {
        config.getAifabrixSecretsPath.mockResolvedValue(mockGeneralSecretsPath);
        await expect(handleSecretsSet('kv://app/secret', 'val', { shared: true })).rejects.toThrow(
          'Secret key must not start with kv://'
        );
        expect(config.getAifabrixSecretsPath).not.toHaveBeenCalled();
      });

      it('should reject key that is exactly kv://', async() => {
        await expect(handleSecretsSet('kv://', 'value', {})).rejects.toThrow(
          'Secret key must not start with kv://'
        );
      });

      it('should accept key that contains kv but does not start with kv://', async() => {
        fs.existsSync.mockReturnValue(false);
        await handleSecretsSet('my-kv-secret', 'value', {});
        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[1]).toContain('my-kv-secret');
      });

      it('should accept valid path-style key without kv:// (e.g. hubspot-demo/clientSecret)', async() => {
        fs.existsSync.mockReturnValue(false);
        await handleSecretsSet('hubspot-demo/clientSecret', 'my-secret-value', {});
        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[1]).toContain('hubspot-demo/clientSecret');
        expect(writeCall[1]).toContain('my-secret-value');
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
        const key = 'keycloak-server-url';
        const value = 'https://mydomain.com/keycloak';
        const options = {};

        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[1]).toContain(value);
      });

      it('should support environment variable interpolation in values', async() => {
        const key = 'keycloak-server-url';
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

      it('should use Builder secrets API when remote auth is set and aifabrix-secrets is a server-side path', async() => {
        const key = 'BASH_NPM_TOKEN';
        const value = 'npm_token_value';
        const options = { shared: true };
        const serverSidePath = '/aifabrix-miso/builder/secrets.local.yaml';

        config.getAifabrixSecretsPath.mockResolvedValue(serverSidePath);
        remoteDevAuth.getRemoteDevAuth.mockResolvedValue({
          serverUrl: 'http://builder02.local:3000',
          clientCertPem: '-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----',
          serverCaPem: null
        });

        await handleSecretsSet(key, value, options);

        expect(devApi.addSecret).toHaveBeenCalledWith(
          'http://builder02.local:3000',
          '-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----',
          { key, value },
          undefined,
          'http://builder02.local:3000/api/dev/secrets'
        );
        expect(fs.writeFileSync).not.toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('shared secrets (remote - builder02.local)'));
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

      it('should write new secret when existing file has invalid YAML (existing content discarded)', async() => {
        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = {};

        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('invalid: yaml: content: [unclosed');

        // Invalid YAML cannot be merged; implementation overwrites with new key only
        await handleSecretsSet(key, value, options);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const written = fs.writeFileSync.mock.calls[0][1];
        expect(written).toContain('test-keyKeyVault');
        expect(written).toContain('test-value');
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

    describe('path resolution for user secrets file', () => {
      it('saves to getPrimaryUserSecretsLocalPath (config dir), not aifabrix-home alone', async() => {
        const configDir = '/custom/aifabrix';
        const userSecretsPath = path.join(configDir, 'secrets.local.yaml');
        pathsUtil.getPrimaryUserSecretsLocalPath.mockReturnValue(userSecretsPath);
        pathsUtil.getAifabrixHome.mockReturnValue('/home/dev02');

        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = {};

        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(pathsUtil.getPrimaryUserSecretsLocalPath).toHaveBeenCalled();
        expect(fs.mkdirSync).toHaveBeenCalledWith(path.normalize(configDir), { recursive: true, mode: 0o700 });
        expect(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[0]).toBe(path.normalize(userSecretsPath));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(userSecretsPath));
      });

      it('uses primary user path from paths, not os.homedir()', async() => {
        const workspacePath = '/workspace/.aifabrix/secrets.local.yaml';
        pathsUtil.getPrimaryUserSecretsLocalPath.mockReturnValue(workspacePath);

        const key = 'test-keyKeyVault';
        const value = 'test-value';
        const options = {};

        fs.existsSync.mockReturnValue(false);

        await handleSecretsSet(key, value, options);

        expect(pathsUtil.getPrimaryUserSecretsLocalPath).toHaveBeenCalled();
        const writeCall = fs.writeFileSync.mock.calls[0];
        expect(writeCall[0]).toBe(workspacePath);
        const defaultPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
        expect(writeCall[0]).not.toBe(defaultPath);
      });
    });
  });
});

