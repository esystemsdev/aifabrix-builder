/**
 * Tests for secrets encryption utilities
 *
 * @fileoverview Tests for secrets encryption and decryption functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  validateEncryptionKey,
  normalizeKey
} = require('../../../lib/utils/secrets-encryption');

describe('secrets-encryption', () => {
  // Generate a valid 32-byte key (64 hex characters)
  const validHexKey = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
  const validBase64Key = Buffer.from(validHexKey, 'hex').toString('base64');

  describe('validateEncryptionKey', () => {
    it('should accept valid hex key (64 characters)', () => {
      expect(() => validateEncryptionKey(validHexKey)).not.toThrow();
    });

    it('should accept valid base64 key (44 characters)', () => {
      expect(() => validateEncryptionKey(validBase64Key)).not.toThrow();
    });

    it('should reject invalid key length', () => {
      expect(() => validateEncryptionKey('short')).toThrow('Encryption key must be 32 bytes');
    });

    it('should reject null key', () => {
      expect(() => validateEncryptionKey(null)).toThrow('Encryption key is required');
    });

    it('should reject undefined key', () => {
      expect(() => validateEncryptionKey(undefined)).toThrow('Encryption key is required');
    });

    it('should reject non-string key', () => {
      expect(() => validateEncryptionKey(12345)).toThrow('Encryption key is required');
    });
  });

  describe('normalizeKey', () => {
    it('should normalize hex key to buffer', () => {
      const buffer = normalizeKey(validHexKey);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(32);
    });

    it('should normalize base64 key to buffer', () => {
      const buffer = normalizeKey(validBase64Key);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(32);
    });

    it('should throw on invalid key', () => {
      expect(() => normalizeKey('invalid')).toThrow();
    });
  });

  describe('encryptSecret', () => {
    it('should encrypt a secret value', () => {
      const plaintext = 'my-secret-value';
      const encrypted = encryptSecret(plaintext, validHexKey);

      expect(encrypted).toMatch(/^secure:\/\//);
      expect(encrypted).toContain(':');
      // Should have format: secure://<iv>:<ciphertext>:<authTag>
      const parts = encrypted.substring(9).split(':');
      expect(parts.length).toBe(3);
    });

    it('should produce different encrypted values for same plaintext (IV is random)', () => {
      const plaintext = 'same-secret';
      const encrypted1 = encryptSecret(plaintext, validHexKey);
      const encrypted2 = encryptSecret(plaintext, validHexKey);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should encrypt empty string', () => {
      const encrypted = encryptSecret('', validHexKey);
      expect(encrypted).toMatch(/^secure:\/\//);
    });

    it('should throw on null value', () => {
      expect(() => encryptSecret(null, validHexKey)).toThrow('Value is required');
    });

    it('should throw on undefined value', () => {
      expect(() => encryptSecret(undefined, validHexKey)).toThrow('Value is required');
    });

    it('should throw on non-string value', () => {
      expect(() => encryptSecret(12345, validHexKey)).toThrow('Value is required');
    });

    it('should throw on invalid key', () => {
      expect(() => encryptSecret('value', 'invalid-key')).toThrow();
    });
  });

  describe('decryptSecret', () => {
    it('should decrypt an encrypted value', () => {
      const plaintext = 'my-secret-value';
      const encrypted = encryptSecret(plaintext, validHexKey);
      const decrypted = decryptSecret(encrypted, validHexKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt values encrypted with different IVs', () => {
      const plaintext = 'same-secret';
      const encrypted1 = encryptSecret(plaintext, validHexKey);
      const encrypted2 = encryptSecret(plaintext, validHexKey);

      expect(decryptSecret(encrypted1, validHexKey)).toBe(plaintext);
      expect(decryptSecret(encrypted2, validHexKey)).toBe(plaintext);
    });

    it('should decrypt empty string', () => {
      const encrypted = encryptSecret('', validHexKey);
      const decrypted = decryptSecret(encrypted, validHexKey);
      expect(decrypted).toBe('');
    });

    it('should throw on value without secure:// prefix', () => {
      expect(() => decryptSecret('not-encrypted', validHexKey)).toThrow('must start with secure://');
    });

    it('should throw on invalid format', () => {
      expect(() => decryptSecret('secure://invalid', validHexKey)).toThrow('Invalid encrypted value format');
    });

    it('should throw on wrong key', () => {
      const plaintext = 'my-secret';
      const encrypted = encryptSecret(plaintext, validHexKey);
      const wrongKey = 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678';

      expect(() => decryptSecret(encrypted, wrongKey)).toThrow('Decryption failed');
    });

    it('should throw on corrupted data', () => {
      const encrypted = 'secure://invalid:data:format';
      expect(() => decryptSecret(encrypted, validHexKey)).toThrow();
    });

    it('should throw on null value', () => {
      expect(() => decryptSecret(null, validHexKey)).toThrow('Encrypted value is required');
    });

    it('should throw on undefined value', () => {
      expect(() => decryptSecret(undefined, validHexKey)).toThrow('Encrypted value is required');
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted value', () => {
      const encrypted = encryptSecret('secret', validHexKey);
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plaintext', () => {
      expect(isEncrypted('plaintext')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isEncrypted(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isEncrypted(undefined)).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(isEncrypted(12345)).toBe(false);
    });
  });

  describe('round-trip encryption', () => {
    it('should encrypt and decrypt various values', () => {
      const testValues = [
        'simple',
        'value-with-special-chars!@#$%^&*()',
        'value with spaces',
        'value\nwith\nnewlines',
        'value\twith\ttabs',
        'very-long-value-' + 'x'.repeat(1000),
        'unicode-测试-🚀',
        ''
      ];

      testValues.forEach(value => {
        const encrypted = encryptSecret(value, validHexKey);
        const decrypted = decryptSecret(encrypted, validHexKey);
        expect(decrypted).toBe(value);
      });
    });

    it('should work with base64 key', () => {
      const plaintext = 'my-secret';
      const encrypted = encryptSecret(plaintext, validBase64Key);
      const decrypted = decryptSecret(encrypted, validBase64Key);
      expect(decrypted).toBe(plaintext);
    });

    it('should work with hex and base64 keys interchangeably', () => {
      const plaintext = 'my-secret';
      // Encrypt with hex, decrypt with base64 (same key)
      const encrypted = encryptSecret(plaintext, validHexKey);
      const decrypted = decryptSecret(encrypted, validBase64Key);
      expect(decrypted).toBe(plaintext);
    });
  });
});

