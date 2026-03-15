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

// Mock config so getSecretsEncryptionKey is controllable (default: no encryption for backward-compat tests)
jest.mock('../../../lib/core/config', () => ({
  getSecretsEncryptionKey: jest.fn().mockResolvedValue(null)
}));

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../../../lib/utils/logger');
const pathsUtil = require('../../../lib/utils/paths');
const config = require('../../../lib/core/config');
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

    it('should merge new secret and update existing key in place (no duplicate keys)', async() => {
      const key = 'existing-key';
      const value = 'updated-value';
      const secretsPath = path.join('/home/user/.aifabrix', 'secrets.local.yaml');
      const existingContent = 'existing-key: old-value\nother-key: other-value\n';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(existingContent);

      await saveLocalSecret(key, value);

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('existing-key');
      expect(writtenContent).toContain('updated-value');
      expect(writtenContent).toContain('other-key');
      expect(writtenContent).toContain('other-value');
      expect((writtenContent.match(/existing-key/g) || []).length).toBe(1);
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

    it('should write new secret when existing file has invalid YAML (overwrites with valid YAML)', async() => {
      const key = 'test-key';
      const value = 'test-value';
      const existingContent = 'invalid: yaml: content: [unclosed';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(existingContent);

      await saveLocalSecret(key, value);

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('test-key');
      expect(writtenContent).toContain('test-value');
    });

    it('should write new secret when existing content is non-object (merge treats as empty)', async() => {
      const key = 'test-key';
      const value = 'test-value';
      const existingContent = 'just a string';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(existingContent);

      await saveLocalSecret(key, value);

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('test-key');
      expect(writtenContent).toContain('test-value');
    });

    it('should write encrypted value (secure://) when encryption key is set', async() => {
      config.getSecretsEncryptionKey.mockResolvedValueOnce('a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd');
      const key = 'some-keyKeyVault';
      const value = 'plain-value';
      fs.existsSync.mockReturnValue(false);

      await saveLocalSecret(key, value);

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toMatch(/secure:\/\//);
      expect(writtenContent).toContain('some-keyKeyVault');
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

    it('should merge new secret and preserve existing keys (update in place)', async() => {
      const key = 'existing-key';
      const value = 'updated-value';
      const secretsPath = '/custom/path/secrets.yaml';
      const existingContent = 'existing-key: old-value\nother-key: other-value\n';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(existingContent);

      await saveSecret(key, value, secretsPath);

      const writtenContent = fs.writeFileSync.mock.calls[0][1];
      expect(writtenContent).toContain('existing-key');
      expect(writtenContent).toContain('updated-value');
      expect(writtenContent).toContain('other-key');
      expect(writtenContent).toContain('other-value');
      expect((writtenContent.match(/existing-key/g) || []).length).toBe(1);
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

