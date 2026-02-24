/**
 * Tests for Secrets Validation Module
 *
 * @fileoverview Unit tests for lib/utils/secrets-validation.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('js-yaml', () => ({
  load: jest.fn()
}));

const yaml = require('js-yaml');
const {
  validateSecretsFile,
  keyMatchesNamingConvention
} = require('../../../lib/utils/secrets-validation');

describe('secrets-validation', () => {
  const cwd = process.cwd();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('keyMatchesNamingConvention', () => {
    it('returns true for keys ending with KeyVault', () => {
      expect(keyMatchesNamingConvention('postgres-passwordKeyVault')).toBe(true);
      expect(keyMatchesNamingConvention('myKeyVault')).toBe(true);
    });

    it('returns true for keys matching *KeyVault pattern', () => {
      expect(keyMatchesNamingConvention('aKeyVault')).toBe(true);
      expect(keyMatchesNamingConvention('db-1-passwordKeyVault')).toBe(true);
    });

    it('returns false for empty or non-string', () => {
      expect(keyMatchesNamingConvention('')).toBe(false);
      expect(keyMatchesNamingConvention(null)).toBe(false);
      expect(keyMatchesNamingConvention(undefined)).toBe(false);
      expect(keyMatchesNamingConvention(123)).toBe(false);
    });

    it('returns false for keys not ending with KeyVault', () => {
      expect(keyMatchesNamingConvention('postgres-password')).toBe(false);
      expect(keyMatchesNamingConvention('DATABASE_URL')).toBe(false);
      expect(keyMatchesNamingConvention('keyvault')).toBe(false);
    });
  });

  describe('validateSecretsFile', () => {
    it('returns invalid when path is missing or empty', () => {
      expect(validateSecretsFile('')).toEqual({
        valid: false,
        errors: ['Path is required'],
        path: ''
      });
      expect(validateSecretsFile(null)).toEqual({
        valid: false,
        errors: ['Path is required'],
        path: ''
      });
      expect(validateSecretsFile(undefined)).toEqual({
        valid: false,
        errors: ['Path is required'],
        path: ''
      });
    });

    it('returns invalid when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const result = validateSecretsFile('/nonexistent/secrets.yaml');
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringMatching(/File not found/));
      expect(result.path).toBe(path.resolve('/nonexistent/secrets.yaml'));
    });

    it('resolves relative path against cwd when file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const result = validateSecretsFile('secrets.local.yaml');
      expect(result.path).toBe(path.resolve(cwd, 'secrets.local.yaml'));
    });

    it('returns invalid when YAML is invalid', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid: yaml: [');
      yaml.load.mockImplementation(() => {
        throw new Error('bad indentation');
      });
      const result = validateSecretsFile('/path/secrets.yaml');
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringMatching(/Invalid YAML/));
      expect(result.path).toBe('/path/secrets.yaml');
    });

    it('returns valid for flat key-value object (no naming check)', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('postgres-passwordKeyVault: secret\nredis-url: redis://');
      yaml.load.mockReturnValue({
        'postgres-passwordKeyVault': 'secret',
        'redis-url': 'redis://'
      });
      const result = validateSecretsFile('/path/secrets.yaml');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.path).toBe('/path/secrets.yaml');
    });

    it('returns invalid when parsed value is not an object (array)', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- a\n- b');
      yaml.load.mockReturnValue(['a', 'b']);
      const result = validateSecretsFile('/path/secrets.yaml');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('flat key-value object'))).toBe(true);
    });

    it('returns invalid when value is nested object', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('key: { nested: true }');
      yaml.load.mockReturnValue({ key: { nested: true } });
      const result = validateSecretsFile('/path/secrets.yaml');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('nested objects'))).toBe(true);
    });

    it('with checkNaming adds error for key not ending with KeyVault', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('DATABASE_PASSWORD: x');
      yaml.load.mockReturnValue({ DATABASE_PASSWORD: 'x' });
      const result = validateSecretsFile('/path/secrets.yaml', { checkNaming: true });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('*KeyVault'))).toBe(true);
    });

    it('with checkNaming passes when all keys end with KeyVault', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('postgres-passwordKeyVault: x');
      yaml.load.mockReturnValue({ 'postgres-passwordKeyVault': 'x' });
      const result = validateSecretsFile('/path/secrets.yaml', { checkNaming: true });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('allows string and number values', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('a: hello\nb: 42');
      yaml.load.mockReturnValue({ a: 'hello', b: 42 });
      const result = validateSecretsFile('/path/secrets.yaml');
      expect(result.valid).toBe(true);
    });

    it('uses absolute path as-is when given absolute path', () => {
      fs.existsSync.mockReturnValue(false);
      const absPath = path.isAbsolute('/foo') ? '/foo/secrets.yaml' : path.join(cwd, 'foo', 'secrets.yaml');
      const result = validateSecretsFile(absPath);
      expect(result.path).toBe(absPath);
    });
  });
});
