/**
 * Tests for YAML preservation utilities
 *
 * @fileoverview Tests for yaml-preserve.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  encryptYamlValues,
  shouldEncryptValue,
  extractValue,
  formatValue
} = require('../../../lib/utils/yaml-preserve');
const { encryptSecret, isEncrypted } = require('../../../lib/utils/secrets-encryption');

describe('yaml-preserve', () => {
  const validHexKey = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

  describe('shouldEncryptValue', () => {
    it('should return true for plain string values', () => {
      expect(shouldEncryptValue('my-secret')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(shouldEncryptValue('')).toBe(false);
      expect(shouldEncryptValue('   ')).toBe(false);
    });

    it('should return false for already encrypted values', () => {
      const encrypted = encryptSecret('secret', validHexKey);
      expect(shouldEncryptValue(encrypted)).toBe(false);
    });

    it('should return false for http:// URLs', () => {
      expect(shouldEncryptValue('http://localhost:3000')).toBe(false);
      expect(shouldEncryptValue('http://example.com/path')).toBe(false);
    });

    it('should return false for https:// URLs', () => {
      expect(shouldEncryptValue('https://api.example.com')).toBe(false);
      expect(shouldEncryptValue('https://example.com:8080/path?query=value')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(shouldEncryptValue(123)).toBe(false);
      expect(shouldEncryptValue(true)).toBe(false);
      expect(shouldEncryptValue(null)).toBe(false);
      expect(shouldEncryptValue(undefined)).toBe(false);
    });

    it('should handle URLs with whitespace', () => {
      expect(shouldEncryptValue('  http://example.com  ')).toBe(false);
      expect(shouldEncryptValue('  https://example.com  ')).toBe(false);
    });
  });

  describe('extractValue', () => {
    it('should extract unquoted values', () => {
      const result = extractValue('my-value');
      expect(result.value).toBe('my-value');
      expect(result.quoted).toBe(false);
      expect(result.quoteChar).toBeNull();
    });

    it('should extract double-quoted values', () => {
      const result = extractValue('"my-value"');
      expect(result.value).toBe('my-value');
      expect(result.quoted).toBe(true);
      expect(result.quoteChar).toBe('"');
    });

    it('should extract single-quoted values', () => {
      const result = extractValue("'my-value'");
      expect(result.value).toBe('my-value');
      expect(result.quoted).toBe(true);
      expect(result.quoteChar).toBe("'");
    });

    it('should handle values with whitespace', () => {
      const result = extractValue('  my-value  ');
      expect(result.value).toBe('my-value');
    });
  });

  describe('formatValue', () => {
    it('should format unquoted values', () => {
      expect(formatValue('value', false, null)).toBe('value');
    });

    it('should format double-quoted values', () => {
      expect(formatValue('value', true, '"')).toBe('"value"');
    });

    it('should format single-quoted values', () => {
      expect(formatValue('value', true, "'")).toBe("'value'");
    });
  });

  describe('encryptYamlValues', () => {
    it('should preserve comments', () => {
      const content = `# Header comment
key1: value1
# Inline comment
key2: value2 # inline comment
key3: value3`;

      const result = encryptYamlValues(content, validHexKey);

      expect(result.content).toContain('# Header comment');
      expect(result.content).toContain('# Inline comment');
      expect(result.content).toContain('# inline comment');
      expect(result.encrypted).toBeGreaterThan(0);
    });

    it('should preserve blank lines', () => {
      const content = `key1: value1

key2: value2

key3: value3`;

      const result = encryptYamlValues(content, validHexKey);
      const lines = result.content.split('\n');

      // Check that blank lines are preserved
      expect(lines[1]).toBe('');
      expect(lines[3]).toBe('');
    });

    it('should preserve indentation', () => {
      const content = `  key1: value1
    key2: value2
key3: value3`;

      const result = encryptYamlValues(content, validHexKey);

      expect(result.content).toContain('  key1:');
      expect(result.content).toContain('    key2:');
      expect(result.content).toContain('key3:');
    });

    it('should skip encrypting URLs', () => {
      const content = `http-url: http://localhost:3000
https-url: https://api.example.com
secret-key: my-secret-value`;

      const result = encryptYamlValues(content, validHexKey);

      expect(result.content).toContain('http://localhost:3000');
      expect(result.content).toContain('https://api.example.com');
      expect(result.content).not.toContain('my-secret-value');
      expect(result.content).toMatch(/secret-key: secure:\/\//);
      expect(result.encrypted).toBe(1); // Only secret-key should be encrypted
    });

    it('should skip already encrypted values', () => {
      const encryptedValue = encryptSecret('original', validHexKey);
      const content = `encrypted-key: ${encryptedValue}
plain-key: plain-value`;

      const result = encryptYamlValues(content, validHexKey);

      expect(result.content).toContain(encryptedValue);
      expect(result.content).not.toContain('plain-value');
      expect(result.content).toMatch(/plain-key: secure:\/\//);
      expect(result.encrypted).toBe(1); // Only plain-key should be encrypted
    });

    it('should preserve quoted strings', () => {
      const content = `single-quoted: 'value1'
double-quoted: "value2"
unquoted: value3`;

      const result = encryptYamlValues(content, validHexKey);

      // Check that quotes are preserved
      expect(result.content).toMatch(/single-quoted: 'secure:\/\//);
      expect(result.content).toMatch(/double-quoted: "secure:\/\//);
      expect(result.content).toMatch(/unquoted: secure:\/\//);
    });

    it('should handle inline comments', () => {
      const content = `key1: value1 # comment 1
key2: value2#comment 2
key3: value3  # comment 3`;

      const result = encryptYamlValues(content, validHexKey);

      expect(result.content).toContain('# comment 1');
      expect(result.content).toContain('#comment 2');
      expect(result.content).toContain('# comment 3');
    });

    it('should handle empty values', () => {
      const content = `empty-key: ""
whitespace-key: "   "
normal-key: value`;

      const result = encryptYamlValues(content, validHexKey);

      expect(result.content).toContain('empty-key: ""');
      expect(result.content).toContain('whitespace-key: "   "');
      expect(result.content).not.toContain('normal-key: value');
      expect(result.encrypted).toBe(1); // Only normal-key should be encrypted
    });

    it('should handle complex YAML with all features', () => {
      // Store the encrypted value to check for it later (encryption produces different values each time)
      const alreadyEncryptedValue = encryptSecret('already-encrypted', validHexKey);
      const content = `# Header comment
# Another comment

key1: value1 # inline comment
key2: "quoted-value"
key3: http://localhost:3000
key4: https://api.example.com
key5: ${alreadyEncryptedValue}

# Section comment
key6: another-value
`;

      const result = encryptYamlValues(content, validHexKey);

      // Verify all comments preserved
      expect(result.content).toContain('# Header comment');
      expect(result.content).toContain('# Another comment');
      expect(result.content).toContain('# inline comment');
      expect(result.content).toContain('# Section comment');

      // Verify blank lines preserved
      const lines = result.content.split('\n');
      expect(lines[2]).toBe(''); // Blank line after comments

      // Verify URLs not encrypted
      expect(result.content).toContain('http://localhost:3000');
      expect(result.content).toContain('https://api.example.com');

      // Verify already encrypted value preserved (not re-encrypted)
      expect(result.content).toContain(alreadyEncryptedValue);

      // Verify values were encrypted
      expect(result.content).toMatch(/key1: secure:\/\//);
      expect(result.content).toMatch(/key2: "secure:\/\//);
      expect(result.content).toMatch(/key6: secure:\/\//);

      expect(result.encrypted).toBe(3); // key1, key2, key6
    });

    it('should handle URLs in quotes', () => {
      const content = `url1: "http://example.com"
url2: 'https://api.example.com'
url3: http://localhost:3000
secret: my-secret`;

      const result = encryptYamlValues(content, validHexKey);

      // URLs should not be encrypted even if quoted
      expect(result.content).toContain('"http://example.com"');
      expect(result.content).toContain("'https://api.example.com'");
      expect(result.content).toContain('http://localhost:3000');
      
      // Secret should be encrypted
      expect(result.content).toMatch(/secret: secure:\/\//);
      expect(result.encrypted).toBe(1);
    });

    it('should preserve key order', () => {
      const content = `z-key: value-z
a-key: value-a
m-key: value-m`;

      const result = encryptYamlValues(content, validHexKey);
      const lines = result.content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

      // Check order is preserved
      expect(lines[0]).toContain('z-key:');
      expect(lines[1]).toContain('a-key:');
      expect(lines[2]).toContain('m-key:');
    });

    it('should handle values with special characters', () => {
      const content = `special-key: value-with-special-chars!@#$%^&*()`;

      const result = encryptYamlValues(content, validHexKey);

      expect(result.content).toMatch(/special-key: secure:\/\//);
      expect(result.encrypted).toBe(1);
    });

    it('should handle multiline comment blocks', () => {
      const content = `# Line 1 comment
# Line 2 comment
# Line 3 comment
key: value`;

      const result = encryptYamlValues(content, validHexKey);

      expect(result.content).toContain('# Line 1 comment');
      expect(result.content).toContain('# Line 2 comment');
      expect(result.content).toContain('# Line 3 comment');
      expect(result.content).toMatch(/key: secure:\/\//);
    });

    it('should return correct statistics', () => {
      const content = `key1: value1
key2: http://example.com
key3: value3
key4: ${encryptSecret('encrypted', validHexKey)}`;

      const result = encryptYamlValues(content, validHexKey);

      expect(result.total).toBe(4);
      expect(result.encrypted).toBe(2); // key1 and key3 (key2 is URL, key4 already encrypted)
    });

    it('should handle lines that do not match key-value pattern', () => {
      const content = `key1: value1
not-a-key-value-line
key2: value2`;

      const result = encryptYamlValues(content, validHexKey);

      // Non-matching lines should be preserved as-is
      expect(result.content).toContain('not-a-key-value-line');
      expect(result.content).toMatch(/key1: secure:\/\//);
      expect(result.content).toMatch(/key2: secure:\/\//);
    });

    it('should handle URLs with paths and query strings', () => {
      const content = `url1: http://example.com/path?query=value
url2: https://api.example.com:8080/v1/endpoint?param=123
secret: my-secret-value`;

      const result = encryptYamlValues(content, validHexKey);

      expect(result.content).toContain('http://example.com/path?query=value');
      expect(result.content).toContain('https://api.example.com:8080/v1/endpoint?param=123');
      expect(result.content).toMatch(/secret: secure:\/\//);
      expect(result.encrypted).toBe(1);
    });
  });
});

