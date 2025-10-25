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
const secrets = require('../../lib/secrets');

// Mock fs module
jest.mock('fs');
jest.mock('os');

describe('Secrets Module', () => {
  const mockHomeDir = '/home/test';
  const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
  const mockAdminSecretsPath = path.join(mockHomeDir, '.aifabrix', 'admin-secrets.env');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
  });

  describe('loadSecrets', () => {
    it('should load secrets from default path when no path provided', async() => {
      const mockSecrets = { 'postgres-passwordKeyVault': 'admin123' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('postgres-passwordKeyVault: "admin123"');

      const result = await secrets.loadSecrets();

      expect(fs.existsSync).toHaveBeenCalledWith(mockSecretsPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockSecretsPath, 'utf8');
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

    it('should throw error for missing secrets', async() => {
      const template = 'SECRET=kv://missing-secret';

      await expect(secrets.resolveKvReferences(template, mockSecrets)).rejects.toThrow('Missing secrets: kv://missing-secret');
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

      expect(fs.copyFileSync).toHaveBeenCalled();
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
});
