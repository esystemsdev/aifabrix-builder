/**
 * Tests for Token Encryption Utilities
 *
 * @fileoverview Tests for token encryption and decryption functions
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const {
  encryptToken,
  decryptToken,
  isTokenEncrypted
} = require('../../../lib/utils/token-encryption');

// Mock secrets-encryption module
jest.mock('../../../lib/utils/secrets-encryption', () => ({
  encryptSecret: jest.fn(),
  decryptSecret: jest.fn(),
  isEncrypted: jest.fn()
}));

const { encryptSecret, decryptSecret, isEncrypted } = require('../../../lib/utils/secrets-encryption');

describe('token-encryption', () => {
  const validHexKey = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
  const plaintext = 'my-token-value-123';
  const encryptedValue = 'secure://xK9mP2qR5tW8vY1z:AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdef:ZxYwVuTsRqPoNmLkJiHgFeDcBa9876543210';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('encryptToken', () => {
    it('should call encryptSecret with value and key', () => {
      encryptSecret.mockReturnValue(encryptedValue);

      const result = encryptToken(plaintext, validHexKey);

      expect(encryptSecret).toHaveBeenCalledWith(plaintext, validHexKey);
      expect(result).toBe(encryptedValue);
    });

    it('should propagate errors from encryptSecret', () => {
      const error = new Error('Encryption failed');
      encryptSecret.mockImplementation(() => {
        throw error;
      });

      expect(() => encryptToken(plaintext, validHexKey)).toThrow('Encryption failed');
      expect(encryptSecret).toHaveBeenCalledWith(plaintext, validHexKey);
    });

    it('should handle empty string', () => {
      encryptSecret.mockReturnValue('secure://empty:encrypted:tag');

      const result = encryptToken('', validHexKey);

      expect(encryptSecret).toHaveBeenCalledWith('', validHexKey);
      expect(result).toBe('secure://empty:encrypted:tag');
    });
  });

  describe('decryptToken', () => {
    it('should call decryptSecret with encrypted value and key', () => {
      decryptSecret.mockReturnValue(plaintext);

      const result = decryptToken(encryptedValue, validHexKey);

      expect(decryptSecret).toHaveBeenCalledWith(encryptedValue, validHexKey);
      expect(result).toBe(plaintext);
    });

    it('should propagate errors from decryptSecret', () => {
      const error = new Error('Decryption failed');
      decryptSecret.mockImplementation(() => {
        throw error;
      });

      expect(() => decryptToken(encryptedValue, validHexKey)).toThrow('Decryption failed');
      expect(decryptSecret).toHaveBeenCalledWith(encryptedValue, validHexKey);
    });

    it('should handle empty encrypted string', () => {
      decryptSecret.mockReturnValue('');

      const result = decryptToken('secure://empty:encrypted:tag', validHexKey);

      expect(decryptSecret).toHaveBeenCalledWith('secure://empty:encrypted:tag', validHexKey);
      expect(result).toBe('');
    });
  });

  describe('isTokenEncrypted', () => {
    it('should call isEncrypted with value', () => {
      isEncrypted.mockReturnValue(true);

      const result = isTokenEncrypted(encryptedValue);

      expect(isEncrypted).toHaveBeenCalledWith(encryptedValue);
      expect(result).toBe(true);
    });

    it('should return false for plain text tokens', () => {
      isEncrypted.mockReturnValue(false);

      const result = isTokenEncrypted(plaintext);

      expect(isEncrypted).toHaveBeenCalledWith(plaintext);
      expect(result).toBe(false);
    });

    it('should handle null value', () => {
      isEncrypted.mockReturnValue(false);

      const result = isTokenEncrypted(null);

      expect(isEncrypted).toHaveBeenCalledWith(null);
      expect(result).toBe(false);
    });

    it('should handle undefined value', () => {
      isEncrypted.mockReturnValue(false);

      const result = isTokenEncrypted(undefined);

      expect(isEncrypted).toHaveBeenCalledWith(undefined);
      expect(result).toBe(false);
    });
  });
});

