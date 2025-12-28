/**
 * Tests for AI Fabrix Builder Secrets Generator Module
 *
 * @fileoverview Unit tests for secrets-generator.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const crypto = require('crypto');

// Mock logger before requiring modules that use it
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

const secretsGenerator = require('../../../lib/utils/secrets-generator');
const pathsUtil = require('../../../lib/utils/paths');

// Mock fs module
jest.mock('fs');
jest.mock('os');
jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn()
}));

describe('Secrets Generator Module', () => {
  const mockHomeDir = '/home/test';
  const mockSecretsPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
    os.homedir.mockReturnValue(mockHomeDir);
    // Default paths.getAifabrixHome() to return mockHomeDir/.aifabrix
    pathsUtil.getAifabrixHome.mockReturnValue(path.join(mockHomeDir, '.aifabrix'));
  });

  describe('findMissingSecretKeys', () => {
    it('should find missing secret keys from template', () => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault\nREDIS_URL=kv://redis-urlKeyVault';
      const existingSecrets = { 'postgres-passwordKeyVault': 'admin123' };

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual(['redis-urlKeyVault']);
    });

    it('should return empty array when all secrets exist', () => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      const existingSecrets = { 'postgres-passwordKeyVault': 'admin123' };

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual([]);
    });

    it('should return all keys when no secrets exist', () => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault\nREDIS_URL=kv://redis-urlKeyVault';
      const existingSecrets = {};

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual(['postgres-passwordKeyVault', 'redis-urlKeyVault']);
    });

    it('should handle duplicate kv:// references', () => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault\nOTHER_URL=kv://postgres-passwordKeyVault';
      const existingSecrets = {};

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual(['postgres-passwordKeyVault']);
    });

    it('should handle empty template', () => {
      const envTemplate = '';
      const existingSecrets = {};

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual([]);
    });

    it('should handle template with no kv:// references', () => {
      const envTemplate = 'DATABASE_URL=postgres://localhost:5432/db';
      const existingSecrets = {};

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual([]);
    });

    it('should handle keys with hyphens and underscores', () => {
      const envTemplate = 'KEY1=kv://my-app-key\nKEY2=kv://my_app_key';
      const existingSecrets = {};

      const result = secretsGenerator.findMissingSecretKeys(envTemplate, existingSecrets);

      expect(result).toEqual(['my-app-key', 'my_app_key']);
    });
  });

  describe('generateSecretValue', () => {
    it('should generate database password for databases-{app}-{index}-passwordKeyVault format', () => {
      const key = 'databases-myapp-0-passwordKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('myapp_pass123');
    });

    it('should handle app name with hyphens in database password', () => {
      const key = 'databases-my-app-name-0-passwordKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('my_app_name_pass123');
    });

    it('should generate random password for generic password key', () => {
      const key = 'some-password-key';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Base64 encoding of 32 bytes = 44 characters
      expect(result.length).toBe(44);
    });

    it('should generate database URL for databases-{app}-{index}-urlKeyVault format', () => {
      const key = 'databases-myapp-0-urlKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('postgresql://myapp_user:myapp_pass123@${DB_HOST}:${DB_PORT}/myapp');
    });

    it('should handle app name with hyphens in database URL', () => {
      const key = 'databases-my-app-name-0-urlKeyVault';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('postgresql://my_app_name_user:my_app_name_pass123@${DB_HOST}:${DB_PORT}/my_app_name');
    });

    it('should return empty string for URL keys that are not database URLs', () => {
      const key = 'some-url-key';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('');
    });

    it('should return empty string for URI keys that are not database URIs', () => {
      const key = 'some-uri-key';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('');
    });

    it('should generate random key for key pattern', () => {
      const key = 'some-api-key';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(44);
    });

    it('should generate random key for secret pattern', () => {
      const key = 'some-secret-key';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(44);
    });

    it('should generate random key for token pattern', () => {
      const key = 'some-token-key';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(44);
    });

    it('should return empty string for unknown key pattern', () => {
      const key = 'some-unknown-value-setting';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('');
    });

    it('should handle case-insensitive password matching', () => {
      const key = 'PASSWORD-KEY';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBe(44);
    });

    it('should handle case-insensitive URL matching', () => {
      const key = 'URL-KEY';

      const result = secretsGenerator.generateSecretValue(key);

      expect(result).toBe('');
    });
  });

  describe('loadExistingSecrets', () => {
    it('should return empty object when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
      expect(fs.existsSync).toHaveBeenCalledWith(mockSecretsPath);
    });

    it('should load existing secrets from file', () => {
      const mockSecrets = { 'postgres-passwordKeyVault': 'admin123' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(mockSecrets));

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual(mockSecrets);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockSecretsPath, 'utf8');
    });

    it('should return empty object when file contains null', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('null');

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
    });

    it('should return empty object when file contains non-object', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('"just a string"');

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
    });

    it('should handle error when reading file', () => {
      const logger = require('../../../lib/utils/logger');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not read existing secrets file'));
    });

    it('should handle empty file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('');

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
    });

    it('should handle invalid YAML gracefully', () => {
      const logger = require('../../../lib/utils/logger');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid yaml content: [unclosed');

      const result = secretsGenerator.loadExistingSecrets(mockSecretsPath);

      expect(result).toEqual({});
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('saveSecretsFile', () => {
    it('should save secrets file', () => {
      const secrets = { 'postgres-passwordKeyVault': 'admin123' };
      fs.existsSync.mockReturnValue(true);

      secretsGenerator.saveSecretsFile(mockSecretsPath, secrets);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockSecretsPath,
        expect.stringContaining('postgres-passwordKeyVault'),
        { mode: 0o600 }
      );
    });

    it('should create directory if it does not exist', () => {
      const secrets = { 'postgres-passwordKeyVault': 'admin123' };
      const dir = path.dirname(mockSecretsPath);
      fs.existsSync.mockReturnValue(false);

      secretsGenerator.saveSecretsFile(mockSecretsPath, secrets);

      expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should not create directory if it exists', () => {
      const secrets = { 'postgres-passwordKeyVault': 'admin123' };
      const dir = path.dirname(mockSecretsPath);
      fs.existsSync.mockImplementation((filePath) => filePath === dir);

      secretsGenerator.saveSecretsFile(mockSecretsPath, secrets);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should save secrets with proper YAML formatting', () => {
      const secrets = {
        'postgres-passwordKeyVault': 'admin123',
        'redis-urlKeyVault': 'redis://localhost:6379'
      };
      fs.existsSync.mockReturnValue(true);

      secretsGenerator.saveSecretsFile(mockSecretsPath, secrets);

      const writeCall = fs.writeFileSync.mock.calls[0];
      const yamlContent = writeCall[1];
      const parsed = yaml.load(yamlContent);

      expect(parsed).toEqual(secrets);
    });

    it('should preserve key order in YAML output', () => {
      const secrets = {
        'z-key': 'value-z',
        'a-key': 'value-a',
        'm-key': 'value-m'
      };
      fs.existsSync.mockReturnValue(true);

      secretsGenerator.saveSecretsFile(mockSecretsPath, secrets);

      const writeCall = fs.writeFileSync.mock.calls[0];
      const yamlContent = writeCall[1];
      const parsed = yaml.load(yamlContent);

      expect(Object.keys(parsed)).toEqual(['z-key', 'a-key', 'm-key']);
    });
  });

  describe('generateMissingSecrets', () => {
    beforeEach(() => {
      const logger = require('../../../lib/utils/logger');
      jest.clearAllMocks();
      logger.log.mockClear();
    });

    it('should generate missing secrets', async() => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(false);

      const result = await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(result).toEqual(['postgres-passwordKeyVault']);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should return empty array when no missing keys', async() => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('postgres-passwordKeyVault: "admin123"');

      const result = await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(result).toEqual([]);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should use default path when secretsPath not provided', async() => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      const defaultPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.generateMissingSecrets(envTemplate);

      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === defaultPath);
      expect(writeCall).toBeDefined();
    });

    it('should respect config.yaml aifabrix-home override when path not provided', async() => {
      const overrideHome = '/custom/aifabrix';
      const overrideSecretsPath = path.join(overrideHome, 'secrets.yaml');
      pathsUtil.getAifabrixHome.mockReturnValue(overrideHome);
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.generateMissingSecrets(envTemplate);

      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === overrideSecretsPath);
      expect(writeCall).toBeDefined();
    });

    it('should use provided path and not use fallback', async() => {
      const explicitPath = '/explicit/path/secrets.yaml';
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.generateMissingSecrets(envTemplate, explicitPath);

      expect(pathsUtil.getAifabrixHome).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => call[0] === explicitPath);
      expect(writeCall).toBeDefined();
    });

    it('should merge new secrets with existing ones', async() => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault\nREDIS_URL=kv://redis-urlKeyVault';
      const existingSecrets = { 'postgres-passwordKeyVault': 'admin123' };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(yaml.dump(existingSecrets));

      await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls[0];
      const writtenContent = writeCall[1];
      const parsed = yaml.load(writtenContent);

      expect(parsed['postgres-passwordKeyVault']).toBe('admin123');
      expect(parsed['redis-urlKeyVault']).toBeDefined();
    });

    it('should log generated keys', async() => {
      const logger = require('../../../lib/utils/logger');
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('Generated 1 missing secret key(s)')
      );
    });

    it('should handle multiple missing keys', async() => {
      const envTemplate = 'KEY1=kv://secret1\nKEY2=kv://secret2';
      fs.existsSync.mockReturnValue(false);

      const result = await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(result).toEqual(['secret1', 'secret2']);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle existing secrets file with invalid YAML', async() => {
      const logger = require('../../../lib/utils/logger');
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async() => {
      const envTemplate = 'DATABASE_URL=kv://postgres-passwordKeyVault';
      const dir = path.dirname(mockSecretsPath);
      fs.existsSync.mockImplementation((filePath) => filePath === mockSecretsPath);

      await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true, mode: 0o700 });
    });

    it('should handle duplicate kv:// references', async() => {
      const envTemplate = 'KEY1=kv://same-secret\nKEY2=kv://same-secret';
      fs.existsSync.mockReturnValue(false);

      const result = await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(result).toEqual(['same-secret']);
    });
  });

  describe('createDefaultSecrets', () => {
    it('should create default secrets file with ~ path', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.stringContaining('postgres-passwordKeyVault'),
        { mode: 0o600 }
      );
    });

    it('should create default secrets file with absolute path', async() => {
      const secretsPath = '/custom/path/secrets.yaml';
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        secretsPath,
        expect.stringContaining('postgres-passwordKeyVault'),
        { mode: 0o600 }
      );
    });

    it('should create directory if it does not exist', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      const dir = path.dirname(resolvedPath);
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should include all default secrets in output', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      const writeCall = fs.writeFileSync.mock.calls[0];
      const content = writeCall[1];

      expect(content).toContain('postgres-passwordKeyVault');
      expect(content).toContain('redis-passwordKeyVault');
      expect(content).toContain('redis-urlKeyVault');
      expect(content).toContain('keycloak-admin-passwordKeyVault');
      expect(content).toContain('keycloak-auth-server-urlKeyVault');
    });

    it('should write file with correct permissions', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should handle path without ~ prefix', async() => {
      const secretsPath = '/absolute/path/secrets.yaml';
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        secretsPath,
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should not create directory if it already exists', async() => {
      const secretsPath = '~/.aifabrix/secrets.yaml';
      const resolvedPath = path.join(mockHomeDir, '.aifabrix', 'secrets.yaml');
      const dir = path.dirname(resolvedPath);
      fs.existsSync.mockReturnValue(true);

      await secretsGenerator.createDefaultSecrets(secretsPath);

      // mkdirSync should still be called but won't create if exists
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('Integration tests', () => {
    it('should generate and save secrets in correct format', async() => {
      const envTemplate = `
DATABASE_PASSWORD=kv://databases-myapp-0-passwordKeyVault
DATABASE_URL=kv://databases-myapp-0-urlKeyVault
API_KEY=kv://myapp-api-key
`;
      fs.existsSync.mockReturnValue(false);

      const result = await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      expect(result).toContain('databases-myapp-0-passwordKeyVault');
      expect(result).toContain('databases-myapp-0-urlKeyVault');
      expect(result).toContain('myapp-api-key');

      const writeCall = fs.writeFileSync.mock.calls[0];
      const yamlContent = writeCall[1];
      const parsed = yaml.load(yamlContent);

      expect(parsed['databases-myapp-0-passwordKeyVault']).toBe('myapp_pass123');
      expect(parsed['databases-myapp-0-urlKeyVault']).toBe('postgresql://myapp_user:myapp_pass123@${DB_HOST}:${DB_PORT}/myapp');
      expect(parsed['myapp-api-key']).toBeTruthy();
      expect(typeof parsed['myapp-api-key']).toBe('string');
      expect(parsed['myapp-api-key'].length).toBe(44);
    });

    it('should handle complex template with multiple secret types', async() => {
      const envTemplate = `
PASSWORD=kv://generic-password
SECRET_KEY=kv://secret-key
TOKEN=kv://api-token
URL=kv://some-url
`;
      fs.existsSync.mockReturnValue(false);

      await secretsGenerator.generateMissingSecrets(envTemplate, mockSecretsPath);

      const writeCall = fs.writeFileSync.mock.calls[0];
      const yamlContent = writeCall[1];
      const parsed = yaml.load(yamlContent);

      expect(parsed['generic-password']).toBeTruthy();
      expect(parsed['secret-key']).toBeTruthy();
      expect(parsed['api-token']).toBeTruthy();
      expect(parsed['some-url']).toBe('');
    });
  });
});

