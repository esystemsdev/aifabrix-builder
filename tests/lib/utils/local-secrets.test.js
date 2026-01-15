/**
 * Tests for Local Secrets Module
 *
 * @fileoverview Unit tests for lib/utils/local-secrets.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock paths
jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn(() => '/home/user/.aifabrix')
}));

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../../../lib/utils/logger');
const pathsUtil = require('../../../lib/utils/paths');
const { saveLocalSecret, saveSecret, isLocalhost } = require('../../../lib/utils/local-secrets');

describe('Local Secrets Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync = jest.fn();
    fs.readFileSync = jest.fn();
    fs.writeFileSync = jest.fn();
    fs.mkdirSync = jest.fn();
  });

  describe('saveLocalSecret', () => {
    it('should save secret to local secrets file', async() => {
      const key = 'test-key';
      const value = 'test-value';
      const secretsPath = path.join('/home/user/.aifabrix', 'secrets.local.yaml');
      const secretsDir = path.dirname(secretsPath);

      fs.existsSync
        .mockReturnValueOnce(false) // Directory doesn't exist
        .mockReturnValueOnce(false); // File doesn't exist

      await saveLocalSecret(key, value);

      expect(pathsUtil.getAifabrixHome).toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalledWith(secretsDir, { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        secretsPath,
        expect.stringContaining('test-key'),
        { mode: 0o600 }
      );
    });

    it('should merge with existing secrets', async() => {
      const key = 'new-key';
      const value = 'new-value';
      const secretsPath = path.join('/home/user/.aifabrix', 'secrets.local.yaml');
      const existingSecrets = { 'existing-key': 'existing-value' };
      const existingContent = yaml.dump(existingSecrets);

      fs.existsSync
        .mockReturnValueOnce(true) // Directory exists
        .mockReturnValueOnce(true); // File exists
      fs.readFileSync.mockReturnValue(existingContent);

      await saveLocalSecret(key, value);

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      const parsed = yaml.load(writtenContent);
      expect(parsed['existing-key']).toBe('existing-value');
      expect(parsed['new-key']).toBe('new-value');
    });

    it('should throw error if key is missing', async() => {
      await expect(saveLocalSecret(null, 'value')).rejects.toThrow('Secret key is required');
    });

    it('should throw error if key is not a string', async() => {
      await expect(saveLocalSecret(123, 'value')).rejects.toThrow('Secret key is required');
    });

    it('should throw error if value is undefined', async() => {
      await expect(saveLocalSecret('key', undefined)).rejects.toThrow('Secret value is required');
    });

    it('should throw error if value is null', async() => {
      await expect(saveLocalSecret('key', null)).rejects.toThrow('Secret value is required');
    });

    it('should handle invalid YAML in existing file', async() => {
      const key = 'test-key';
      const value = 'test-value';
      const secretsPath = path.join('/home/user/.aifabrix', 'secrets.local.yaml');

      fs.existsSync
        .mockReturnValueOnce(true) // Directory exists
        .mockReturnValueOnce(true); // File exists
      fs.readFileSync.mockReturnValue('invalid: yaml: content: [unclosed');

      await saveLocalSecret(key, value);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Could not read existing secrets file'));
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle non-object YAML content', async() => {
      const key = 'test-key';
      const value = 'test-value';
      const secretsPath = path.join('/home/user/.aifabrix', 'secrets.local.yaml');

      fs.existsSync
        .mockReturnValueOnce(true) // Directory exists
        .mockReturnValueOnce(true); // File exists
      fs.readFileSync.mockReturnValue('just a string');

      await saveLocalSecret(key, value);

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      const parsed = yaml.load(writtenContent);
      expect(parsed['test-key']).toBe('test-value');
    });
  });

  describe('saveSecret', () => {
    it('should save secret to specified path', async() => {
      const key = 'test-key';
      const value = 'test-value';
      const secretsPath = '/custom/path/secrets.yaml';
      const secretsDir = path.dirname(secretsPath);

      fs.existsSync
        .mockReturnValueOnce(false) // Directory doesn't exist
        .mockReturnValueOnce(false); // File doesn't exist

      await saveSecret(key, value, secretsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(secretsDir, { recursive: true, mode: 0o700 });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        secretsPath,
        expect.stringContaining('test-key'),
        { mode: 0o600 }
      );
    });

    it('should resolve relative path', async() => {
      const key = 'test-key';
      const value = 'test-value';
      const secretsPath = './secrets.yaml';
      const resolvedPath = path.resolve(process.cwd(), secretsPath);
      const secretsDir = path.dirname(resolvedPath);

      fs.existsSync
        .mockReturnValueOnce(false) // Directory doesn't exist
        .mockReturnValueOnce(false); // File doesn't exist

      await saveSecret(key, value, secretsPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        resolvedPath,
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should merge with existing secrets', async() => {
      const key = 'new-key';
      const value = 'new-value';
      const secretsPath = '/custom/path/secrets.yaml';
      const existingSecrets = { 'existing-key': 'existing-value' };
      const existingContent = yaml.dump(existingSecrets);

      fs.existsSync
        .mockReturnValueOnce(true) // Directory exists
        .mockReturnValueOnce(true); // File exists
      fs.readFileSync.mockReturnValue(existingContent);

      await saveSecret(key, value, secretsPath);

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      const parsed = yaml.load(writtenContent);
      expect(parsed['existing-key']).toBe('existing-value');
      expect(parsed['new-key']).toBe('new-value');
    });

    it('should throw error if key is missing', async() => {
      await expect(saveSecret(null, 'value', '/path')).rejects.toThrow('Secret key is required');
    });

    it('should throw error if value is missing', async() => {
      await expect(saveSecret('key', null, '/path')).rejects.toThrow('Secret value is required');
    });

    it('should throw error if secretsPath is missing', async() => {
      await expect(saveSecret('key', 'value', null)).rejects.toThrow('Secrets path is required');
    });

    it('should throw error if secretsPath is not a string', async() => {
      await expect(saveSecret('key', 'value', 123)).rejects.toThrow('Secrets path is required');
    });
  });

  describe('isLocalhost', () => {
    it('should return true for localhost URL', () => {
      expect(isLocalhost('http://localhost:3000')).toBe(true);
    });

    it('should return true for 127.0.0.1 URL', () => {
      expect(isLocalhost('http://127.0.0.1:3000')).toBe(true);
    });

    it('should return true for localhost with uppercase', () => {
      expect(isLocalhost('http://LOCALHOST:3000')).toBe(true);
    });

    it('should return false for non-localhost URL', () => {
      expect(isLocalhost('http://example.com:3000')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isLocalhost(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isLocalhost(undefined)).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(isLocalhost(123)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isLocalhost('')).toBe(false);
    });
  });
});

