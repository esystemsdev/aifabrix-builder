/**
 * Tests for AI Fabrix Builder Secrets Module
 *
 * @fileoverview Unit tests for secrets.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Mock chalk before requiring modules that use it
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.cyan = jest.fn((text) => text);
  mockChalk.magenta = jest.fn((text) => text);
  mockChalk.white = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  mockChalk.bold = jest.fn((text) => text);
  mockChalk.dim = jest.fn((text) => text);
  mockChalk.italic = jest.fn((text) => text);
  mockChalk.underline = jest.fn((text) => text);
  mockChalk.strikethrough = jest.fn((text) => text);
  mockChalk.reset = jest.fn((text) => text);
  mockChalk.inverse = jest.fn((text) => text);
  mockChalk.black = jest.fn((text) => text);
  mockChalk.redBright = jest.fn((text) => text);
  mockChalk.greenBright = jest.fn((text) => text);
  mockChalk.yellowBright = jest.fn((text) => text);
  mockChalk.blueBright = jest.fn((text) => text);
  mockChalk.magentaBright = jest.fn((text) => text);
  mockChalk.cyanBright = jest.fn((text) => text);
  mockChalk.whiteBright = jest.fn((text) => text);
  mockChalk.bgBlack = jest.fn((text) => text);
  mockChalk.bgRed = jest.fn((text) => text);
  mockChalk.bgGreen = jest.fn((text) => text);
  mockChalk.bgYellow = jest.fn((text) => text);
  mockChalk.bgBlue = jest.fn((text) => text);
  mockChalk.bgMagenta = jest.fn((text) => text);
  mockChalk.bgCyan = jest.fn((text) => text);
  mockChalk.bgWhite = jest.fn((text) => text);
  mockChalk.bgBlackBright = jest.fn((text) => text);
  mockChalk.bgRedBright = jest.fn((text) => text);
  mockChalk.bgGreenBright = jest.fn((text) => text);
  mockChalk.bgYellowBright = jest.fn((text) => text);
  mockChalk.bgBlueBright = jest.fn((text) => text);
  mockChalk.bgMagentaBright = jest.fn((text) => text);
  mockChalk.bgCyanBright = jest.fn((text) => text);
  mockChalk.bgWhiteBright = jest.fn((text) => text);
  return mockChalk;
});

// Mock encryption helpers BEFORE requiring secrets
jest.mock('../../../lib/utils/secrets-encryption', () => {
  return {
    decryptSecret: jest.fn((val) => `decrypted(${val})`),
    isEncrypted: (val) => typeof val === 'string' && val.startsWith('secure://')
  };
});

// Mock config and dev-config BEFORE requiring secrets
jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue(1),
  setDeveloperId: jest.fn().mockResolvedValue(),
  getConfig: jest.fn().mockResolvedValue({ 'developer-id': 1 }),
  saveConfig: jest.fn().mockResolvedValue(),
  clearConfig: jest.fn().mockResolvedValue(),
  getSecretsEncryptionKey: jest.fn().mockResolvedValue(null),
  setSecretsEncryptionKey: jest.fn().mockResolvedValue(),
  getSecretsPath: jest.fn().mockResolvedValue(null),
  setSecretsPath: jest.fn().mockResolvedValue(),
  CONFIG_DIR: '/mock/config/dir',
  CONFIG_FILE: '/mock/config/dir/config.yaml'
}));

// Require config after mock is defined
const config = require('../../../lib/core/config');

jest.mock('../../../lib/utils/dev-config', () => ({
  getDevPorts: jest.fn((devId) => {
    const offset = devId * 100;
    return {
      postgres: 5432 + offset,
      redis: 6379 + offset
    };
  }),
  getBasePorts: jest.fn(() => ({
    app: 3000,
    postgres: 5432,
    redis: 6379,
    pgadmin: 5050,
    redisCommander: 8081
  }))
}));

// Mock env-config-loader for buildEnvVarMap
const mockEnvConfig = {
  environments: {
    local: {
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379'
    },
    docker: {
      DB_HOST: 'postgres',
      DB_PORT: '5432',
      REDIS_HOST: 'redis',
      REDIS_PORT: '6379'
    }
  }
};

// Don't mock env-config-loader - let it use real implementation with fs mocks
// The tests set up fs.readFileSync to return env-config.yaml content

const secrets = require('../../../lib/core/secrets');
const localSecrets = require('../../../lib/utils/local-secrets');

// Mock fs module
jest.mock('fs');
jest.mock('os');
jest.mock('../../../lib/utils/paths', () => {
  const pathMod = require('path');
  return {
    getAifabrixHome: jest.fn(),
    getBuilderPath: jest.fn((appName) => pathMod.join(process.cwd(), 'builder', appName))
  };
});
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

describe('Secrets Module', () => {
  const mockHomeDir = '/home/test';
  const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
  const mockAdminSecretsPath = path.join(mockHomeDir, '.aifabrix', 'admin-secrets.env');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
    const pathsUtil = require('../../../lib/utils/paths');
    pathsUtil.getAifabrixHome.mockReturnValue(path.join(mockHomeDir, '.aifabrix'));

    // Default mock for env-config.yaml used by loadEnvConfig
    fs.existsSync.mockImplementation((filePath) => {
      if (filePath && filePath.includes('env-config.yaml')) {
        return true;
      }
      // Return false for auto-detected paths (so tests use default path)
      if (filePath && (filePath.includes('aifabrix-setup') || filePath.includes('secrets.local.yaml'))) {
        return false;
      }
      return false;
    });
    fs.readFileSync.mockImplementation((filePath) => {
      if (filePath && filePath.includes('env-config.yaml')) {
        return `
environments:
  local:
    DB_HOST: localhost
    REDIS_HOST: localhost
  docker:
    DB_HOST: postgres
    REDIS_HOST: redis
`;
      }
      return '';
    });
  });

  describe('loadSecrets', () => {
    it('should load secrets from default path when no path provided', async() => {
      const mockSecrets = { 'postgres-passwordKeyVault': 'admin123' };
      const defaultSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockImplementation((filePath) => {
        // Return false for auto-detected paths (so it falls back to default)
        if (filePath && (filePath.includes('aifabrix-setup') || filePath.includes('secrets.local.yaml'))) {
          return false;
        }
        // Return true for default secrets path
        if (filePath === defaultSecretsPath || filePath.includes('.aifabrix')) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockReturnValue('postgres-passwordKeyVault: "admin123"');

      const result = await secrets.loadSecrets();

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalledWith(defaultSecretsPath, 'utf8');
      expect(result).toEqual(mockSecrets);
    });

    it('should load secrets from provided path', async() => {
      const customPath = '../../secrets.local.yaml';
      const resolvedPath = path.resolve(process.cwd(), customPath);
      const mockSecrets = { 'redis-passwordKeyVault': 'redis123' };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('redis-passwordKeyVault: "redis123"');

      const result = await secrets.loadSecrets(customPath);

      expect(fs.existsSync).toHaveBeenCalledWith(resolvedPath);
      expect(result).toEqual(mockSecrets);
    });

    it('should throw error if secrets file not found', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(secrets.loadSecrets('nonexistent.yaml')).rejects.toThrow('Secrets file not found');
    });

    it('should throw error if secrets file has invalid format', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid yaml content');

      await expect(secrets.loadSecrets()).rejects.toThrow('Invalid secrets file format');
    });

    it('should throw error if explicit path secrets file has invalid format', async() => {
      const customPath = '../../secrets.local.yaml';
      const resolvedPath = path.resolve(process.cwd(), customPath);

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid yaml content');

      await expect(secrets.loadSecrets(customPath)).rejects.toThrow(`Invalid secrets file format: ${resolvedPath}`);
    });

    it('should throw error if secrets file contains null', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('null');

      await expect(secrets.loadSecrets()).rejects.toThrow('Invalid secrets file format');
    });

    it('should throw error if secrets file contains non-object', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('"just a string"');

      await expect(secrets.loadSecrets()).rejects.toThrow('Invalid secrets file format');
    });
  });

  describe('resolveKvReferences', () => {
    const mockSecrets = {
      'postgres-passwordKeyVault': 'admin123',
      'redis-urlKeyVault': 'redis://${REDIS_HOST}:6379'
    };

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
environments:
  local:
    REDIS_HOST: localhost
    DB_HOST: localhost
`);
    });

    it('should resolve kv:// references with secrets', async() => {
      const template = 'DATABASE_URL=kv://postgres-passwordKeyVault';

      const result = await secrets.resolveKvReferences(template, mockSecrets);

      expect(result).toBe('DATABASE_URL=admin123');
    });

    it('should resolve environment variables in secret values', async() => {
      const template = 'REDIS_URL=kv://redis-urlKeyVault';

      const result = await secrets.resolveKvReferences(template, mockSecrets);

      expect(result).toBe('REDIS_URL=redis://localhost:6379');
    });

    it('should throw error for missing secrets with file path', async() => {
      const template = 'SECRET=kv://missing-secret';
      const userPath = '/home/test/.aifabrix/secrets.local.yaml';

      await expect(
        secrets.resolveKvReferences(template, mockSecrets, 'local', { userPath, buildPath: null })
      ).rejects.toThrow('Missing secrets: kv://missing-secret');

      const error = await secrets.resolveKvReferences(template, mockSecrets, 'local', { userPath, buildPath: null })
        .catch(e => e);
      expect(error.message).toContain('Secrets file location: /home/test/.aifabrix/secrets.local.yaml');
    });

    it('should throw error for missing secrets with both file paths when buildPath is configured', async() => {
      const template = 'SECRET=kv://missing-secret';
      const userPath = '/home/test/.aifabrix/secrets.local.yaml';
      const buildPath = '/project/builder/secrets.local.yaml';

      const error = await secrets.resolveKvReferences(template, mockSecrets, 'local', { userPath, buildPath })
        .catch(e => e);
      expect(error.message).toContain('Missing secrets: kv://missing-secret');
      expect(error.message).toContain('Secrets file location: /home/test/.aifabrix/secrets.local.yaml and /project/builder/secrets.local.yaml');
    });

    it('should handle backward compatibility with string path', async() => {
      const template = 'SECRET=kv://missing-secret';
      const stringPath = '/home/test/.aifabrix/secrets.local.yaml';

      const error = await secrets.resolveKvReferences(template, mockSecrets, 'local', stringPath)
        .catch(e => e);
      expect(error.message).toContain('Secrets file location: /home/test/.aifabrix/secrets.local.yaml');
    });

    it('should use docker environment when specified', async() => {
      fs.readFileSync.mockReturnValue(`
environments:
  docker:
    REDIS_HOST: redis
  local:
    REDIS_HOST: localhost
`);

      const template = 'REDIS_URL=kv://redis-urlKeyVault';

      const result = await secrets.resolveKvReferences(template, mockSecrets, 'docker');

      expect(result).toBe('REDIS_URL=redis://redis:6379');
    });
  });

  describe('generateEnvFile', () => {
    const mockSecrets = { 'postgres-passwordKeyVault': 'admin123' };
    const appName = 'testapp';
    const builderPath = path.join(process.cwd(), 'builder', appName);

    beforeEach(() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') || filePath.includes('secrets.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'DATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });
    });

    it('should generate .env file from template', async() => {
      const result = await secrets.generateEnvFile(appName);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const call = fs.writeFileSync.mock.calls.find(c => c[0] === path.join(builderPath, '.env'));
      expect(call).toBeDefined();
      const written = call[1];
      expect(written).toContain('DATABASE_URL=admin123');
      // With dev-id 1 mocked in this test file, PORT should be appended (+100)
      expect(written).toMatch(/^PORT=3100$/m);
      expect(result).toBe(path.join(builderPath, '.env'));
    });

    it('should copy .env to envOutputPath if specified in variables.yaml', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return `
build:
  envOutputPath: ../app/.env
port: 3000
`;
        }
        if (filePath.includes('env.template')) {
          return 'PORT=3000\nDATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('.env')) {
          // Return content when reading the generated .env file
          return 'PORT=3000\nDATABASE_URL=postgres://localhost';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw error if env.template not found', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(secrets.generateEnvFile(appName)).rejects.toThrow('env.template not found');
    });
  });

  describe('generateAdminSecretsEnv', () => {
    const mockSecrets = { 'postgres-passwordKeyVault': 'admin123' };

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('postgres-passwordKeyVault: "admin123"');
    });

    it('should generate admin-secrets.env file', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('secrets.yaml');
      });

      const result = await secrets.generateAdminSecretsEnv();

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(mockHomeDir, '.aifabrix'), { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockAdminSecretsPath,
        expect.stringContaining('POSTGRES_PASSWORD=admin123'),
        { mode: 0o600 }
      );
      expect(result).toBe(mockAdminSecretsPath);
    });

    it('should create .aifabrix directory if it does not exist', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('secrets.yaml');
      });

      await secrets.generateAdminSecretsEnv();

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(mockHomeDir, '.aifabrix'), { recursive: true, mode: 0o700 });
    });
  });

  describe('validateSecrets', () => {
    const mockSecrets = { 'postgres-passwordKeyVault': 'admin123' };

    it('should return valid true when all secrets are present', () => {
      const template = 'DATABASE_URL=kv://postgres-passwordKeyVault';

      const result = secrets.validateSecrets(template, mockSecrets);

      expect(result).toEqual({ valid: true, missing: [] });
    });

    it('should return valid false when secrets are missing', () => {
      const template = 'SECRET1=kv://postgres-passwordKeyVault\nSECRET2=kv://missing-secret';

      const result = secrets.validateSecrets(template, mockSecrets);

      expect(result).toEqual({ valid: false, missing: ['kv://missing-secret'] });
    });

    it('should handle multiple missing secrets', () => {
      const template = 'SECRET1=kv://missing1\nSECRET2=kv://missing2';

      const result = secrets.validateSecrets(template, mockSecrets);

      expect(result).toEqual({ valid: false, missing: ['kv://missing1', 'kv://missing2'] });
    });
  });

  describe('createDefaultSecrets', () => {
    it('should create default secrets file', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      await secrets.createDefaultSecrets(secretsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(resolvedPath), { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('postgres-passwordKeyVault: "admin123"'),
        { mode: 0o600 }
      );
    });

    it('should handle absolute paths', async() => {
      const secretsPath = '/custom/path/secrets.yaml';

      await secrets.createDefaultSecrets(secretsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/custom/path', { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(secretsPath, expect.any(String), { mode: 0o600 });
    });
  });

  describe('loadSecrets - branch coverage', () => {
    it('should resolve relative path starting with ..', async() => {
      const customPath = '../../secrets.local.yaml';
      const resolvedPath = path.resolve(process.cwd(), customPath);
      const mockSecrets = { 'redis-passwordKeyVault': 'redis123' };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('redis-passwordKeyVault: "redis123"');

      const result = await secrets.loadSecrets(customPath);

      expect(fs.existsSync).toHaveBeenCalledWith(resolvedPath);
      expect(result).toEqual(mockSecrets);
    });

    it('should handle loadSecrets with non-relative path', async() => {
      const customPath = '/absolute/path/secrets.yaml';
      const mockSecrets = { 'redis-passwordKeyVault': 'redis123' };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('redis-passwordKeyVault: "redis123"');

      const result = await secrets.loadSecrets(customPath);

      expect(fs.existsSync).toHaveBeenCalledWith(customPath);
      expect(result).toEqual(mockSecrets);
    });
  });

  describe('resolveKvReferences - branch coverage', () => {
    const mockSecrets = {
      'postgres-passwordKeyVault': 'admin123',
      'redis-urlKeyVault': 'redis://${REDIS_HOST}:6379',
      'non-string-secret': 12345
    };

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
environments:
  local:
    REDIS_HOST: localhost
    DB_HOST: localhost
`);
    });

    it('should fallback to local environment when specified environment does not exist', async() => {
      const template = 'REDIS_URL=kv://redis-urlKeyVault';

      const result = await secrets.resolveKvReferences(template, mockSecrets, 'nonexistent');

      expect(result).toBe('REDIS_URL=redis://localhost:6379');
    });

    it('should handle non-string secret values', async() => {
      const template = 'SECRET=kv://non-string-secret';

      const result = await secrets.resolveKvReferences(template, mockSecrets);

      expect(result).toBe('SECRET=12345');
    });

    it('should handle ${VAR} references in template', async() => {
      fs.readFileSync.mockReturnValue(`
environments:
  local:
    DB_HOST: localhost
`);
      const template = 'DATABASE_URL=postgresql://user:pass@${DB_HOST}:5432/db';

      const result = await secrets.resolveKvReferences(template, mockSecrets);

      expect(result).toBe('DATABASE_URL=postgresql://user:pass@localhost:5432/db');
    });

    it('should handle ${VAR} references that do not exist in env vars', async() => {
      const template = 'VAR=${NONEXISTENT}';

      const result = await secrets.resolveKvReferences(template, mockSecrets);

      expect(result).toBe('VAR=${NONEXISTENT}');
    });

    it('should replace ${VAR} references inside secret values', async() => {
      fs.readFileSync.mockReturnValue(`
environments:
  local:
    DB_HOST: localhost
    REDIS_HOST: localhost
`);
      const mockSecretsWithVar = {
        'database-urlKeyVault': 'postgresql://user:pass@${DB_HOST}:5432/db',
        'redis-urlKeyVault': 'redis://${REDIS_HOST}:6379'
      };
      const template = 'DATABASE_URL=kv://database-urlKeyVault\nREDIS_URL=kv://redis-urlKeyVault';

      const result = await secrets.resolveKvReferences(template, mockSecretsWithVar);

      expect(result).toContain('DATABASE_URL=postgresql://user:pass@localhost:5432/db');
      expect(result).toContain('REDIS_URL=redis://localhost:6379');
    });

    it('should handle ${VAR} references inside secret values that do not exist', async() => {
      fs.readFileSync.mockReturnValue(`
environments:
  local:
    DB_HOST: localhost
`);
      const mockSecretsWithVar = {
        'database-urlKeyVault': 'postgresql://user:pass@${NONEXISTENT_HOST}:5432/db'
      };
      const template = 'DATABASE_URL=kv://database-urlKeyVault';

      const result = await secrets.resolveKvReferences(template, mockSecretsWithVar);

      expect(result).toContain('DATABASE_URL=postgresql://user:pass@${NONEXISTENT_HOST}:5432/db');
    });

    describe('Variable interpolation with developer-id adjusted ports', () => {
      it('should interpolate ${DB_PORT} with developer-id adjustment in secret values (dev-id 1)', async() => {
        fs.readFileSync.mockReturnValue(`
environments:
  local:
    DB_HOST: localhost
    DB_PORT: 5432
`);
        const mockSecretsWithPort = {
          'database-urlKeyVault': 'postgresql://user:pass@${DB_HOST}:${DB_PORT}/db'
        };
        const template = 'DATABASE_URL=kv://database-urlKeyVault';

        config.getDeveloperId.mockResolvedValue('1');

        const result = await secrets.resolveKvReferences(template, mockSecretsWithPort, 'local');

        // DB_PORT should be adjusted: 5432 + 100 = 5532
        expect(result).toContain('DATABASE_URL=postgresql://user:pass@localhost:5532/db');
      });

      it('should interpolate ${KEYCLOAK_PORT} with developer-id adjustment in secret values (dev-id 1)', async() => {
        fs.readFileSync.mockReturnValue(`
environments:
  local:
    KEYCLOAK_HOST: localhost
    KEYCLOAK_PORT: 8082
`);
        const mockSecretsWithPort = {
          'keycloak-server-urlKeyVault': 'http://${KEYCLOAK_HOST}:${KEYCLOAK_PORT}'
        };
        const template = 'KEYCLOAK_SERVER_URL=kv://keycloak-server-urlKeyVault';

        config.getDeveloperId.mockResolvedValue('1');

        const result = await secrets.resolveKvReferences(template, mockSecretsWithPort, 'local');

        // KEYCLOAK_PORT should be adjusted: 8082 + 100 = 8182
        expect(result).toContain('KEYCLOAK_SERVER_URL=http://localhost:8182');
      });

      it('should interpolate ${VAR} directly in env.template with developer-id adjustment (dev-id 1)', async() => {
        fs.readFileSync.mockReturnValue(`
environments:
  local:
    KEYCLOAK_PORT: 8082
    DB_PORT: 5432
`);
        const template = 'KC_PORT=${KEYCLOAK_PORT}\nDATABASE_PORT=${DB_PORT}';

        config.getDeveloperId.mockResolvedValue('1');

        const result = await secrets.resolveKvReferences(template, {}, 'local');

        // Ports should be adjusted
        expect(result).toMatch(/^KC_PORT=8182$/m); // 8082 + 100
        expect(result).toMatch(/^DATABASE_PORT=5532$/m); // 5432 + 100
      });

      it('should not apply developer-id adjustment for docker context', async() => {
        fs.readFileSync.mockReturnValue(`
environments:
  docker:
    DB_HOST: postgres
    DB_PORT: 5432
`);
        const mockSecretsWithPort = {
          'database-urlKeyVault': 'postgresql://user:pass@${DB_HOST}:${DB_PORT}/db'
        };
        const template = 'DATABASE_URL=kv://database-urlKeyVault';

        config.getDeveloperId.mockResolvedValue('1');

        const result = await secrets.resolveKvReferences(template, mockSecretsWithPort, 'docker');

        // DB_PORT should NOT be adjusted for docker
        expect(result).toContain('DATABASE_URL=postgresql://user:pass@postgres:5432/db');
      });

      it('should interpolate ${KEYCLOAK_PUBLIC_PORT} in secret value for docker context with developer-id 6', async() => {
        fs.readFileSync.mockReturnValue(`
environments:
  docker:
    KEYCLOAK_PORT: 8082
  local:
    KEYCLOAK_HOST: localhost
`);
        config.getDeveloperId.mockResolvedValue(6);
        const mockSecrets = {
          'keycloak-public-server-urlKeyVault': 'http://localhost:${KEYCLOAK_PUBLIC_PORT}'
        };
        const template = 'KEYCLOAK_PUBLIC_SERVER_URL=kv://keycloak-public-server-urlKeyVault';

        const result = await secrets.resolveKvReferences(template, mockSecrets, 'docker');

        // KEYCLOAK_PUBLIC_PORT = 8082 + 6*100 = 8682
        expect(result).toContain('KEYCLOAK_PUBLIC_SERVER_URL=http://localhost:8682');
      });
    });

    it('should handle multiple kv:// references in template', async() => {
      fs.readFileSync.mockReturnValue(`
environments:
  local:
    DB_HOST: localhost
`);
      const mockSecrets = {
        'secret1': 'value1',
        'secret2': 'value2',
        'secret3': 'value3'
      };
      const template = 'KEY1=kv://secret1\nKEY2=kv://secret2\nKEY3=kv://secret3';

      const result = await secrets.resolveKvReferences(template, mockSecrets);

      expect(result).toContain('KEY1=value1');
      expect(result).toContain('KEY2=value2');
      expect(result).toContain('KEY3=value3');
    });

    it('should handle ${VAR} references in template before kv:// resolution', async() => {
      fs.readFileSync.mockReturnValue(`
environments:
  local:
    DB_HOST: localhost
    APP_NAME: myapp
`);
      const mockSecrets = {
        'database-passwordKeyVault': 'admin123'
      };
      const template = 'APP_NAME=${APP_NAME}\nDATABASE_URL=postgresql://user:pass@${DB_HOST}:5432/db\nPASSWORD=kv://database-passwordKeyVault';

      const result = await secrets.resolveKvReferences(template, mockSecrets);

      expect(result).toContain('APP_NAME=myapp');
      expect(result).toContain('DATABASE_URL=postgresql://user:pass@localhost:5432/db');
      expect(result).toContain('PASSWORD=admin123');
    });
  });

  describe('generateMissingSecrets - branch coverage', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
environments:
  local:
    REDIS_HOST: localhost
`);
    });

    it('should generate database password for databases-{app}-{index}-passwordKeyVault format', async() => {
      const template = 'DATABASE_PASSWORD=kv://databases-myapp-0-passwordKeyVault';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === secretsPath;
      });
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === secretsPath);
      expect(writeCall[1]).toContain('myapp_pass123');
    });

    it('should generate database URL for databases-{app}-{index}-urlKeyVault format', async() => {
      const template = 'DATABASE_URL=kv://databases-myapp-0-urlKeyVault';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === secretsPath;
      });
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === secretsPath);
      expect(writeCall[1]).toContain('postgresql://myapp_user:myapp_pass123');
    });

    it('should generate random password for generic password key', async() => {
      const template = 'PASSWORD=kv://some-password-key';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === secretsPath;
      });
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === secretsPath);
      expect(writeCall[1]).toMatch(/some-password-key:/);
    });

    it('should generate empty string for URL keys that are not database URLs', async() => {
      const template = 'API_URL=kv://some-url-key';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === secretsPath;
      });
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === secretsPath);
      expect(writeCall[1]).toMatch(/some-url-key: ''/);
    });

    it('should generate random key for key/secret/token patterns', async() => {
      const template = 'API_KEY=kv://some-api-key';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === secretsPath;
      });
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle existing secrets file with invalid YAML', async() => {
      const template = 'PASSWORD=kv://some-password';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid yaml');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle error when reading existing secrets file', async() => {
      const template = 'PASSWORD=kv://some-password';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle secret key that does not match any pattern', async() => {
      const template = 'CUSTOM_VALUE=kv://some-unknown-value-setting';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === secretsPath);
      expect(writeCall[1]).toMatch(/some-unknown-value-setting: ''/);
    });

    it('should handle existing secrets file with non-object YAML', async() => {
      const template = 'PASSWORD=kv://some-password';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('123');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async() => {
      const template = 'PASSWORD=kv://some-password';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        return filePath === secretsPath;
      });
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(secretsPath), { recursive: true, mode: 0o700 });
    });

    it('should return empty array when no missing keys', async() => {
      const template = 'EXISTING=kv://existing-secret';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('existing-secret: "value"');

      const result = await secrets.generateMissingSecrets(template, secretsPath);

      expect(result).toEqual([]);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should handle secrets file that does not exist', async() => {
      const template = 'PASSWORD=kv://some-password';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(false);

      const result = await secrets.generateMissingSecrets(template, secretsPath);

      expect(result).toEqual(['some-password']);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle empty secrets file', async() => {
      const template = 'PASSWORD=kv://some-password';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle duplicate kv:// references in template', async() => {
      const template = 'PASSWORD1=kv://same-secret\nPASSWORD2=kv://same-secret';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(false);

      const result = await secrets.generateMissingSecrets(template, secretsPath);

      expect(result).toEqual(['same-secret']);
    });

    it('should generate default secret for keys containing token', async() => {
      const template = 'API_TOKEN=kv://some-api-token-key';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === secretsPath);
      expect(writeCall[1]).toMatch(/some-api-token-key:/);
    });

    it('should merge new secrets with existing ones', async() => {
      const template = 'NEW_SECRET=kv://new-secret';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      const existingSecrets = { 'existing-secret': 'existing-value' };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(existingSecrets));

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === secretsPath);
      const writtenContent = writeCall[1];
      expect(writtenContent).toContain('existing-secret');
      expect(writtenContent).toContain('new-secret');
    });

    it('should handle app name with hyphens in database password generation', async() => {
      const template = 'DATABASE_PASSWORD=kv://databases-my-app-name-0-passwordKeyVault';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === secretsPath);
      expect(writeCall[1]).toContain('my_app_name_pass123');
    });

    it('should handle app name with hyphens in database URL generation', async() => {
      const template = 'DATABASE_URL=kv://databases-my-app-name-0-urlKeyVault';
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === secretsPath);
      expect(writeCall[1]).toContain('postgresql://my_app_name_user:my_app_name_pass123');
    });

    it('should handle default secrets path when not provided', async() => {
      const template = 'PASSWORD=kv://some-password';

      fs.existsSync.mockReturnValue(false);
      fs.readFileSync.mockReturnValue('');

      await secrets.generateMissingSecrets(template);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === mockSecretsPath);
      expect(writeCall).toBeDefined();
    });
  });

  describe('generateEnvFile - branch coverage', () => {
    const appName = 'testapp';
    const builderPath = path.join(process.cwd(), 'builder', appName);

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'DATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });
    });

    it('should not copy .env when envOutputPath is null', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return `
build:
  envOutputPath: null
`;
        }
        if (filePath.includes('env.template')) {
          return 'DATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName);

      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should handle envOutputPath ending with .env', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml');
      });
      if (!fs.statSync) {
        fs.statSync = jest.fn();
      }
      fs.statSync.mockReturnValue({ isDirectory: () => false });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return `
build:
  envOutputPath: ../app/.env
port: 3000
`;
        }
        if (filePath.includes('env.template')) {
          return 'PORT=3000\nDATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('.env')) {
          return 'PORT=3000\nDATABASE_URL=postgres://localhost';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle envOutputPath pointing to existing directory', async() => {
      const outputPath = path.resolve(builderPath, '../app');
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template') ||
            filePath.includes('variables.yaml') ||
            filePath.includes('secrets.yaml')) {
          return true;
        }
        if (filePath === outputPath) {
          return true;
        }
        return false;
      });
      if (!fs.statSync) {
        fs.statSync = jest.fn();
      }
      fs.statSync.mockImplementation((filePath) => {
        if (filePath === outputPath) {
          return { isDirectory: () => true };
        }
        return { isDirectory: () => false };
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return `
build:
  envOutputPath: ../app
port: 3000
`;
        }
        if (filePath.includes('env.template')) {
          return 'PORT=3000\nDATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('.env')) {
          return 'PORT=3000\nDATABASE_URL=postgres://localhost';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName);

      expect(fs.statSync).toHaveBeenCalledWith(outputPath);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should generate missing secrets when force flag is true', async() => {
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      let secretsFileExists = false;
      let generatedSecrets = '';
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === secretsPath) {
          return secretsFileExists;
        }
        return filePath.includes('env.template');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'DATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath === secretsPath && secretsFileExists) {
          return generatedSecrets || 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });
      fs.writeFileSync.mockImplementation((filePath, content) => {
        if (filePath === secretsPath) {
          secretsFileExists = true;
          generatedSecrets = content;
        }
      });

      await secrets.generateEnvFile(appName, secretsPath, 'local', true);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should not overwrite existing secrets when force flag is true', async() => {
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const existingSecrets = {
        'secrets-encryptionKeyVault': 'existing-value-12345',
        'postgres-passwordKeyVault': 'admin123'
      };
      let secretsFileContent = yaml.dump(existingSecrets);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath && filePath.includes('env-config.yaml')) {
          return true;
        }
        // Always return true for secretsPath to simulate file exists
        if (filePath === secretsPath || (filePath && filePath.includes('secrets.local.yaml') && !filePath.includes('aifabrix-setup'))) {
          return true;
        }
        return filePath && (filePath.includes('env.template') || filePath.includes('variables.yaml'));
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath && filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    DB_HOST: localhost
    REDIS_HOST: localhost
  docker:
    DB_HOST: postgres
    REDIS_HOST: redis
`;
        }
        if (filePath && filePath.includes('env.template')) {
          return 'ENCRYPTION_KEY=kv://secrets-encryptionKeyVault\nDATABASE_URL=kv://postgres-passwordKeyVault\nNEW_KEY=kv://new-secretKeyVault';
        }
        if (filePath === secretsPath || (filePath && filePath.includes('secrets.local.yaml') && !filePath.includes('aifabrix-setup'))) {
          return secretsFileContent;
        }
        if (filePath && filePath.includes('variables.yaml')) {
          return 'port: 3000';
        }
        return '';
      });
      let writtenSecrets = null;
      fs.writeFileSync.mockImplementation((filePath, content) => {
        if (filePath === secretsPath || (filePath && filePath.includes('secrets.local.yaml') && !filePath.includes('aifabrix-setup'))) {
          writtenSecrets = yaml.load(content);
          // Update the file content so subsequent reads return the updated secrets
          secretsFileContent = content;
        }
      });

      await secrets.generateEnvFile(appName, undefined, 'local', true);

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(writtenSecrets).toBeDefined();
      // Existing secret should be preserved
      expect(writtenSecrets['secrets-encryptionKeyVault']).toBe('existing-value-12345');
      expect(writtenSecrets['postgres-passwordKeyVault']).toBe('admin123');
      // New secret should be generated
      expect(writtenSecrets['new-secretKeyVault']).toBeDefined();
    });

    it('should use consistent path resolution for read and write operations', async() => {
      const overrideHome = '/custom/aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.local.yaml');
      const pathsUtil = require('../../../lib/utils/paths');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);
      const existingSecrets = {
        'postgres-passwordKeyVault': 'admin123'
      };
      let secretsFileContent = yaml.dump(existingSecrets);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath && filePath.includes('env-config.yaml')) {
          return true;
        }
        if (filePath === overrideSecretsPath || (filePath && filePath.includes('secrets.local.yaml') && !filePath.includes('aifabrix-setup'))) {
          return true;
        }
        return filePath && (filePath.includes('env.template') || filePath.includes('variables.yaml'));
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath && filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    DB_HOST: localhost
    REDIS_HOST: localhost
  docker:
    DB_HOST: postgres
    REDIS_HOST: redis
`;
        }
        if (filePath && filePath.includes('env.template')) {
          return 'DATABASE_URL=kv://postgres-passwordKeyVault\nNEW_KEY=kv://new-secretKeyVault';
        }
        if (filePath === overrideSecretsPath || (filePath && filePath.includes('secrets.local.yaml') && !filePath.includes('aifabrix-setup'))) {
          return secretsFileContent;
        }
        if (filePath && filePath.includes('variables.yaml')) {
          return 'port: 3000';
        }
        return '';
      });
      let writtenPath = null;
      fs.writeFileSync.mockImplementation((filePath, content) => {
        if (filePath === overrideSecretsPath || (filePath && filePath.includes('secrets.local.yaml') && !filePath.includes('aifabrix-setup'))) {
          writtenPath = filePath;
          secretsFileContent = content;
        }
      });

      await secrets.generateEnvFile(appName, undefined, 'local', true);

      // Verify that the same path was used for both read and write
      expect(writtenPath).toBe(overrideSecretsPath);
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
    });

    it('should use explicit path when provided', async() => {
      const explicitPathRelative = '../../secrets.local.yaml';
      const explicitPath = path.resolve(process.cwd(), explicitPathRelative);
      const existingSecrets = {
        'postgres-passwordKeyVault': 'admin123'
      };
      let secretsFileContent = yaml.dump(existingSecrets);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath && filePath.includes('env-config.yaml')) {
          return true;
        }
        // Resolve paths for comparison - handle both relative and absolute paths
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
        const resolvedExplicit = path.resolve(explicitPath);
        if (resolvedPath === resolvedExplicit || filePath === explicitPath || filePath === explicitPathRelative) {
          return true;
        }
        return filePath && (filePath.includes('env.template') || filePath.includes('variables.yaml'));
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath && filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    DB_HOST: localhost
    REDIS_HOST: localhost
  docker:
    DB_HOST: postgres
    REDIS_HOST: redis
`;
        }
        // Resolve paths for comparison
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
        const resolvedExplicit = path.resolve(explicitPath);
        if (filePath && filePath.includes('env.template')) {
          // Include a missing secret so generateMissingSecrets will write
          return 'DATABASE_URL=kv://postgres-passwordKeyVault\nNEW_KEY=kv://new-secretKeyVault';
        }
        if (resolvedPath === resolvedExplicit || filePath === explicitPath || filePath === explicitPathRelative) {
          return secretsFileContent;
        }
        if (filePath && filePath.includes('variables.yaml')) {
          return 'port: 3000';
        }
        return '';
      });
      let writtenPath = null;
      fs.writeFileSync.mockImplementation((filePath, content) => {
        // Resolve paths for comparison - capture any path that matches
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
        const resolvedExplicit = path.resolve(explicitPath);
        if (resolvedPath === resolvedExplicit || filePath === explicitPath || filePath === explicitPathRelative || filePath.includes('secrets.local.yaml')) {
          writtenPath = filePath;
          secretsFileContent = content;
        }
      });

      await secrets.generateEnvFile(appName, explicitPathRelative, 'local', true);

      // Verify that the explicit path was used (check both absolute and relative)
      expect(writtenPath).toBeTruthy();
      const resolvedWritten = path.resolve(writtenPath);
      const resolvedExplicit = path.resolve(explicitPath);
      expect(resolvedWritten).toBe(resolvedExplicit);
    });

    it('should handle envOutputPath when output directory does not exist', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return `
build:
  envOutputPath: ../app/.env
port: 3000
`;
        }
        if (filePath.includes('env.template')) {
          return 'PORT=3000\nDATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('.env')) {
          return 'PORT=3000\nDATABASE_URL=postgres://localhost';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName);

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle envOutputPath when variables.yaml does not exist', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') || filePath.includes('secrets.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'DATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName);

      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should handle envOutputPath when build.envOutputPath is not set', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return 'build: {}';
        }
        if (filePath.includes('env.template')) {
          return 'DATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName);

      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should handle envOutputPath when path does not end with .env and directory does not exist', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('variables.yaml')) {
          return `
build:
  envOutputPath: ../app
port: 3000
`;
        }
        if (filePath.includes('env.template')) {
          return 'PORT=3000\nDATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('.env')) {
          return 'PORT=3000\nDATABASE_URL=postgres://localhost';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName);

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should use custom secretsPath when provided', async() => {
      const customSecretsPath = '../../custom/secrets.yaml';
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') || filePath.includes('secrets.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'DATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, customSecretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should use custom environment when provided', async() => {
      const defaultSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockImplementation((filePath) => {
        // Return true for env.template and the default secrets path
        if (filePath.includes('env.template')) {
          return true;
        }
        // Return false for auto-detected paths (so it falls back to default)
        if (filePath.includes('aifabrix-setup') || filePath.includes('secrets.local.yaml')) {
          return false;
        }
        // Return true for default secrets path
        if (filePath === defaultSecretsPath || filePath.includes('.aifabrix')) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'REDIS_URL=kv://redis-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'redis-urlKeyVault: "redis://${REDIS_HOST}:6379"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    REDIS_HOST: redis
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('generateEnvFile - newly resolved content wins over existing .env', () => {
    const appName = 'miso-controller';
    const builderEnvPath = path.join(process.cwd(), 'builder', appName, '.env');

    it('should use newly resolved secret values over existing .env so project secrets take effect', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === builderEnvPath || (String(filePath).includes('builder') && String(filePath).endsWith('.env'))) {
          return true;
        }
        if (filePath.includes('env.template') || filePath.includes('secrets.yaml') || filePath.includes('variables.yaml') || filePath.includes('env-config')) {
          return true;
        }
        return false;
      });
      const existingEnv = 'JWT_SECRET=existing-jwt-secret-keep\nPORT=3000\nREDIS_PASSWORD=existing-redis\nEXTRA_VAR=keep-this';
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === builderEnvPath || (String(filePath).includes('builder') && String(filePath).endsWith('.env'))) {
          return existingEnv;
        }
        if (filePath.includes('env.template')) {
          return 'JWT_SECRET=kv://jwt-secretKeyVault\nPORT=3000\nREDIS_PASSWORD=kv://redis-passwordKeyVault';
        }
        if (filePath.includes('secrets.yaml') || filePath.includes('secrets.local.yaml')) {
          return 'jwt-secretKeyVault: "newly-generated-jwt"\nredis-passwordKeyVault: "newly-generated-redis"';
        }
        if (filePath.includes('variables.yaml')) {
          return 'port: 3000';
        }
        if (filePath.includes('env-config.yaml')) {
          return 'environments:\n  docker: {}\n  local: {}';
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      const writeCalls = fs.writeFileSync.mock.calls;
      const envWrite = writeCalls.find(call => String(call[0]).endsWith('.env'));
      expect(envWrite).toBeDefined();
      const written = envWrite[1];
      expect(written).toContain('JWT_SECRET=newly-generated-jwt');
      expect(written).toContain('REDIS_PASSWORD=newly-generated-redis');
      expect(written).toContain('EXTRA_VAR=keep-this');
      expect(written).not.toContain('existing-jwt-secret-keep');
      expect(written).not.toContain('existing-redis');
    });
  });

  describe('generateEnvFile - port resolution for docker environment', () => {
    const appName = 'miso-controller';
    const builderPath = path.join(process.cwd(), 'builder', appName);

    beforeEach(() => {
      fs.existsSync.mockImplementation((filePath) => {
        // Return true for env.template, secrets.yaml, and keycloak variables.yaml
        if (filePath.includes('env.template') ||
            filePath.includes('secrets.yaml') ||
            filePath.includes('keycloak/variables.yaml')) {
          return true;
        }
        return false;
      });
    });

    it('should replace port in URLs with containerPort for docker environment', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        // Return true for env.template, secrets.yaml, and keycloak variables.yaml
        if (filePath.includes('env.template') ||
            filePath.includes('secrets.yaml') ||
            filePath.includes('keycloak/variables.yaml') ||
            filePath.includes('keycloak') && filePath.includes('variables.yaml')) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'KEYCLOAK_AUTH_SERVER_URL=kv://keycloak-auth-server-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'keycloak-auth-server-urlKeyVault: "http://${KEYCLOAK_HOST}:8082"';
        }
        if (filePath.includes('keycloak/variables.yaml') || (filePath.includes('keycloak') && filePath.includes('variables.yaml'))) {
          return `
port: 8082
build:
  containerPort: 8080
  localPort: 8082
`;
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
  local:
    KEYCLOAK_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      // Verify that the URL port was replaced with containerPort
      const writeCalls = fs.writeFileSync.mock.calls;
      const envContent = writeCalls.find(call => call[0].includes('.env'))?.[1];
      expect(envContent).toContain('KEYCLOAK_AUTH_SERVER_URL=http://keycloak:8080');
    });

    it('should not replace ports in local environment', async() => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'KEYCLOAK_AUTH_SERVER_URL=kv://keycloak-auth-server-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'keycloak-auth-server-urlKeyVault: "http://${KEYCLOAK_HOST}:8082"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
  local:
    KEYCLOAK_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'local');

      // Verify that the URL port was not changed in local environment
      const writeCalls = fs.writeFileSync.mock.calls;
      const envContent = writeCalls.find(call => call[0].includes('.env'))?.[1];
      expect(envContent).toContain('KEYCLOAK_AUTH_SERVER_URL=http://localhost:8082');
    });

    it('should fallback to port when containerPort not defined', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template') ||
            filePath.includes('secrets.yaml') ||
            (filePath.includes('keycloak') && filePath.includes('variables.yaml'))) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'KEYCLOAK_AUTH_SERVER_URL=kv://keycloak-auth-server-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'keycloak-auth-server-urlKeyVault: "http://${KEYCLOAK_HOST}:8082"';
        }
        if (filePath.includes('keycloak') && filePath.includes('variables.yaml')) {
          return `
port: 8080
build:
  localPort: 8082
`;
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
  local:
    KEYCLOAK_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      // Verify that the URL port was replaced with port (fallback)
      const writeCalls = fs.writeFileSync.mock.calls;
      const envContent = writeCalls.find(call => call[0].includes('.env'))?.[1];
      expect(envContent).toContain('KEYCLOAK_AUTH_SERVER_URL=http://keycloak:8080');
    });

    it('should keep original port when service variables.yaml not found', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        // Return false for keycloak variables.yaml
        if (filePath.includes('keycloak/variables.yaml')) {
          return false;
        }
        if (filePath.includes('env.template') || filePath.includes('secrets.yaml')) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'KEYCLOAK_AUTH_SERVER_URL=kv://keycloak-auth-server-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'keycloak-auth-server-urlKeyVault: "http://${KEYCLOAK_HOST}:8082"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
  local:
    KEYCLOAK_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      // Verify that the URL port was kept as original (service not found)
      const writeCalls = fs.writeFileSync.mock.calls;
      const envContent = writeCalls.find(call => call[0].includes('.env'))?.[1];
      expect(envContent).toContain('KEYCLOAK_AUTH_SERVER_URL=http://keycloak:8082');
    });

    it('should handle URLs without service hostnames (no change)', async() => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'EXTERNAL_API_URL=kv://external-api-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'external-api-urlKeyVault: "https://api.example.com:443"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
  local:
    KEYCLOAK_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      // Verify that external URLs are not changed
      const writeCalls = fs.writeFileSync.mock.calls;
      const envContent = writeCalls.find(call => call[0].includes('.env'))?.[1];
      expect(envContent).toContain('EXTERNAL_API_URL=https://api.example.com:443');
    });

    it('should handle multiple service URLs in same .env file', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template') ||
            filePath.includes('secrets.yaml') ||
            (filePath.includes('keycloak') && filePath.includes('variables.yaml')) ||
            (filePath.includes('miso-controller') && filePath.includes('variables.yaml'))) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'KEYCLOAK_URL=kv://keycloak-urlKeyVault\nMISO_URL=kv://miso-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return `keycloak-urlKeyVault: "http://\${KEYCLOAK_HOST}:8082"
miso-urlKeyVault: "http://\${MISO_HOST}:3010"`;
        }
        if (filePath.includes('keycloak') && filePath.includes('variables.yaml')) {
          return `
port: 8082
build:
  containerPort: 8080
`;
        }
        if (filePath.includes('miso-controller') && filePath.includes('variables.yaml')) {
          return `
port: 3010
build:
  containerPort: 3000
`;
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
    MISO_HOST: miso-controller
  local:
    KEYCLOAK_HOST: localhost
    MISO_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      // Verify that both URLs had their ports replaced
      const writeCalls = fs.writeFileSync.mock.calls;
      const envContent = writeCalls.find(call => call[0].includes('.env'))?.[1];
      expect(envContent).toContain('KEYCLOAK_URL=http://keycloak:8080');
      expect(envContent).toContain('MISO_URL=http://miso-controller:3000');
    });

    it('should preserve URL paths and query parameters', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template') ||
            filePath.includes('secrets.yaml') ||
            (filePath.includes('keycloak') && filePath.includes('variables.yaml'))) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'KEYCLOAK_URL=kv://keycloak-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'keycloak-urlKeyVault: "http://${KEYCLOAK_HOST}:8082/auth/realms/master?param=value"';
        }
        if (filePath.includes('keycloak') && filePath.includes('variables.yaml')) {
          return `
port: 8082
build:
  containerPort: 8080
`;
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
  local:
    KEYCLOAK_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      // Verify that path and query params are preserved
      const writeCalls = fs.writeFileSync.mock.calls;
      const envContent = writeCalls.find(call => call[0].includes('.env'))?.[1];
      expect(envContent).toContain('KEYCLOAK_URL=http://keycloak:8080/auth/realms/master?param=value');
    });
  });

  describe('generateAdminSecretsEnv - branch coverage', () => {
    it('should handle error when secrets file does not exist but path exists', async() => {
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === secretsPath;
      });
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(secrets.generateAdminSecretsEnv()).rejects.toThrow();
    });

    it('should create default secrets when file does not exist', async() => {
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      let secretsFileExists = false;
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === secretsPath) {
          return secretsFileExists;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === secretsPath && secretsFileExists) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        throw new Error('File not found');
      });
      fs.writeFileSync.mockImplementation((filePath) => {
        if (filePath === secretsPath) {
          secretsFileExists = true;
        }
      });

      const result = await secrets.generateAdminSecretsEnv();

      expect(result).toBe(mockAdminSecretsPath);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should use empty string when postgres-passwordKeyVault is missing', async() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('other-key: "value"');

      const result = await secrets.generateAdminSecretsEnv();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockAdminSecretsPath,
        expect.stringContaining('POSTGRES_PASSWORD='),
        { mode: 0o600 }
      );
    });

    it('should use custom secretsPath when provided', async() => {
      const customSecretsPath = '../../custom/secrets.yaml';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('postgres-passwordKeyVault: "admin123"');

      await secrets.generateAdminSecretsEnv(customSecretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle error when creating default secrets fails', async() => {
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === secretsPath;
      });
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(secrets.generateAdminSecretsEnv()).rejects.toThrow();
    });
  });

  describe('createDefaultSecrets - branch coverage', () => {
    beforeEach(() => {
      // Reset writeFileSync mock to default implementation
      fs.writeFileSync.mockImplementation(() => {});
    });

    it('should handle path without ~ prefix', async() => {
      const secretsPath = '/absolute/path/secrets.yaml';

      await secrets.createDefaultSecrets(secretsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith('/absolute/path', { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(secretsPath, expect.any(String), { mode: 0o600 });
    });

    it('should create directory if it does not exist', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(false);

      await secrets.createDefaultSecrets(secretsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(resolvedPath), { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should write default secrets content', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      fs.existsSync.mockReturnValue(true);

      await secrets.createDefaultSecrets(secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('postgres-passwordKeyVault: "admin123"'),
        { mode: 0o600 }
      );
    });

    it('should include all default secrets in output', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

      await secrets.createDefaultSecrets(secretsPath);

      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === resolvedPath);
      const content = writeCall[1];

      expect(content).toContain('postgres-passwordKeyVault');
      expect(content).toContain('redis-passwordKeyVault');
      expect(content).toContain('redis-urlKeyVault');
      expect(content).toContain('keycloak-admin-passwordKeyVault');
      expect(content).toContain('keycloak-auth-server-urlKeyVault');
    });
  });

  describe('loadSecrets - cascading lookup', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      os.homedir.mockReturnValue(mockHomeDir);
    });

    it('should use canonical aifabrix-secrets when user and build secrets are absent', async() => {
      const configMock = require('../../../lib/core/config');
      const canonicalPath = path.join(process.cwd(), 'canonical', 'secrets.yaml');
      const canonicalSecrets = { 'postgres-passwordKeyVault': 'admin-from-canonical' };

      configMock.getSecretsPath.mockResolvedValue(canonicalPath);
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === canonicalPath; // only canonical exists
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === canonicalPath) {
          return yaml.dump(canonicalSecrets);
        }
        return '';
      });

      const result = await secrets.loadSecrets(undefined, 'myapp');
      expect(result).toEqual(canonicalSecrets);
    });

    it('when config has aifabrix-secrets, local (user) file is strongest and overrides project for same key', async() => {
      const configMock = require('../../../lib/core/config');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const canonicalPath = path.join(process.cwd(), 'canonical', 'secrets.yaml');
      const userSecrets = { 'myapp-client-idKeyVault': 'user-client-id', 'user-only-key': 'from-user' };
      const canonicalSecrets = { 'myapp-client-idKeyVault': 'canonical-client-id', 'extra-secret': 'extra' };

      configMock.getSecretsPath.mockResolvedValue(canonicalPath);
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === userSecretsPath || filePath === canonicalPath;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return yaml.dump(userSecrets);
        }
        if (filePath === canonicalPath) {
          return yaml.dump(canonicalSecrets);
        }
        return '';
      });

      const result = await secrets.loadSecrets(undefined, 'myapp');
      // Local (user) wins for overlapping keys
      expect(result['myapp-client-idKeyVault']).toBe('user-client-id');
      expect(result['extra-secret']).toBe('extra');
      expect(result['user-only-key']).toBe('from-user');
    });

    it('should ignore canonical aifabrix-secrets when invalid or non-object', async() => {
      const configMock = require('../../../lib/core/config');
      const canonicalPath = path.join(process.cwd(), 'canonical', 'secrets.yaml');
      const defaultSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      const defaultSecrets = { 'postgres-passwordKeyVault': 'admin123' };

      // Case 1: invalid YAML (readYamlAtPath throws) - surface error so user can fix the file
      configMock.getSecretsPath.mockResolvedValue(canonicalPath);
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === canonicalPath) return true;
        if (filePath === defaultSecretsPath) return true;
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === canonicalPath) {
          return 'invalid: yaml: content: ['; // invalid
        }
        if (filePath === defaultSecretsPath) {
          return yaml.dump(defaultSecrets);
        }
        return '';
      });
      await expect(secrets.loadSecrets(undefined, 'myapp')).rejects.toThrow(/Failed to load secrets file/);

      // Case 2: non-object YAML (e.g., number)
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === canonicalPath) {
          return '123'; // non-object
        }
        if (filePath === defaultSecretsPath) {
          return yaml.dump(defaultSecrets);
        }
        return '';
      });
      const resultNonObject = await secrets.loadSecrets(undefined, 'myapp');
      expect(resultNonObject).toEqual(defaultSecrets);
    });

    it('should load from user secrets.local.yaml first', async() => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const userSecrets = { 'myapp-client-idKeyVault': 'user-client-id' };

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return yaml.dump(userSecrets);
        }
        return '';
      });

      const result = await secrets.loadSecrets(undefined, 'myapp');

      expect(result).toEqual(userSecrets);
      expect(fs.readFileSync).toHaveBeenCalledWith(userSecretsPath, 'utf8');
    });

    it('validates cascade order: when config has aifabrix-secrets, local file is strongest; project fills missing keys', async() => {
      const configMock = require('../../../lib/core/config');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const canonicalPath = path.join(process.cwd(), 'canonical', 'secrets.local.yaml');
      const userSecrets = { 'shared-key': 'user-wins', 'user-only': 'from-user' };
      const systemSecrets = { 'shared-key': 'system-value', 'system-only': 'from-system' };

      configMock.getSecretsPath.mockResolvedValue(canonicalPath);
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === userSecretsPath || filePath === canonicalPath;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return yaml.dump(userSecrets);
        if (filePath === canonicalPath) return yaml.dump(systemSecrets);
        return '';
      });

      const result = await secrets.loadSecrets(undefined, 'myapp');

      expect(result['shared-key']).toBe('user-wins');
      expect(result['user-only']).toBe('from-user');
      expect(result['system-only']).toBe('from-system');
    });

    it('when key is only in project file (not in local), project value is used', async() => {
      const configMock = require('../../../lib/core/config');
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const canonicalPath = path.join(process.cwd(), 'canonical', 'secrets.local.yaml');
      const userSecrets = { 'only-in-local': 'local-value' };
      const projectSecrets = {
        'only-in-local': 'ignored-if-same-key',
        'keycloak-public-server-urlKeyVault': 'http://localhost:${KEYCLOAK_PUBLIC_PORT}'
      };

      configMock.getSecretsPath.mockResolvedValue(canonicalPath);
      fs.existsSync.mockImplementation((filePath) => {
        return filePath === userSecretsPath || filePath === canonicalPath;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) return yaml.dump(userSecrets);
        if (filePath === canonicalPath) return yaml.dump(projectSecrets);
        return '';
      });

      const result = await secrets.loadSecrets(undefined, 'myapp');

      expect(result['only-in-local']).toBe('local-value');
      expect(result['keycloak-public-server-urlKeyVault']).toBe('http://localhost:${KEYCLOAK_PUBLIC_PORT}');
    });

    it.skip('should fallback to build.secrets when value missing in user file (removed - use config.yaml aifabrix-secrets)', async() => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const variablesPath = path.join(process.cwd(), 'builder', 'myapp', 'variables.yaml');
      const buildSecretsPath = path.resolve(path.dirname(variablesPath), '../../secrets.local.yaml');
      const userSecrets = { 'myapp-client-idKeyVault': 'user-client-id' };
      const buildSecrets = {
        'myapp-client-idKeyVault': 'build-client-id',
        'myapp-client-secretKeyVault': 'build-client-secret'
      };

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath || filePath === variablesPath || filePath === buildSecretsPath) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return yaml.dump(userSecrets);
        }
        if (filePath === variablesPath) {
          return yaml.dump({ build: { secrets: '../../secrets.local.yaml' } });
        }
        if (filePath === buildSecretsPath) {
          return yaml.dump(buildSecrets);
        }
        return '';
      });

      const result = await secrets.loadSecrets(undefined, 'myapp');

      expect(result['myapp-client-idKeyVault']).toBe('user-client-id'); // User takes priority
      expect(result['myapp-client-secretKeyVault']).toBe('build-client-secret'); // From build.secrets
    });

    it.skip('should use build.secrets for empty values in user file (removed - use config.yaml aifabrix-secrets)', async() => {
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const variablesPath = path.join(process.cwd(), 'builder', 'myapp', 'variables.yaml');
      const buildSecretsPath = path.resolve(path.dirname(variablesPath), '../../secrets.local.yaml');
      const userSecrets = { 'myapp-client-idKeyVault': '' };
      const buildSecrets = { 'myapp-client-idKeyVault': 'build-client-id' };

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath || filePath === variablesPath || filePath === buildSecretsPath) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return yaml.dump(userSecrets);
        }
        if (filePath === variablesPath) {
          return yaml.dump({ build: { secrets: '../../secrets.local.yaml' } });
        }
        if (filePath === buildSecretsPath) {
          return yaml.dump(buildSecrets);
        }
        return '';
      });

      const result = await secrets.loadSecrets(undefined, 'myapp');

      expect(result['myapp-client-idKeyVault']).toBe('build-client-id');
    });

    it('should fallback to default secrets.yaml if no secrets found', async() => {
      const defaultSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      const defaultSecrets = { 'postgres-passwordKeyVault': 'admin123' };

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === defaultSecretsPath) {
          return true;
        }
        return false;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === defaultSecretsPath) {
          return yaml.dump(defaultSecrets);
        }
        return '';
      });

      const result = await secrets.loadSecrets(undefined, 'myapp');

      expect(result).toEqual(defaultSecrets);
    });

    it('should throw error if no secrets file found', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(secrets.loadSecrets(undefined, 'myapp')).rejects.toThrow('No secrets file found');
    });
  });

  describe('saveLocalSecret', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      os.homedir.mockReturnValue(mockHomeDir);
    });

    it('should save secret to secrets.local.yaml', async() => {
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const secretsDir = path.dirname(secretsPath);

      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      await localSecrets.saveLocalSecret('myapp-client-idKeyVault', 'client-id-value');

      expect(fs.mkdirSync).toHaveBeenCalledWith(secretsDir, { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        secretsPath,
        expect.stringContaining('myapp-client-idKeyVault'),
        { mode: 0o600 }
      );
    });

    it('should merge with existing secrets', async() => {
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const existingSecrets = { 'existing-key': 'existing-value' };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(existingSecrets));
      fs.writeFileSync.mockImplementation(() => {});

      await localSecrets.saveLocalSecret('new-key', 'new-value');

      const writeCall = fs.writeFileSync.mock.calls[0];
      const savedSecrets = yaml.load(writeCall[1]);

      expect(savedSecrets['existing-key']).toBe('existing-value');
      expect(savedSecrets['new-key']).toBe('new-value');
    });

    it('should throw error if key is invalid', async() => {
      await expect(localSecrets.saveLocalSecret(null, 'value')).rejects.toThrow('Secret key is required');
      await expect(localSecrets.saveLocalSecret('', 'value')).rejects.toThrow('Secret key is required');
    });

    it('should throw error if value is invalid', async() => {
      await expect(localSecrets.saveLocalSecret('key', null)).rejects.toThrow('Secret value is required');
      await expect(localSecrets.saveLocalSecret('key', undefined)).rejects.toThrow('Secret value is required');
    });

    it('should handle existing secrets file with invalid YAML', async() => {
      const secretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid yaml');
      fs.writeFileSync.mockImplementation(() => {});

      await localSecrets.saveLocalSecret('key', 'value');

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should respect config.yaml aifabrix-home override', async() => {
      const overrideHome = '/custom/aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.local.yaml');
      const pathsUtil = require('../../../lib/utils/paths');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);

      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      await localSecrets.saveLocalSecret('myapp-client-idKeyVault', 'client-id-value');

      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalledWith(overrideHome, { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        overrideSecretsPath,
        expect.stringContaining('myapp-client-idKeyVault'),
        { mode: 0o600 }
      );
    });

    it('should use paths.getAifabrixHome() instead of os.homedir()', async() => {
      const overrideHome = '/workspace/.aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.local.yaml');
      const pathsUtil = require('../../../lib/utils/paths');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);

      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      await localSecrets.saveLocalSecret('test-key', 'test-value');

      // Verify paths.getAifabrixHome() was called
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      // Verify it wrote to the override path, not the default os.homedir() path
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        overrideSecretsPath,
        expect.any(String),
        { mode: 0o600 }
      );
      // Verify it did NOT use os.homedir() path
      const defaultPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const writeCall = fs.writeFileSync.mock.calls[0];
      expect(writeCall[0]).not.toBe(defaultPath);
      expect(writeCall[0]).toBe(overrideSecretsPath);
    });
  });

  describe('isLocalhost', () => {
    it('should return true for localhost URLs', () => {
      expect(localSecrets.isLocalhost('http://localhost:3000')).toBe(true);
      expect(localSecrets.isLocalhost('http://127.0.0.1:3000')).toBe(true);
      expect(localSecrets.isLocalhost('https://localhost')).toBe(true);
      expect(localSecrets.isLocalhost('http://LOCALHOST:3000')).toBe(true);
    });

    it('should return false for non-localhost URLs', () => {
      expect(localSecrets.isLocalhost('https://api.example.com')).toBe(false);
      expect(localSecrets.isLocalhost('http://example.com')).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(localSecrets.isLocalhost(null)).toBe(false);
      expect(localSecrets.isLocalhost(undefined)).toBe(false);
      expect(localSecrets.isLocalhost('')).toBe(false);
    });
  });

  describe('loadEnvTemplate', () => {
    it('should load env template from file', async() => {
      const templatePath = path.join(process.cwd(), 'builder', 'testapp', 'env.template');
      const templateContent = 'DATABASE_URL=kv://postgres-passwordKeyVault\nPORT=3000';

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') || filePath.includes('secrets.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return templateContent;
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      // Test through generateEnvFile which calls loadEnvTemplate
      await secrets.generateEnvFile('testapp');

      expect(fs.existsSync).toHaveBeenCalledWith(templatePath);
      expect(fs.readFileSync).toHaveBeenCalledWith(templatePath, 'utf8');
    });

    it('should throw error if env template not found', async() => {
      fs.existsSync.mockReturnValue(false);

      await expect(secrets.generateEnvFile('testapp')).rejects.toThrow('env.template not found');
    });
  });

  describe('resolveServicePortsInEnvContent', () => {
    const appName = 'testapp';
    const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

    beforeEach(() => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return true;
        }
        return filePath.includes('env.template') ||
               filePath.includes('secrets.yaml') ||
               filePath.includes('env-config.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return 'keycloak-urlKeyVault: "http://${KEYCLOAK_HOST}:8082/auth"';
        }
        if (filePath.includes('env.template')) {
          return 'KEYCLOAK_URL=kv://keycloak-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'keycloak-urlKeyVault: "http://${KEYCLOAK_HOST}:8082/auth"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
    MISO_HOST: miso-controller
  local:
    KEYCLOAK_HOST: localhost
    MISO_HOST: localhost
`;
        }
        return '';
      });
    });

    it('should return content unchanged for non-docker environment', async() => {
      // Test through generateEnvFile with local environment
      await secrets.generateEnvFile(appName, undefined, 'local');

      const writeCalls = fs.writeFileSync.mock.calls;
      const envCall = writeCalls.find(call => call[0].includes('.env') && !call[0].includes('../'));
      expect(envCall).toBeDefined();
      // Should not change ports in local environment
      expect(envCall[1]).toContain('KEYCLOAK_URL');
    });

    it('should resolve service ports in URLs for docker environment', async() => {
      const keycloakVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'variables.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === keycloakVariablesPath) {
          return true;
        }
        return filePath.includes('env.template') ||
               filePath.includes('secrets.yaml') ||
               filePath.includes('env-config.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'KEYCLOAK_URL=kv://keycloak-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'keycloak-urlKeyVault: "http://${KEYCLOAK_HOST}:8082/auth"';
        }
        if (filePath === keycloakVariablesPath) {
          return `
port: 8082
build:
  containerPort: 8080
`;
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
  local:
    KEYCLOAK_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      const writeCalls = fs.writeFileSync.mock.calls;
      const envCall = writeCalls.find(call => call[0].includes('.env') && !call[0].includes('../'));
      expect(envCall).toBeDefined();
      expect(envCall[1]).toContain('http://keycloak:8080/auth');
    });

    it('should handle URLs without service hostnames', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return true;
        }
        return filePath.includes('env.template') ||
               filePath.includes('secrets.yaml') ||
               filePath.includes('env-config.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return 'external-urlKeyVault: "https://api.example.com:443/path"';
        }
        if (filePath.includes('env.template')) {
          return 'EXTERNAL_URL=kv://external-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'external-urlKeyVault: "https://api.example.com:443/path"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
  local:
    KEYCLOAK_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      const writeCalls = fs.writeFileSync.mock.calls;
      const envCall = writeCalls.find(call => call[0].includes('.env') && !call[0].includes('../'));
      expect(envCall).toBeDefined();
      expect(envCall[1]).toContain('https://api.example.com:443/path');
    });

    it('should preserve URL paths and query parameters', async() => {
      const keycloakVariablesPath = path.join(process.cwd(), 'builder', 'keycloak', 'variables.yaml');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === keycloakVariablesPath) {
          return true;
        }
        return filePath.includes('env.template') ||
               filePath.includes('secrets.yaml') ||
               filePath.includes('env-config.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'KEYCLOAK_URL=kv://keycloak-urlKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'keycloak-urlKeyVault: "http://${KEYCLOAK_HOST}:8082/auth/realms/master?param=value"';
        }
        if (filePath === keycloakVariablesPath) {
          return `
port: 8082
build:
  containerPort: 8080
`;
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    KEYCLOAK_HOST: keycloak
  local:
    KEYCLOAK_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      const writeCalls = fs.writeFileSync.mock.calls;
      const envCall = writeCalls.find(call => call[0].includes('.env') && !call[0].includes('../'));
      expect(envCall).toBeDefined();
      expect(envCall[1]).toContain('http://keycloak:8080/auth/realms/master?param=value');
    });
  });

  describe('processEnvVariables', () => {
    const appName = 'testapp';
    const builderPath = path.join(process.cwd(), 'builder', appName);
    const envPath = path.join(builderPath, '.env');
    const variablesPath = path.join(builderPath, 'variables.yaml');

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('env.template')) {
          return 'PORT=3000\nDATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        if (filePath === variablesPath) {
          return `
build:
  envOutputPath: ../app/.env
  localPort: 4000
port: 3000
`;
        }
        if (filePath === envPath) {
          return 'PORT=3000\nDATABASE_URL=postgres://localhost';
        }
        return '';
      });
    });

    it('should copy .env to envOutputPath with localPort', async() => {
      const outputPath = path.resolve(builderPath, '../app/.env');

      // Set developer-id to 0 for this test to avoid offset
      // Reset the mock first, then set it to return 0
      config.getDeveloperId.mockReset();
      config.getDeveloperId.mockResolvedValue(0);

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml') ||
               filePath === envPath;
      });
      if (!fs.statSync) {
        fs.statSync = jest.fn();
      }
      fs.statSync.mockReturnValue({ isDirectory: () => false });

      await secrets.generateEnvFile(appName);

      const writeCalls = fs.writeFileSync.mock.calls;
      const outputCall = writeCalls.find(call => call[0] === outputPath);
      expect(outputCall).toBeDefined();
      expect(outputCall[1]).toContain('PORT=4000');
    });

    it('should use port when localPort not specified', async() => {
      // Set developer-id to 0 for this test to avoid offset
      // Reset the mock first, then set it to return 0
      config.getDeveloperId.mockReset();
      config.getDeveloperId.mockResolvedValue(0);

      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml') ||
               filePath === envPath;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return `
build:
  envOutputPath: ../app/.env
port: 5000
`;
        }
        if (filePath.includes('env.template')) {
          return 'PORT=3000\nDATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        if (filePath === envPath) {
          return 'PORT=3000\nDATABASE_URL=postgres://localhost';
        }
        return '';
      });
      if (!fs.statSync) {
        fs.statSync = jest.fn();
      }
      fs.statSync.mockReturnValue({ isDirectory: () => false });

      await secrets.generateEnvFile(appName);

      const writeCalls = fs.writeFileSync.mock.calls;
      const outputPath = path.resolve(builderPath, '../app/.env');
      const outputCall = writeCalls.find(call => call[0] === outputPath);
      expect(outputCall).toBeDefined();
      expect(outputCall[1]).toContain('PORT=5000');
    });

    it('should not copy when envOutputPath is null', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml') ||
               filePath === envPath;
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return `
build:
  envOutputPath: null
port: 3000
`;
        }
        if (filePath.includes('env.template')) {
          return 'PORT=3000\nDATABASE_URL=kv://postgres-passwordKeyVault';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        if (filePath === envPath) {
          return 'PORT=3000\nDATABASE_URL=postgres://localhost';
        }
        return '';
      });

      await secrets.generateEnvFile(appName);

      const writeCalls = fs.writeFileSync.mock.calls;
      const outputPath = path.resolve(process.cwd(), '../app/.env');
      const outputCall = writeCalls.find(call => call[0] === outputPath);
      expect(outputCall).toBeUndefined();
    });

    it('should create output directory if it does not exist', async() => {
      const outputDir = path.resolve(builderPath, '../app');
      const outputPath = path.join(outputDir, '.env');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === outputDir) {
          return false;
        }
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml') ||
               filePath === envPath;
      });
      if (!fs.statSync) {
        fs.statSync = jest.fn();
      }
      fs.statSync.mockReturnValue({ isDirectory: () => false });

      await secrets.generateEnvFile(appName);

      expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
    });

    it('should handle envOutputPath pointing to existing directory', async() => {
      const outputDir = path.resolve(builderPath, '../app');
      const outputPath = path.join(outputDir, '.env');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === outputDir) {
          return true;
        }
        return filePath.includes('env.template') ||
               filePath.includes('variables.yaml') ||
               filePath.includes('secrets.yaml') ||
               filePath === envPath;
      });
      if (!fs.statSync) {
        fs.statSync = jest.fn();
      }
      fs.statSync.mockImplementation((filePath) => {
        if (filePath === outputDir) {
          return { isDirectory: () => true };
        }
        return { isDirectory: () => false };
      });

      await secrets.generateEnvFile(appName);

      const writeCalls = fs.writeFileSync.mock.calls;
      const outputCall = writeCalls.find(call => call[0] === outputPath);
      expect(outputCall).toBeDefined();
    });

    it('should not process when variables.yaml does not exist', async() => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === variablesPath) {
          return false;
        }
        return filePath.includes('env.template') ||
               filePath.includes('secrets.yaml') ||
               filePath === envPath;
      });

      await secrets.generateEnvFile(appName);

      const writeCalls = fs.writeFileSync.mock.calls;
      const outputPath = path.resolve(process.cwd(), '../app/.env');
      const outputCall = writeCalls.find(call => call[0] === outputPath);
      expect(outputCall).toBeUndefined();
    });
  });

  describe('generateEnvFile - local environment port updates', () => {
    const appName = 'testapp';
    const builderPath = path.join(process.cwd(), 'builder', appName);
    const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');

    beforeEach(() => {
      jest.clearAllMocks();
      os.homedir.mockReturnValue(mockHomeDir);
      // Ensure developer-id is 1 for port offset tests (default is already 1, but ensure it's set after clearAllMocks)
      config.getDeveloperId.mockResolvedValue(1);

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return true;
        }
        return filePath.includes('env.template') ||
               filePath.includes('secrets.yaml') ||
               filePath.includes('env-config.yaml') ||
               filePath.includes('variables.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env.template')) {
          return 'DATABASE_PORT=5432\nREDIS_URL=redis://localhost:6379\nREDIS_HOST=localhost:6379';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  local:
    REDIS_HOST: localhost
`;
        }
        if (filePath.includes('variables.yaml')) {
          return 'port: 3000';
        }
        return '';
      });
    });

    it('should update DATABASE_PORT for local environment', async() => {
      await secrets.generateEnvFile(appName, undefined, 'local');

      const writeCalls = fs.writeFileSync.mock.calls;
      const envCall = writeCalls.find(call => call[0].includes('.env') && !call[0].includes('../'));
      expect(envCall).toBeDefined();
      expect(envCall[1]).toContain('DATABASE_PORT=5532');
    });

    it('should update REDIS_URL for local environment', async() => {
      await secrets.generateEnvFile(appName, undefined, 'local');

      const writeCalls = fs.writeFileSync.mock.calls;
      const envCall = writeCalls.find(call => call[0].includes('.env') && !call[0].includes('../'));
      expect(envCall).toBeDefined();
      expect(envCall[1]).toContain('REDIS_URL=redis://localhost:6479');
    });

    it('should update REDIS_HOST for local environment', async() => {
      await secrets.generateEnvFile(appName, undefined, 'local');

      const writeCalls = fs.writeFileSync.mock.calls;
      const envCall = writeCalls.find(call => call[0].includes('.env') && !call[0].includes('../'));
      expect(envCall).toBeDefined();
      expect(envCall[1]).toContain('REDIS_HOST=localhost:6479');
    });

    it('should NOT apply developer-id adjustment to infra ports for docker environment', async() => {
      // Set developer-id to 1 for this test (default mock is already 1, but ensure it's set)
      config.getDeveloperId.mockResolvedValue(1);

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return true;
        }
        return filePath.includes('env.template') ||
               filePath.includes('secrets.yaml') ||
               filePath.includes('env-config.yaml');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env.template')) {
          return 'DATABASE_PORT=5432\nREDIS_URL=redis://localhost:6379';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    REDIS_HOST: redis
    REDIS_PORT: 6379
    DB_PORT: 5432
  local:
    REDIS_HOST: localhost
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      const writeCalls = fs.writeFileSync.mock.calls;
      const envCall = writeCalls.find(call => call[0].includes('.env') && !call[0].includes('../'));
      expect(envCall).toBeDefined();
      // Infra ports should NOT get developer-id adjustment for docker: 5432, 6379
      expect(envCall[1]).toContain('DATABASE_PORT=5432');
      expect(envCall[1]).toContain('REDIS_URL=redis://redis:6379');
    });

    it('should replace DATABASE_URL with postgres host and base port for docker context', async() => {
      const appName = 'test-app';
      const mockHomeDir = '/home/user';
      const userSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.local.yaml');
      const builderPath = path.join(process.cwd(), 'builder', appName);
      const envTemplatePath = path.join(builderPath, 'env.template');
      const variablesPath = path.join(builderPath, 'variables.yaml');
      const envPath = path.join(builderPath, '.env');

      // Mock os.homedir
      os.homedir.mockReturnValue(mockHomeDir);
      const pathsUtil = require('../../../lib/utils/paths');
      pathsUtil.getAifabrixHome.mockReturnValue(path.join(mockHomeDir, '.aifabrix'));
      config.getDeveloperId.mockResolvedValue(1);

      // Mock file system
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return true;
        }
        return filePath === builderPath ||
               filePath === envTemplatePath ||
               filePath === variablesPath ||
               filePath.includes('env-config.yaml');
      });

      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === userSecretsPath) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath === variablesPath) {
          return 'port: 3000\nbuild:\n  containerPort: 3000';
        }
        if (filePath === envTemplatePath) {
          // Template has DATABASE_URL with localhost and dev-id adjusted port
          return 'DATABASE_URL=postgresql://miso_user:miso_pass123@localhost:5532/miso\nDB_HOST=localhost\nDB_PORT=5532';
        }
        if (filePath.includes('secrets.yaml')) {
          return 'postgres-passwordKeyVault: "admin123"';
        }
        if (filePath.includes('env-config.yaml')) {
          return `
environments:
  docker:
    REDIS_HOST: redis
    REDIS_PORT: 6379
    DB_HOST: postgres
    DB_PORT: 5432
  local:
    REDIS_HOST: localhost
    REDIS_PORT: 6379
    DB_HOST: localhost
    DB_PORT: 5432
`;
        }
        return '';
      });

      await secrets.generateEnvFile(appName, undefined, 'docker');

      const writeCalls = fs.writeFileSync.mock.calls;
      const envCall = writeCalls.find(call => call[0].includes('.env') && !call[0].includes('../'));
      expect(envCall).toBeDefined();
      const envContent = envCall[1];

      // DATABASE_URL should use postgres (docker service name) not localhost
      expect(envContent).toContain('DATABASE_URL=postgresql://miso_user:miso_pass123@postgres:5432/miso');
      // Should NOT contain localhost in DATABASE_URL
      expect(envContent).not.toMatch(/DATABASE_URL=.*localhost/);
      // Should NOT contain dev-id adjusted port (5532) in DATABASE_URL
      expect(envContent).not.toMatch(/DATABASE_URL=.*:5532/);
      // DB_HOST should be postgres for docker
      expect(envContent).toContain('DB_HOST=postgres');
      // DB_PORT should be base port (5432) not dev-id adjusted (5532)
      expect(envContent).toContain('DB_PORT=5432');
      expect(envContent).not.toContain('DB_PORT=5532');
    });
  });

  describe('decryptSecretsObject behavior', () => {
    const encryption = require('../../../lib/utils/secrets-encryption');
    const configMock = require('../../../lib/core/config');

    beforeEach(() => {
      jest.clearAllMocks();
      os.homedir.mockReturnValue(mockHomeDir);
    });

    it('throws when encrypted values exist but no encryption key is configured', async() => {
      const explicitPath = path.join(process.cwd(), 'secrets.encrypted.yaml');
      const secretsYaml = yaml.dump({ 'secretKey': 'secure://iv:ciphertext:tag' });
      configMock.getSecretsEncryptionKey.mockResolvedValue(null);
      fs.existsSync.mockImplementation((filePath) => filePath === explicitPath);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === explicitPath) return secretsYaml;
        return '';
      });

      await expect(secrets.loadSecrets(explicitPath)).rejects.toThrow('Encrypted secrets found but no encryption key configured');
    });

    it('decrypts encrypted values when encryption key is set', async() => {
      const explicitPath = path.join(process.cwd(), 'secrets.encrypted.yaml');
      const secretsYaml = yaml.dump({
        'encKey': 'secure://iv:ciphertext:tag',
        'plainKey': 'value'
      });
      configMock.getSecretsEncryptionKey.mockResolvedValue('a'.repeat(64)); // hex-like
      fs.existsSync.mockImplementation((filePath) => filePath === explicitPath);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === explicitPath) return secretsYaml;
        return '';
      });
      // decryptSecret mocked to prefix decrypted(...)
      const result = await secrets.loadSecrets(explicitPath);
      expect(result.encKey).toMatch(/^decrypted\(.+\)$/);
      expect(result.plainKey).toBe('value');
      expect(encryption.decryptSecret).toHaveBeenCalled();
    });

    it('propagates decryption errors with helpful message', async() => {
      const explicitPath = path.join(process.cwd(), 'secrets.encrypted.yaml');
      const secretsYaml = yaml.dump({ 'encKey': 'secure://iv:ciphertext:tag' });
      configMock.getSecretsEncryptionKey.mockResolvedValue('a'.repeat(64));
      fs.existsSync.mockImplementation((filePath) => filePath === explicitPath);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === explicitPath) return secretsYaml;
        return '';
      });
      const { decryptSecret } = require('../../../lib/utils/secrets-encryption');
      decryptSecret.mockImplementation(() => {
        throw new Error('bad decrypt');
      });

      await expect(secrets.loadSecrets(explicitPath)).rejects.toThrow('Failed to decrypt secret \'encKey\': bad decrypt');
    });
  });

  describe('getCanonicalSecretName', () => {
    it('should convert typical env keys to canonical names', () => {
      expect(secrets.getCanonicalSecretName('JWT_SECRET')).toBe('jwt-secret');
      expect(secrets.getCanonicalSecretName('REDIS_PASSWORD')).toBe('redis-password');
      expect(secrets.getCanonicalSecretName('DATABASE_URL')).toBe('database-url');
      expect(secrets.getCanonicalSecretName('API KEY')).toBe('api-key');
      expect(secrets.getCanonicalSecretName('PRIVATE-KEY')).toBe('private-key');
    });

    it('should collapse repeated separators and trim hyphens', () => {
      expect(secrets.getCanonicalSecretName('___STRANGE___KEY___')).toBe('strange-key');
      expect(secrets.getCanonicalSecretName('---A---B---')).toBe('a-b');
    });

    it('should handle invalid inputs gracefully', () => {
      expect(secrets.getCanonicalSecretName('')).toBe('');
      expect(secrets.getCanonicalSecretName(null)).toBe('');
      expect(secrets.getCanonicalSecretName(undefined)).toBe('');
    });
  });

  describe('path resolution consistency between save and load', () => {
    it('should save and load from the same path when aifabrix-home is overridden', async() => {
      const overrideHome = '/workspace/.aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.local.yaml');
      const pathsUtil = require('../../../lib/utils/paths');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);

      // Save a secret
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      await localSecrets.saveLocalSecret('test-app-client-idKeyVault', 'saved-client-id');

      // Verify it was saved to override path
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      const saveCall = fs.writeFileSync.mock.calls[0];
      expect(saveCall[0]).toBe(overrideSecretsPath);

      // Now load secrets - should read from the same path
      jest.clearAllMocks();
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({
        'test-app-client-idKeyVault': 'saved-client-id',
        'test-app-client-secretKeyVault': 'saved-client-secret'
      }));

      const secretsUtils = require('../../../lib/utils/secrets-utils');
      const loadedSecrets = secretsUtils.loadUserSecrets();

      // Verify it read from the same override path
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalledWith(overrideSecretsPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(overrideSecretsPath, 'utf8');
      expect(loadedSecrets['test-app-client-idKeyVault']).toBe('saved-client-id');
    });

    it('should ensure saveLocalSecret and loadUserSecrets use the same path resolution', async() => {
      const overrideHome = '/custom/aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.local.yaml');
      const pathsUtil = require('../../../lib/utils/paths');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);

      // Save using saveLocalSecret
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      await localSecrets.saveLocalSecret('integration-test-key', 'integration-test-value');

      // Verify save used paths.getAifabrixHome()
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      const savePath = fs.writeFileSync.mock.calls[0][0];
      expect(savePath).toBe(overrideSecretsPath);

      // Load using loadUserSecrets
      jest.clearAllMocks();
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump({
        'integration-test-key': 'integration-test-value'
      }));

      const secretsUtils = require('../../../lib/utils/secrets-utils');
      const loadedSecrets = secretsUtils.loadUserSecrets();

      // Verify load used paths.getAifabrixHome() and same path
      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      const loadPath = fs.readFileSync.mock.calls[0][0];
      expect(loadPath).toBe(overrideSecretsPath);
      expect(savePath).toBe(loadPath);
      expect(loadedSecrets['integration-test-key']).toBe('integration-test-value');
    });
  });
});
