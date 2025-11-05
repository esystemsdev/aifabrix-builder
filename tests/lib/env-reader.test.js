/**
 * Tests for AI Fabrix Builder Environment Reader Module
 *
 * @fileoverview Unit tests for env-reader.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const envReader = require('../../lib/env-reader');

describe('Environment Reader Module', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'aifabrix-env-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async() => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('readExistingEnv', () => {
    it('should read existing .env file', async() => {
      const envContent = `
# Test environment
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://localhost:5432/test
API_KEY=abc123def456
`;
      await fs.writeFile('.env', envContent);

      const result = await envReader.readExistingEnv(process.cwd());

      expect(result).toBeDefined();
      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe('3000');
      expect(result.DATABASE_URL).toBe('postgres://localhost:5432/test');
      expect(result.API_KEY).toBe('abc123def456');
    });

    it('should return null when .env file does not exist', async() => {
      const result = await envReader.readExistingEnv(process.cwd());
      expect(result).toBeNull();
    });

    it('should handle empty .env file', async() => {
      await fs.writeFile('.env', '');
      const result = await envReader.readExistingEnv(process.cwd());
      expect(result).toEqual({});
    });

    it('should skip comments and empty lines', async() => {
      const envContent = `
# This is a comment
NODE_ENV=development

# Another comment
PORT=3000

DATABASE_URL=postgres://localhost:5432/test
`;
      await fs.writeFile('.env', envContent);

      const result = await envReader.readExistingEnv(process.cwd());

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe('3000');
      expect(result.DATABASE_URL).toBe('postgres://localhost:5432/test');
      expect(result['# This is a comment']).toBeUndefined();
    });

    it('should handle quoted values', async() => {
      const envContent = `
NODE_ENV="development"
PORT='3000'
DATABASE_URL="postgres://localhost:5432/test"
`;
      await fs.writeFile('.env', envContent);

      const result = await envReader.readExistingEnv(process.cwd());

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe('3000');
      expect(result.DATABASE_URL).toBe('postgres://localhost:5432/test');
    });
  });

  describe('detectSensitiveValue', () => {
    it('should detect sensitive keys', () => {
      const sensitiveKeys = [
        'PASSWORD',
        'SECRET',
        'API_KEY',
        'PRIVATE_KEY',
        'JWT_SECRET',
        'DATABASE_PASSWORD',
        'REDIS_PASSWORD',
        'AUTH_TOKEN',
        'CREDENTIALS',
        'PASSWD',
        'PWD'
      ];

      sensitiveKeys.forEach(key => {
        expect(envReader.detectSensitiveValue(key, 'any-value')).toBe(true);
      });
    });

    it('should detect sensitive values by pattern', () => {
      const sensitiveValues = [
        '550e8400-e29b-41d4-a716-446655440000', // UUID
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // JWT
        'SGVsbG8gV29ybGQ=', // Base64
        'a'.repeat(50), // Long random string
        '1234567890abcdef1234567890abcdef' // Hex string
      ];

      sensitiveValues.forEach(value => {
        expect(envReader.detectSensitiveValue('TEST_KEY', value)).toBe(true);
      });
    });

    it('should not detect non-sensitive values', () => {
      const nonSensitiveValues = [
        'development',
        '3000',
        'https://example.com',
        'localhost',
        'my-app',
        'true',
        'false'
      ];

      nonSensitiveValues.forEach(value => {
        expect(envReader.detectSensitiveValue('TEST_VALUE', value)).toBe(false);
      });
    });
  });

  describe('convertToEnvTemplate', () => {
    it('should convert sensitive values to kv:// references', () => {
      const existingEnv = {
        'NODE_ENV': 'development',
        'PORT': '3000',
        'DATABASE_PASSWORD': 'secret123',
        'API_KEY': 'abc123def456',
        'PUBLIC_URL': 'https://example.com'
      };

      const requiredVars = {
        'APP_NAME': 'test-app'
      };

      const result = envReader.convertToEnvTemplate(existingEnv, requiredVars);

      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe('3000');
      expect(result.DATABASE_PASSWORD).toBe('kv://database-password');
      expect(result.API_KEY).toBe('kv://api-key');
      expect(result.PUBLIC_URL).toBe('https://example.com');
      expect(result.APP_NAME).toBe('test-app');
    });

    it('should handle empty existing environment', () => {
      const result = envReader.convertToEnvTemplate({}, { APP_NAME: 'test-app' });
      expect(result.APP_NAME).toBe('test-app');
    });
  });

  describe('generateSecretsFromEnv', () => {
    it('should extract sensitive values for secrets', () => {
      const envVars = {
        'NODE_ENV': 'development',
        'PORT': '3000',
        'DATABASE_PASSWORD': 'secret123',
        'API_KEY': 'abc123def456',
        'JWT_SECRET': 'jwt-secret-value',
        'PUBLIC_URL': 'https://example.com'
      };

      const result = envReader.generateSecretsFromEnv(envVars);

      expect(result['database-password']).toBe('secret123');
      expect(result['api-key']).toBe('abc123def456');
      expect(result['jwt-secret']).toBe('jwt-secret-value');
      expect(result['node-env']).toBeUndefined();
      expect(result['port']).toBeUndefined();
      expect(result['public-url']).toBeUndefined();
    });

    it('should handle empty environment variables', () => {
      const result = envReader.generateSecretsFromEnv({});
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('validateEnvKey', () => {
    it('should validate proper environment variable names', () => {
      const validKeys = [
        'NODE_ENV',
        'PORT',
        'DATABASE_URL',
        'API_KEY',
        'JWT_SECRET',
        'REDIS_PASSWORD'
      ];

      validKeys.forEach(key => {
        expect(envReader.validateEnvKey(key)).toBe(true);
      });
    });

    it('should reject invalid environment variable names', () => {
      const invalidKeys = [
        'node_env', // lowercase
        'port-3000', // dash
        'database.url', // dot
        'api key', // space
        '123PORT', // starts with number
        'PORT@', // special character
        '' // empty
      ];

      invalidKeys.forEach(key => {
        expect(envReader.validateEnvKey(key)).toBe(false);
      });
    });
  });

  describe('sanitizeEnvValue', () => {
    it('should remove injection characters', () => {
      const testCases = [
        { input: 'value;rm -rf /', expected: 'valuerm -rf /' },
        { input: 'value\r\n', expected: 'value' },
        { input: 'value\n', expected: 'value' },
        { input: 'value\r', expected: 'value' },
        { input: 'normal-value', expected: 'normal-value' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(envReader.sanitizeEnvValue(input)).toBe(expected);
      });
    });
  });

  describe('generateEnvTemplate', () => {
    it('should generate template with existing environment conversion', async() => {
      const config = {
        port: 3000,
        appName: 'test-app',
        database: true,
        authentication: true
      };

      const existingEnv = {
        'NODE_ENV': 'development',
        'DATABASE_PASSWORD': 'secret123',
        'API_KEY': 'abc123def456',
        'PUBLIC_URL': 'https://example.com'
      };

      const result = await envReader.generateEnvTemplate(config, existingEnv);

      expect(result.template).toContain('NODE_ENV=development');
      expect(result.template).toContain('DB_PASSWORD=kv://databases-test-app-0-passwordKeyVault');
      expect(result.template).toContain('DB_USER=test_app_user');
      expect(result.template).toContain('API_KEY=kv://api-key');
      expect(result.template).toContain('PUBLIC_URL=https://example.com');
      expect(result.template).toContain('PORT=3000');
      expect(result.template).toContain('APP_NAME=test-app');

      expect(result.secrets['database-password']).toBe('secret123');
      expect(result.secrets['api-key']).toBe('abc123def456');
    });

    it('should handle validation warnings', async() => {
      const config = {
        port: 3000,
        appName: 'test-app',
        database: true
      };

      const existingEnv = {
        'invalid-key': 'value', // invalid key format
        'PORT': '3000;rm -rf /' // contains injection characters
      };

      const result = await envReader.generateEnvTemplate(config, existingEnv);

      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('Invalid environment variable name: invalid-key');
      expect(result.warnings[1]).toContain('Sanitized value for PORT');
    });
  });
});
