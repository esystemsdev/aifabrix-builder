/**
 * AI Fabrix Builder YAML Preservation Utilities
 *
 * This module provides line-by-line YAML parsing that preserves comments,
 * formatting, and structure while encrypting values.
 *
 * @fileoverview YAML preservation utilities for secure command
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { encryptSecret, isEncrypted } = require('./secrets-encryption');

/**
 * Checks if a string value represents a YAML primitive (number, boolean, null)
 * When parsing line-by-line, these appear as strings but should not be encrypted
 *
 * @function isYamlPrimitive
 * @param {string} value - Value to check
 * @returns {boolean} True if value is a YAML primitive
 */
function isYamlPrimitive(value) {
  const trimmed = value.trim();

  // Check for null
  if (trimmed === 'null' || trimmed === '~' || trimmed === '') {
    return true;
  }

  // Check for boolean
  if (trimmed === 'true' || trimmed === 'false' || trimmed === 'True' || trimmed === 'False' ||
      trimmed === 'TRUE' || trimmed === 'FALSE' || trimmed === 'yes' || trimmed === 'no' ||
      trimmed === 'Yes' || trimmed === 'No' || trimmed === 'YES' || trimmed === 'NO' ||
      trimmed === 'on' || trimmed === 'off' || trimmed === 'On' || trimmed === 'Off' ||
      trimmed === 'ON' || trimmed === 'OFF') {
    return true;
  }

  // Check for number (integer or float, with optional sign)
  if (/^[+-]?\d+$/.test(trimmed) || /^[+-]?\d*\.\d+([eE][+-]?\d+)?$/.test(trimmed) ||
      /^[+-]?\.\d+([eE][+-]?\d+)?$/.test(trimmed) || /^0x[0-9a-fA-F]+$/.test(trimmed) ||
      /^0o[0-7]+$/.test(trimmed) || /^0b[01]+$/.test(trimmed)) {
    return true;
  }

  // Check for YAML special values
  if (trimmed === '.inf' || trimmed === '.Inf' || trimmed === '.INF' ||
      trimmed === '-.inf' || trimmed === '-.Inf' || trimmed === '-.INF' ||
      trimmed === '.nan' || trimmed === '.NaN' || trimmed === '.NAN') {
    return true;
  }

  return false;
}

/**
 * Checks if a value should be encrypted
 * URLs (http:// and https://) are not encrypted as they are not secrets
 * YAML primitives (numbers, booleans, null) are not encrypted
 *
 * @function shouldEncryptValue
 * @param {string} value - Value to check
 * @returns {boolean} True if value should be encrypted
 */
function shouldEncryptValue(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();

  // Skip empty or whitespace-only values
  if (trimmed.length === 0) {
    return false;
  }

  // Skip YAML primitives (numbers, booleans, null)
  if (isYamlPrimitive(trimmed)) {
    return false;
  }

  // Skip already encrypted values
  if (isEncrypted(trimmed)) {
    return false;
  }

  // Skip URLs - they are not secrets
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return false;
  }

  return true;
}

/**
 * Extracts value from YAML line, handling quotes
 * Removes quotes but remembers if they were present
 *
 * @function extractValue
 * @param {string} valuePart - The value portion of a YAML line
 * @returns {Object} Object with value and quote info
 */
function extractValue(valuePart) {
  const trimmed = valuePart.trim();

  // Check for quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
    const quote = trimmed[0];
    const unquoted = trimmed.slice(1, -1);
    return { value: unquoted, quoted: true, quoteChar: quote };
  }

  return { value: trimmed, quoted: false, quoteChar: null };
}

/**
 * Formats value back with quotes if needed
 *
 * @function formatValue
 * @param {string} value - Value to format
 * @param {boolean} quoted - Whether value was originally quoted
 * @param {string|null} quoteChar - Original quote character
 * @returns {string} Formatted value
 */
function formatValue(value, quoted, quoteChar) {
  if (quoted && quoteChar) {
    return `${quoteChar}${value}${quoteChar}`;
  }
  return value;
}

/**
 * Encrypts YAML values while preserving comments and formatting
 * Processes file line-by-line to maintain structure
 *
 * @function encryptYamlValues
 * @param {string} content - Original YAML file content
 * @param {string} encryptionKey - Encryption key
 * @returns {Object} Object with encrypted content and statistics
 * @returns {string} returns.content - Encrypted YAML content
 * @returns {number} returns.encrypted - Count of encrypted values
 * @returns {number} returns.total - Total count of values processed
 *
 * @example
 * const result = encryptYamlValues(yamlContent, encryptionKey);
 * // Returns: { content: '...', encrypted: 5, total: 10 }
 */
function encryptYamlValues(content, encryptionKey) {
  const lines = content.split(/\r?\n/);
  const encryptedLines = [];
  let encryptedCount = 0;
  let totalCount = 0;

  // Pattern to match key-value pairs with optional comments
  // Matches: indentation, key, colon, value, optional whitespace, optional comment
  // Handles: key: value, key: "value", key: value # comment, etc.
  const kvPattern = /^(\s*)([^#:\n]+?):\s*(.+?)(\s*)(#.*)?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Preserve empty lines and comment-only lines
    if (trimmed === '' || trimmed.startsWith('#')) {
      encryptedLines.push(line);
      continue;
    }

    // Try to match key-value pattern
    const match = line.match(kvPattern);
    if (match) {
      totalCount++;
      const [, indent, key, valuePart, trailingWhitespace, comment] = match;

      // Extract value (handle quotes)
      const { value, quoted, quoteChar } = extractValue(valuePart);

      // Check if value should be encrypted
      if (shouldEncryptValue(value)) {
        // Encrypt the value
        const encryptedValue = encryptSecret(value, encryptionKey);
        const formattedValue = formatValue(encryptedValue, quoted, quoteChar);

        // Reconstruct line with encrypted value
        const encryptedLine = `${indent}${key}: ${formattedValue}${trailingWhitespace}${comment || ''}`;
        encryptedLines.push(encryptedLine);
        encryptedCount++;
      } else {
        // Keep original line (already encrypted, URL, or non-string)
        encryptedLines.push(line);
      }
    } else {
      // Line doesn't match pattern (multiline value, complex structure, etc.)
      // Preserve as-is
      encryptedLines.push(line);
    }
  }

  return {
    content: encryptedLines.join('\n'),
    encrypted: encryptedCount,
    total: totalCount
  };
}

module.exports = {
  encryptYamlValues,
  shouldEncryptValue,
  isYamlPrimitive,
  extractValue,
  formatValue
};

