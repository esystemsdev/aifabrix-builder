/**
 * AI Fabrix Builder Token Encryption Utilities
 *
 * This module provides encryption and decryption functions for authentication tokens
 * using AES-256-GCM algorithm for ISO 27001 compliance.
 * Reuses the same encryption infrastructure as secrets encryption.
 *
 * @fileoverview Token encryption utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { encryptSecret, decryptSecret, isEncrypted } = require('./secrets-encryption');

/**
 * Encrypts a token value using AES-256-GCM
 * Returns encrypted value in format: secure://<iv>:<ciphertext>:<authTag>
 * All components are base64 encoded
 *
 * @function encryptToken
 * @param {string} value - Plaintext token value to encrypt
 * @param {string} key - Encryption key (hex or base64, 32 bytes)
 * @returns {string} Encrypted value with secure:// prefix
 * @throws {Error} If encryption fails or key is invalid
 *
 * @example
 * const encrypted = encryptToken('my-token', 'a1b2c3...');
 * // Returns: 'secure://<iv>:<ciphertext>:<authTag>'
 */
function encryptToken(value, key) {
  return encryptSecret(value, key);
}

/**
 * Decrypts an encrypted token value
 * Handles secure:// prefixed values and extracts IV, ciphertext, and auth tag
 *
 * @function decryptToken
 * @param {string} encryptedValue - Encrypted value with secure:// prefix
 * @param {string} key - Encryption key (hex or base64, 32 bytes)
 * @returns {string} Decrypted plaintext value
 * @throws {Error} If decryption fails, key is invalid, or format is incorrect
 *
 * @example
 * const decrypted = decryptToken('secure://<iv>:<ciphertext>:<authTag>', 'a1b2c3...');
 * // Returns: 'my-token'
 */
function decryptToken(encryptedValue, key) {
  return decryptSecret(encryptedValue, key);
}

/**
 * Checks if a token value is encrypted (starts with secure://)
 *
 * @function isTokenEncrypted
 * @param {string} value - Value to check
 * @returns {boolean} True if value is encrypted
 */
function isTokenEncrypted(value) {
  return isEncrypted(value);
}

module.exports = {
  encryptToken,
  decryptToken,
  isTokenEncrypted
};

