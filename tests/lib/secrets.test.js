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

const secrets = require('../../lib/secrets');
const localSecrets = require('../../lib/utils/local-secrets');

// Mock fs module
jest.mock('fs');
jest.mock('os');
jest.mock('../../lib/utils/logger', () => ({
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

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(builderPath, '.env'),
        'DATABASE_URL=admin123',
        { mode: 0o600 }
      );
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
      const outputPath = path.resolve(process.cwd(), '../app');
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

    it('should fallback to build.secrets when value missing in user file', async() => {
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

    it('should use build.secrets for empty values in user file', async() => {
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
});
