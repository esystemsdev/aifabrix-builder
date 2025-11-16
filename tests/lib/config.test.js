/**
 * Tests for Config Module
 *
 * @fileoverview Tests for config.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const fsPromises = require('fs').promises;
const {
  getConfig,
  saveConfig,
  clearConfig,
  getDeveloperId,
  setDeveloperId,
  loadDeveloperId,
  getCurrentEnvironment,
  setCurrentEnvironment,
  isTokenExpired,
  getDeviceToken,
  getClientToken,
  saveDeviceToken,
  saveClientToken,
  CONFIG_DIR,
  CONFIG_FILE
} = require('../../lib/config');

// Spy on fs.promises methods
jest.spyOn(fsPromises, 'readFile');
jest.spyOn(fsPromises, 'mkdir');
jest.spyOn(fsPromises, 'writeFile');
jest.spyOn(fsPromises, 'unlink');
jest.spyOn(fsPromises, 'open');

describe('Config Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return config when file exists', async() => {
      const mockConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token-123'
      };

      fsPromises.readFile.mockResolvedValue(`apiUrl: ${mockConfig.apiUrl}\ntoken: ${mockConfig.token}`);

      const result = await getConfig();

      expect(result).toEqual({
        ...mockConfig,
        'developer-id': '0',
        environment: 'dev',
        environments: {},
        device: {}
      });
      expect(fsPromises.readFile).toHaveBeenCalledWith(CONFIG_FILE, 'utf8');
    });

    it('should preserve existing developer-id when present', async() => {
      const mockConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token-123',
        'developer-id': 5
      };

      fsPromises.readFile.mockResolvedValue(`apiUrl: ${mockConfig.apiUrl}\ntoken: ${mockConfig.token}\ndeveloper-id: ${mockConfig['developer-id']}`);

      const result = await getConfig();

      expect(result).toEqual({
        ...mockConfig,
        'developer-id': '5', // getConfig converts numbers to strings
        environment: 'dev',
        environments: {},
        device: {}
      });
      expect(result['developer-id']).toBe('5');
    });

    it('should return default values when file does not exist', async() => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fsPromises.readFile.mockRejectedValue(error);

      const result = await getConfig();

      expect(result).toEqual({
        'developer-id': '0',
        environment: 'dev',
        environments: {},
        device: {}
      });
    });

    it('should handle empty config file', async() => {
      fsPromises.readFile.mockResolvedValue('');

      const result = await getConfig();

      expect(result).toEqual({
        'developer-id': '0',
        environment: 'dev',
        environments: {},
        device: {}
      });
    });

    it('should handle config file with only whitespace', async() => {
      fsPromises.readFile.mockResolvedValue('   \n  \n  ');

      const result = await getConfig();

      expect(result).toEqual({
        'developer-id': '0',
        environment: 'dev',
        environments: {},
        device: {}
      });
    });

    it('should throw error for other file errors', async() => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fsPromises.readFile.mockRejectedValue(error);

      await expect(getConfig()).rejects.toThrow('Failed to read config: Permission denied');
    });
  });

  describe('saveConfig', () => {
    it('should save config successfully', async() => {
      const mockFd = {
        sync: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);
      fsPromises.open.mockResolvedValue(mockFd);

      const config = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token'
      };

      await saveConfig(config);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        CONFIG_FILE,
        expect.stringContaining('apiUrl:'),
        {
          mode: 0o600,
          flag: 'w'
        }
      );
      expect(fsPromises.open).toHaveBeenCalledWith(CONFIG_FILE, 'r+');
      expect(mockFd.sync).toHaveBeenCalled();
      expect(mockFd.close).toHaveBeenCalled();
    });

    it('should handle file descriptor errors gracefully', async() => {
      const mockFd = {
        sync: jest.fn().mockRejectedValue(new Error('Sync failed')),
        close: jest.fn().mockResolvedValue(undefined)
      };
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);
      fsPromises.open.mockResolvedValue(mockFd);

      const config = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token'
      };

      await expect(saveConfig(config)).rejects.toThrow('Failed to save config: Sync failed');
      expect(mockFd.close).toHaveBeenCalled();
    });

    it('should handle open errors', async() => {
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);
      fsPromises.open.mockRejectedValue(new Error('Open failed'));

      const config = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token'
      };

      await expect(saveConfig(config)).rejects.toThrow('Failed to save config: Open failed');
    });

    it('should handle save errors', async() => {
      const error = new Error('Disk full');
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockRejectedValue(error);

      await expect(saveConfig({ apiUrl: 'test' })).rejects.toThrow('Failed to save config: Disk full');
    });
  });

  describe('clearConfig', () => {
    it('should delete config file', async() => {
      fsPromises.unlink.mockResolvedValue(undefined);

      await clearConfig();

      expect(fsPromises.unlink).toHaveBeenCalledWith(CONFIG_FILE);
    });

    it('should handle file not existing gracefully', async() => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fsPromises.unlink.mockRejectedValue(error);

      await expect(clearConfig()).resolves.not.toThrow();
    });

    it('should throw for other errors', async() => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fsPromises.unlink.mockRejectedValue(error);

      await expect(clearConfig()).rejects.toThrow('Failed to clear config: Permission denied');
    });
  });

  describe('getDeveloperId', () => {
    it('should return developer ID from config', async() => {
      const mockConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token',
        'developer-id': 3
      };

      fsPromises.readFile.mockResolvedValue(`apiUrl: ${mockConfig.apiUrl}\ntoken: ${mockConfig.token}\ndeveloper-id: ${mockConfig['developer-id']}`);

      const result = await getDeveloperId();

      expect(result).toBe('3');
      expect(fsPromises.readFile).toHaveBeenCalledWith(CONFIG_FILE, 'utf8');
    });

    it('should return 0 when developer-id is not set', async() => {
      const mockConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token'
      };

      fsPromises.readFile.mockResolvedValue(`apiUrl: ${mockConfig.apiUrl}\ntoken: ${mockConfig.token}`);

      const result = await getDeveloperId();

      expect(result).toBe('0');
    });

    it('should return 0 when config file does not exist', async() => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fsPromises.readFile.mockRejectedValue(error);

      const result = await getDeveloperId();

      expect(result).toBe('0');
    });

    it('should preserve string developer-id with leading zeros (e.g., "01" -> "01")', async() => {
      const yaml = require('js-yaml');
      const mockConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token',
        'developer-id': '01' // String with leading zero
      };
      const configYaml = yaml.dump(mockConfig);

      fsPromises.readFile.mockResolvedValue(configYaml);

      const result = await getDeveloperId();

      expect(result).toBe('01'); // Should preserve leading zeros
      expect(typeof result).toBe('string');
    });
  });

  describe('setDeveloperId', () => {
    it('should set developer ID successfully', async() => {
      const mockFd = {
        sync: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      const existingConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token',
        'developer-id': 0
      };
      const yaml = require('js-yaml');
      const configYaml = yaml.dump(existingConfig);
      const updatedConfig = { ...existingConfig, 'developer-id': 5 };
      const updatedYaml = yaml.dump(updatedConfig);

      fsPromises.readFile
        .mockResolvedValueOnce(configYaml) // First read in setDeveloperId
        .mockResolvedValueOnce(updatedYaml); // Second read for verification
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);
      fsPromises.open.mockResolvedValue(mockFd);

      await setDeveloperId(5);

      expect(fsPromises.readFile).toHaveBeenCalledTimes(2);
      expect(fsPromises.writeFile).toHaveBeenCalled();
      expect(mockFd.sync).toHaveBeenCalled();
      expect(mockFd.close).toHaveBeenCalled();
    });

    it('should create new config when file does not exist', async() => {
      const mockFd = {
        sync: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      const error = new Error('File not found');
      error.code = 'ENOENT';
      const yaml = require('js-yaml');
      const newConfig = { apiUrl: null, token: null, 'developer-id': 3 };
      const newConfigYaml = yaml.dump(newConfig);

      fsPromises.readFile
        .mockRejectedValueOnce(error) // First read fails with ENOENT
        .mockResolvedValueOnce(newConfigYaml); // Second read for verification
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);
      fsPromises.open.mockResolvedValue(mockFd);

      await setDeveloperId(3);

      expect(fsPromises.readFile).toHaveBeenCalledTimes(2);
      expect(fsPromises.writeFile).toHaveBeenCalled();
    });

    it('should handle invalid config object', async() => {
      const mockFd = {
        sync: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      const yaml = require('js-yaml');
      const invalidConfig = 'not an object';
      const newConfig = { apiUrl: null, token: null, 'developer-id': 2 };
      const newConfigYaml = yaml.dump(newConfig);

      fsPromises.readFile
        .mockResolvedValueOnce(invalidConfig) // First read returns invalid YAML
        .mockResolvedValueOnce(newConfigYaml); // Second read for verification
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);
      fsPromises.open.mockResolvedValue(mockFd);

      await setDeveloperId(2);

      expect(fsPromises.writeFile).toHaveBeenCalled();
    });

    it('should preserve string developer-id with leading zeros (e.g., "01" stays "01")', async() => {
      const mockFd = {
        sync: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      const existingConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token',
        'developer-id': 0
      };
      const yaml = require('js-yaml');
      const configYaml = yaml.dump(existingConfig);
      const updatedConfig = { ...existingConfig, 'developer-id': '01' };
      const updatedYaml = yaml.dump(updatedConfig);

      fsPromises.readFile
        .mockResolvedValueOnce(configYaml) // First read in setDeveloperId
        .mockResolvedValueOnce(updatedYaml); // Second read for verification
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);
      fsPromises.open.mockResolvedValue(mockFd);

      await setDeveloperId('01'); // String with leading zero

      expect(fsPromises.writeFile).toHaveBeenCalled();
      // Verify the saved value is a number, not a string
      const writeCall = fsPromises.writeFile.mock.calls[0];
      const savedYaml = writeCall[1];
      const savedConfig = yaml.load(savedYaml);
      expect(savedConfig['developer-id']).toBe('01');
      expect(typeof savedConfig['developer-id']).toBe('string');
    });

    it('should throw error for invalid developer ID (non-number)', async() => {
      await expect(setDeveloperId('invalid')).rejects.toThrow('Developer ID must be a non-negative digit string or number');
    });

    it('should throw error for invalid developer ID (negative)', async() => {
      await expect(setDeveloperId(-1)).rejects.toThrow('Developer ID must be a non-negative digit string or number');
    });

    it('should throw error when reading config fails', async() => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fsPromises.readFile.mockRejectedValue(error);

      await expect(setDeveloperId(1)).rejects.toThrow('Failed to read config: Permission denied');
    });

    it('should throw error when verification fails', async() => {
      const mockFd = {
        sync: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      const yaml = require('js-yaml');
      const existingConfig = { apiUrl: 'test', token: 'token', 'developer-id': 0 };
      const configYaml = yaml.dump(existingConfig);
      const wrongConfig = { ...existingConfig, 'developer-id': 99 };
      const wrongYaml = yaml.dump(wrongConfig);

      fsPromises.readFile
        .mockResolvedValueOnce(configYaml) // First read
        .mockResolvedValueOnce(wrongYaml); // Second read returns wrong value
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);
      fsPromises.open.mockResolvedValue(mockFd);

      await expect(setDeveloperId(5)).rejects.toThrow('Failed to save developer ID: expected 5, got 99');
    });

    it('should handle save errors', async() => {
      const yaml = require('js-yaml');
      const existingConfig = { apiUrl: 'test', token: 'token', 'developer-id': 0 };
      const configYaml = yaml.dump(existingConfig);

      fsPromises.readFile.mockResolvedValueOnce(configYaml);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(setDeveloperId(5)).rejects.toThrow('Failed to save config: Write failed');
    });
  });

  describe('loadDeveloperId', () => {
    it('should load developer ID when cache is null', async() => {
      jest.resetModules();
      const { loadDeveloperId: loadDevId } = require('../../lib/config');
      const yaml = require('js-yaml');
      const mockConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token',
        'developer-id': 7
      };
      const configYaml = yaml.dump(mockConfig);

      // Mock file read with the config
      fsPromises.readFile.mockResolvedValue(configYaml);

      const result = await loadDevId();

      expect(result).toBe('7');
      expect(fsPromises.readFile).toHaveBeenCalledWith(CONFIG_FILE, 'utf8');
    });

    it('should return cached developer ID when already loaded', async() => {
      jest.resetModules();
      const { loadDeveloperId: loadDevId } = require('../../lib/config');
      const yaml = require('js-yaml');
      const mockConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token',
        'developer-id': 4
      };
      const configYaml = yaml.dump(mockConfig);

      // Mock file read with the config
      fsPromises.readFile.mockResolvedValue(configYaml);

      // First call loads and caches
      const result1 = await loadDevId();
      expect(result1).toBe('4');

      // Second call should use cache (but loadDeveloperId always calls getConfig)
      const result2 = await loadDevId();
      expect(result2).toBe('4');
    });

    it('should return 0 when config file does not exist', async() => {
      jest.resetModules();
      const { loadDeveloperId: loadDevId } = require('../../lib/config');
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fsPromises.readFile.mockRejectedValue(error);

      const result = await loadDevId();

      expect(result).toBe('0');
    });
  });

  describe('developerId property', () => {
    it('should return cached developer ID when available', async() => {
      jest.resetModules();
      const config = require('../../lib/config');
      const yaml = require('js-yaml');
      const mockConfig = {
        apiUrl: 'https://controller.example.com',
        token: 'test-token',
        'developer-id': 8
      };
      const configYaml = yaml.dump(mockConfig);

      // Mock file read with the config
      fsPromises.readFile.mockResolvedValue(configYaml);

      // Load config to cache developer ID
      await config.getConfig();

      expect(config.developerId).toBe('8');
    });

    it('should return 0 when cache is null', async() => {
      // Clear any existing cache by resetting modules
      jest.resetModules();
      // Re-require to get fresh module instance
      const config = require('../../lib/config');

      expect(config.developerId).toBe('0');
    });
  });

  describe('getCurrentEnvironment', () => {
    it('should return current environment from config', async() => {
      const mockConfig = {
        'developer-id': 0,
        environment: 'miso',
        environments: {}
      };
      const yaml = require('js-yaml');
      fsPromises.readFile.mockResolvedValue(yaml.dump(mockConfig));

      const result = await getCurrentEnvironment();

      expect(result).toBe('miso');
    });

    it('should return default environment when not set', async() => {
      const mockConfig = {
        'developer-id': 0,
        environments: {}
      };
      const yaml = require('js-yaml');
      fsPromises.readFile.mockResolvedValue(yaml.dump(mockConfig));

      const result = await getCurrentEnvironment();

      expect(result).toBe('dev');
    });
  });

  describe('secrets path accessors and precedence', () => {
    it('getSecretsPath prefers aifabrix-secrets over legacy secrets-path', async() => {
      const yamlLib = require('js-yaml');
      const mockConfig = {
        'developer-id': '0',
        'aifabrix-secrets': '/canonical/secrets.yaml',
        'secrets-path': '/legacy/secrets.yaml'
      };
      fsPromises.readFile.mockResolvedValue(yamlLib.dump(mockConfig));

      const { getSecretsPath } = require('../../lib/config');
      const result = await getSecretsPath();
      expect(result).toBe('/canonical/secrets.yaml');
    });

    it('setSecretsPath validates input type', async() => {
      const { setSecretsPath } = require('../../lib/config');
      await expect(setSecretsPath(null)).rejects.toThrow('Secrets path is required and must be a string');
      await expect(setSecretsPath(123)).rejects.toThrow('Secrets path is required and must be a string');
    });

    it('get/setAifabrixSecretsPath round-trip', async() => {
      const yamlLib = require('js-yaml');
      const mockFd = {
        sync: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      fsPromises.open.mockResolvedValue(mockFd);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);
      // Initial config
      fsPromises.readFile.mockResolvedValue(yamlLib.dump({ 'developer-id': '0' }));

      const { setAifabrixSecretsPath, getAifabrixSecretsPath } = require('../../lib/config');
      await setAifabrixSecretsPath('/canonical/secrets.yaml');

      // After write, read back returns with the new key
      fsPromises.readFile.mockResolvedValue(yamlLib.dump({
        'developer-id': '0',
        'aifabrix-secrets': '/canonical/secrets.yaml'
      }));

      const value = await getAifabrixSecretsPath();
      expect(value).toBe('/canonical/secrets.yaml');
    });

    it('setAifabrixSecretsPath validates input type', async() => {
      const { setAifabrixSecretsPath } = require('../../lib/config');
      await expect(setAifabrixSecretsPath(null)).rejects.toThrow('Secrets path is required and must be a string');
      await expect(setAifabrixSecretsPath(42)).rejects.toThrow('Secrets path is required and must be a string');
    });
  });

  describe('getAifabrixEnvConfigPath / setAifabrixEnvConfigPath', () => {
    it('get/setAifabrixEnvConfigPath round-trip', async() => {
      const yamlLib = require('js-yaml');
      const mockFd = {
        sync: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      fsPromises.open.mockResolvedValue(mockFd);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.writeFile.mockResolvedValue(undefined);
      // Initial config
      fsPromises.readFile.mockResolvedValue(yamlLib.dump({ 'developer-id': '0' }));

      const { setAifabrixEnvConfigPath, getAifabrixEnvConfigPath } = require('../../lib/config');
      await setAifabrixEnvConfigPath('/custom/env-config.yaml');

      // After write, read back returns with the new key
      fsPromises.readFile.mockResolvedValue(yamlLib.dump({
        'developer-id': '0',
        'aifabrix-env-config': '/custom/env-config.yaml'
      }));

      const value = await getAifabrixEnvConfigPath();
      expect(value).toBe('/custom/env-config.yaml');
    });

    it('setAifabrixEnvConfigPath validates input type', async() => {
      const { setAifabrixEnvConfigPath } = require('../../lib/config');
      await expect(setAifabrixEnvConfigPath(null)).rejects.toThrow('Env config path is required and must be a string');
      await expect(setAifabrixEnvConfigPath(42)).rejects.toThrow('Env config path is required and must be a string');
    });

    it('getAifabrixEnvConfigPath returns null when not set', async() => {
      const yamlLib = require('js-yaml');
      fsPromises.readFile.mockResolvedValue(yamlLib.dump({ 'developer-id': '0' }));

      const { getAifabrixEnvConfigPath } = require('../../lib/config');
      const value = await getAifabrixEnvConfigPath();
      expect(value).toBeNull();
    });
  });

  describe('setCurrentEnvironment validation', () => {
    it('throws for invalid environment input', async() => {
      const { setCurrentEnvironment } = require('../../lib/config');
      await expect(setCurrentEnvironment(null)).rejects.toThrow('Environment must be a non-empty string');
      await expect(setCurrentEnvironment(123)).rejects.toThrow('Environment must be a non-empty string');
    });
  });

  describe('setCurrentEnvironment', () => {
    it('should update root-level environment', async() => {
      const mockConfig = {
        'developer-id': 0,
        environment: 'dev',
        environments: {}
      };
      const yaml = require('js-yaml');
      fsPromises.readFile.mockResolvedValue(yaml.dump(mockConfig));
      fsPromises.writeFile.mockResolvedValue();
      fsPromises.open.mockResolvedValue({ sync: jest.fn().mockResolvedValue(), close: jest.fn().mockResolvedValue() });

      await setCurrentEnvironment('miso');

      expect(fsPromises.writeFile).toHaveBeenCalled();
      const writtenContent = fsPromises.writeFile.mock.calls[0][1];
      const writtenConfig = yaml.load(writtenContent);
      expect(writtenConfig.environment).toBe('miso');
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 10).toISOString();
      expect(isTokenExpired(pastDate)).toBe(true);
    });

    it('should return false for valid token', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();
      expect(isTokenExpired(futureDate)).toBe(false);
    });

    it('should return true for null expiresAt', () => {
      expect(isTokenExpired(null)).toBe(true);
    });
  });

  describe('getDeviceToken', () => {
    it('should return device token for controller', async() => {
      const controllerUrl = 'http://localhost:3010';
      const mockConfig = {
        'developer-id': 0,
        environment: 'miso',
        device: {
          [controllerUrl]: {
            token: 'device-token-123',
            refreshToken: 'refresh-token-456',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
          }
        },
        environments: {}
      };
      const yaml = require('js-yaml');
      fsPromises.readFile.mockResolvedValue(yaml.dump(mockConfig));

      const result = await getDeviceToken(controllerUrl);

      expect(result).toEqual({
        controller: controllerUrl,
        token: 'device-token-123',
        refreshToken: 'refresh-token-456',
        expiresAt: mockConfig.device[controllerUrl].expiresAt
      });
    });

    it('should return null when controller does not exist', async() => {
      const mockConfig = {
        'developer-id': 0,
        environment: 'dev',
        device: {},
        environments: {}
      };
      const yaml = require('js-yaml');
      fsPromises.readFile.mockResolvedValue(yaml.dump(mockConfig));

      const result = await getDeviceToken('http://localhost:3010');

      expect(result).toBeNull();
    });
  });

  describe('getClientToken', () => {
    it('should return client token for environment and app', async() => {
      const mockConfig = {
        'developer-id': 0,
        environment: 'miso',
        environments: {
          miso: {
            clients: {
              keycloak: {
                controller: 'http://localhost:3010',
                token: 'client-token-123',
                expiresAt: new Date(Date.now() + 3600000).toISOString()
              }
            }
          }
        }
      };
      const yaml = require('js-yaml');
      fsPromises.readFile.mockResolvedValue(yaml.dump(mockConfig));

      const result = await getClientToken('miso', 'keycloak');

      expect(result).toEqual(mockConfig.environments.miso.clients.keycloak);
    });

    it('should return null when app does not exist', async() => {
      const mockConfig = {
        'developer-id': 0,
        environment: 'miso',
        environments: {
          miso: {
            clients: {}
          }
        }
      };
      const yaml = require('js-yaml');
      fsPromises.readFile.mockResolvedValue(yaml.dump(mockConfig));

      const result = await getClientToken('miso', 'keycloak');

      expect(result).toBeNull();
    });
  });

  describe('saveDeviceToken', () => {
    it('should save device token for controller at root level', async() => {
      const controllerUrl = 'http://localhost:3010';
      const mockConfig = {
        'developer-id': 0,
        environment: 'miso',
        device: {},
        environments: {}
      };
      const yaml = require('js-yaml');
      fsPromises.readFile.mockResolvedValue(yaml.dump(mockConfig));
      fsPromises.writeFile.mockResolvedValue();
      fsPromises.open.mockResolvedValue({ sync: jest.fn().mockResolvedValue(), close: jest.fn().mockResolvedValue() });

      const expiresAt = new Date(Date.now() + 3600000).toISOString();
      await saveDeviceToken(controllerUrl, 'device-token-123', 'refresh-token-456', expiresAt);

      expect(fsPromises.writeFile).toHaveBeenCalled();
      const writtenContent = fsPromises.writeFile.mock.calls[0][1];
      const writtenConfig = yaml.load(writtenContent);
      expect(writtenConfig.device[controllerUrl]).toBeDefined();
      expect(writtenConfig.device[controllerUrl].token).toBe('device-token-123');
      expect(writtenConfig.device[controllerUrl].refreshToken).toBe('refresh-token-456');
      expect(writtenConfig.device[controllerUrl].expiresAt).toBe(expiresAt);
    });
  });

  describe('saveClientToken', () => {
    it('should save client token for environment and app', async() => {
      const mockConfig = {
        'developer-id': 0,
        environment: 'miso',
        environments: {}
      };
      const yaml = require('js-yaml');
      fsPromises.readFile.mockResolvedValue(yaml.dump(mockConfig));
      fsPromises.writeFile.mockResolvedValue();
      fsPromises.open.mockResolvedValue({ sync: jest.fn().mockResolvedValue(), close: jest.fn().mockResolvedValue() });

      await saveClientToken('miso', 'keycloak', 'http://localhost:3010', 'client-token-123', new Date(Date.now() + 3600000).toISOString());

      expect(fsPromises.writeFile).toHaveBeenCalled();
      const writtenContent = fsPromises.writeFile.mock.calls[0][1];
      const writtenConfig = yaml.load(writtenContent);
      expect(writtenConfig.environments.miso.clients.keycloak).toBeDefined();
      expect(writtenConfig.environments.miso.clients.keycloak.token).toBe('client-token-123');
    });
  });

  describe('CONSTANTS', () => {
    it('should export CONFIG_DIR', () => {
      expect(CONFIG_DIR).toBe(path.join(os.homedir(), '.aifabrix'));
    });

    it('should export CONFIG_FILE', () => {
      expect(CONFIG_FILE).toBe(path.join(CONFIG_DIR, 'config.yaml'));
    });
  });
});

