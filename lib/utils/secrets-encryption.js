/**
 * AI Fabrix Builder Secrets Encryption Utilities
 *
 * This module provides encryption and decryption functions for secrets
 * using AES-256-GCM algorithm for ISO 27001 compliance.
 *
 * @fileoverview Secrets encryption utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Validates encryption key format
 * Key must be 32 bytes (256 bits) for AES-256
 * Accepts hex string (64 chars) or base64 string (44 chars)
 *
 * @function validateEncryptionKey
 * @param {string} key - Encryption key to validate
 * @returns {boolean} True if key is valid
 * @throws {Error} If key format is invalid
 */
function validateEncryptionKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Encryption key is required and must be a string');
  }

  // Try to parse as hex (64 characters = 32 bytes)
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return true;
  }

  // Try to parse as base64 (44 characters = 32 bytes)
  if (key.length === 44) {
    try {
      const buffer = Buffer.from(key, 'base64');
      if (buffer.length === KEY_LENGTH) {
        return true;
      }
    } catch (error) {
      // Not valid base64
    }
  }

  throw new Error(`Encryption key must be 32 bytes (64 hex characters or 44 base64 characters). Got ${key.length} characters`);
}

/**
 * Normalizes encryption key to Buffer
 * Converts hex or base64 string to 32-byte buffer
 *
 * @function normalizeKey
 * @param {string} key - Encryption key (hex or base64)
 * @returns {Buffer} 32-byte key buffer
 */
function normalizeKey(key) {
  validateEncryptionKey(key);

  // Try hex first (64 characters)
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  // Try base64 (44 characters)
  if (key.length === 44) {
    const buffer = Buffer.from(key, 'base64');
    if (buffer.length === KEY_LENGTH) {
      return buffer;
    }
  }

  throw new Error('Invalid encryption key format');
}

/**
 * Encrypts a secret value using AES-256-GCM
 * Returns encrypted value in format: secure://<iv>:<ciphertext>:<authTag>
 * All components are base64 encoded
 *
 * @function encryptSecret
 * @param {string} value - Plaintext secret value to encrypt
 * @param {string} key - Encryption key (hex or base64, 32 bytes)
 * @returns {string} Encrypted value with secure:// prefix
 * @throws {Error} If encryption fails or key is invalid
 *
 * @example
 * const encrypted = encryptSecret('my-secret', 'a1b2c3...');
 * // Returns: 'secure://<iv>:<ciphertext>:<authTag>'
 */
function encryptSecret(value, key) {
  if (typeof value !== 'string') {
    throw new Error('Value is required and must be a string');
  }

  const keyBuffer = normalizeKey(key);

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  // Encrypt
  let ciphertext = cipher.update(value, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Format: secure://<iv>:<ciphertext>:<authTag>
  return `secure://${iv.toString('base64')}:${ciphertext}:${authTag.toString('base64')}`;
}

/**
 * Decrypts an encrypted secret value
 * Handles secure:// prefixed values and extracts IV, ciphertext, and auth tag
 *
 * @function decryptSecret
 * @param {string} encryptedValue - Encrypted value with secure:// prefix
 * @param {string} key - Encryption key (hex or base64, 32 bytes)
 * @returns {string} Decrypted plaintext value
 * @throws {Error} If decryption fails, key is invalid, or format is incorrect
 *
 * @example
 * const decrypted = decryptSecret('secure://<iv>:<ciphertext>:<authTag>', 'a1b2c3...');
 * // Returns: 'my-secret'
 */
function decryptSecret(encryptedValue, key) {
  if (!encryptedValue || typeof encryptedValue !== 'string') {
    throw new Error('Encrypted value is required and must be a string');
  }

  if (!encryptedValue.startsWith('secure://')) {
    throw new Error('Encrypted value must start with secure:// prefix');
  }

  const keyBuffer = normalizeKey(key);

  // Remove secure:// prefix
  const parts = encryptedValue.substring(9).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format. Expected: secure://<iv>:<ciphertext>:<authTag>');
  }

  const [ivBase64, ciphertext, authTagBase64] = parts;

  try {
    // Decode IV and auth tag
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (error) {
    // Don't expose sensitive details in error messages
    if (error.message.includes('Unsupported state') || error.message.includes('bad decrypt')) {
      throw new Error('Decryption failed: invalid key or corrupted data');
    }
    throw error;
  }
}

/**
 * Checks if a value is encrypted (starts with secure://)
 *
 * @function isEncrypted
 * @param {string} value - Value to check
 * @returns {boolean} True if value is encrypted
 */
function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('secure://');
}

module.exports = {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  validateEncryptionKey,
  normalizeKey
};

