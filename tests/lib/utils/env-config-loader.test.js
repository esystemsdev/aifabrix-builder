/**
 * Tests for AI Fabrix Builder Environment Config Loader Module
 *
 * @fileoverview Unit tests for env-config-loader.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { loadEnvConfig } = require('../../../lib/utils/env-config-loader');
const config = require('../../../lib/core/config');

jest.mock('../../../lib/core/config');
jest.mock('fs');

describe('Environment Config Loader Module', () => {
  const mockBaseEnvConfig = {
    environments: {
      docker: {
        DB_HOST: 'postgres',
        DB_PORT: '5432',
        REDIS_HOST: 'redis',
        REDIS_PORT: '6379'
      },
      local: {
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379'
      }
    }
  };

  const mockUserEnvConfig = {
    environments: {
      docker: {
        DB_HOST: 'custom-postgres',
        MISO_HOST: 'custom-miso'
      },
      local: {
        REDIS_HOST: 'custom-redis'
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.getAifabrixEnvConfigPath = jest.fn().mockResolvedValue(null);

    // Mock base env-config.yaml
    const envConfigPath = path.join(__dirname, '..', '..', '..', 'lib', 'schema', 'env-config.yaml');
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath === envConfigPath) {
        return yaml.dump(mockBaseEnvConfig);
      }
      return '';
    });
  });

  describe('loadEnvConfig', () => {
    it('should load base env-config.yaml when user config not set', async() => {
      const result = await loadEnvConfig();

      expect(result).toEqual(mockBaseEnvConfig);
      expect(config.getAifabrixEnvConfigPath).toHaveBeenCalled();
    });

    it('should merge user env-config with base when user config is set', async() => {
      const userConfigPath = '/home/user/.aifabrix/custom-env-config.yaml';
      config.getAifabrixEnvConfigPath.mockResolvedValue(userConfigPath);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userConfigPath) {
          return yaml.dump(mockUserEnvConfig);
        }
        const envConfigPath = path.join(__dirname, '..', '..', '..', 'lib', 'schema', 'env-config.yaml');
        if (filePath === envConfigPath) {
          return yaml.dump(mockBaseEnvConfig);
        }
        return '';
      });

      const result = await loadEnvConfig();

      expect(result.environments.docker.DB_HOST).toBe('custom-postgres'); // User overrides base
      expect(result.environments.docker.DB_PORT).toBe('5432'); // Base value preserved
      expect(result.environments.docker.REDIS_HOST).toBe('redis'); // Base value preserved
      expect(result.environments.docker.MISO_HOST).toBe('custom-miso'); // User extends base
      expect(result.environments.local.DB_HOST).toBe('localhost'); // Base value preserved
      expect(result.environments.local.REDIS_HOST).toBe('custom-redis'); // User overrides base
    });

    it('should use base config when user config file does not exist', async() => {
      const userConfigPath = '/home/user/.aifabrix/custom-env-config.yaml';
      config.getAifabrixEnvConfigPath.mockResolvedValue(userConfigPath);
      fs.existsSync.mockReturnValue(false);

      const result = await loadEnvConfig();

      expect(result).toEqual(mockBaseEnvConfig);
    });

    it('should use base config when user config path is null', async() => {
      config.getAifabrixEnvConfigPath.mockResolvedValue(null);

      const result = await loadEnvConfig();

      expect(result).toEqual(mockBaseEnvConfig);
    });

    it('should handle relative paths in user config', async() => {
      const userConfigPath = './custom-env-config.yaml';
      const resolvedPath = path.resolve(process.cwd(), userConfigPath);
      config.getAifabrixEnvConfigPath.mockResolvedValue(userConfigPath);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvedPath) {
          return yaml.dump(mockUserEnvConfig);
        }
        const envConfigPath = path.join(__dirname, '..', '..', '..', 'lib', 'schema', 'env-config.yaml');
        if (filePath === envConfigPath) {
          return yaml.dump(mockBaseEnvConfig);
        }
        return '';
      });

      const result = await loadEnvConfig();

      expect(result.environments.docker.DB_HOST).toBe('custom-postgres');
    });

    it('should handle errors gracefully and fallback to base config', async() => {
      const userConfigPath = '/home/user/.aifabrix/custom-env-config.yaml';
      config.getAifabrixEnvConfigPath.mockResolvedValue(userConfigPath);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userConfigPath) {
          throw new Error('File read error');
        }
        const envConfigPath = path.join(__dirname, '..', '..', '..', 'lib', 'schema', 'env-config.yaml');
        if (filePath === envConfigPath) {
          return yaml.dump(mockBaseEnvConfig);
        }
        return '';
      });

      const result = await loadEnvConfig();

      expect(result).toEqual(mockBaseEnvConfig);
    });

    it('should handle invalid YAML in user config gracefully', async() => {
      const userConfigPath = '/home/user/.aifabrix/custom-env-config.yaml';
      config.getAifabrixEnvConfigPath.mockResolvedValue(userConfigPath);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userConfigPath) {
          return 'invalid: yaml: content: [';
        }
        const envConfigPath = path.join(__dirname, '..', '..', '..', 'lib', 'schema', 'env-config.yaml');
        if (filePath === envConfigPath) {
          return yaml.dump(mockBaseEnvConfig);
        }
        return '';
      });

      // Should not throw, but may return base config or handle error
      const result = await loadEnvConfig();
      expect(result).toBeDefined();
    });

    it('should deep merge environments correctly', async() => {
      const userConfigPath = '/home/user/.aifabrix/custom-env-config.yaml';
      config.getAifabrixEnvConfigPath.mockResolvedValue(userConfigPath);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userConfigPath) {
          return yaml.dump({
            environments: {
              docker: {
                NEW_SERVICE_HOST: 'new-service'
              }
            }
          });
        }
        const envConfigPath = path.join(__dirname, '..', '..', '..', 'lib', 'schema', 'env-config.yaml');
        if (filePath === envConfigPath) {
          return yaml.dump(mockBaseEnvConfig);
        }
        return '';
      });

      const result = await loadEnvConfig();

      expect(result.environments.docker.DB_HOST).toBe('postgres'); // Base preserved
      expect(result.environments.docker.NEW_SERVICE_HOST).toBe('new-service'); // User extends
    });
  });
});

