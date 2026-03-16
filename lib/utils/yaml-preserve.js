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
 * Check if value is null
 * @param {string} trimmed - Trimmed value
 * @returns {boolean} True if null
 */
function isNullValue(trimmed) {
  return trimmed === 'null' || trimmed === '~' || trimmed === '';
}

/**
 * Check if value is boolean
 * @param {string} trimmed - Trimmed value
 * @returns {boolean} True if boolean
 */
function isBooleanValue(trimmed) {
  const booleanValues = [
    'true', 'false', 'True', 'False', 'TRUE', 'FALSE',
    'yes', 'no', 'Yes', 'No', 'YES', 'NO',
    'on', 'off', 'On', 'Off', 'ON', 'OFF'
  ];
  return booleanValues.includes(trimmed);
}

/**
 * Check if value is number
 * @param {string} trimmed - Trimmed value
 * @returns {boolean} True if number
 */
function isNumberValue(trimmed) {
  return /^[+-]?\d+$/.test(trimmed) ||
    /^[+-]?\d*\.\d+([eE][+-]?\d+)?$/.test(trimmed) ||
    /^[+-]?\.\d+([eE][+-]?\d+)?$/.test(trimmed) ||
    /^0x[0-9a-fA-F]+$/.test(trimmed) ||
    /^0o[0-7]+$/.test(trimmed) ||
    /^0b[01]+$/.test(trimmed);
}

/**
 * Check if value is YAML special value
 * @param {string} trimmed - Trimmed value
 * @returns {boolean} True if YAML special value
 */
function isYamlSpecialValue(trimmed) {
  const specialValues = [
    '.inf', '.Inf', '.INF',
    '-.inf', '-.Inf', '-.INF',
    '.nan', '.NaN', '.NAN'
  ];
  return specialValues.includes(trimmed);
}

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

  if (isNullValue(trimmed)) {
    return true;
  }

  if (isBooleanValue(trimmed)) {
    return true;
  }

  if (isNumberValue(trimmed)) {
    return true;
  }

  if (isYamlSpecialValue(trimmed)) {
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
/** Pattern for YAML block scalar indicator (e.g. key: >- or key: |) */
const BLOCK_SCALAR_PATTERN = /^(\s*)([^#:\n]+?):\s*(\|[-+]?|>[-+]?)(\s*)(#.*)?$/;

/**
 * Processes a single line for encryption
 * @function processLineForEncryption
 * @param {string} line - Line to process
 * @param {string} encryptionKey - Encryption key
 * @param {Object} stats - Statistics object
 * @returns {string} Processed line
 */
function processLineForEncryption(line, encryptionKey, stats) {
  const trimmed = line.trim();

  // Preserve empty lines and comment-only lines
  if (trimmed === '' || trimmed.startsWith('#')) {
    return line;
  }

  const kvPattern = /^(\s*)([^#:\n]+?):\s*(.+?)(\s*)(#.*)?$/;
  const match = line.match(kvPattern);
  if (!match) {
    return line;
  }

  stats.total++;
  const [, indent, key, valuePart, trailingWhitespace, comment] = match;
  const { value, quoted, quoteChar } = extractValue(valuePart);

  if (shouldEncryptValue(value)) {
    const encryptedValue = encryptSecret(value, encryptionKey);
    const formattedValue = formatValue(encryptedValue, quoted, quoteChar);
    stats.encrypted++;
    return `${indent}${key}: ${formattedValue}${trailingWhitespace}${comment || ''}`;
  }

  return line;
}

/**
 * Collects continuation lines for a YAML block scalar (value on next lines).
 * @param {string[]} lines - All lines
 * @param {number} startIndex - Index of line after the key: >- line
 * @param {number} keyIndentLen - Number of leading spaces on the key line
 * @returns {{ value: string, endIndex: number }} Combined value and index after last continuation line
 */
function collectBlockScalarLines(lines, startIndex, keyIndentLen) {
  const parts = [];
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    const contentTrimmed = line.trim();
    if (contentTrimmed === '' || contentTrimmed.startsWith('#')) {
      i++;
      continue;
    }
    const indentLen = line.length - line.trimStart().length;
    if (indentLen <= keyIndentLen) {
      break;
    }
    parts.push(contentTrimmed);
    i++;
  }
  return { value: parts.join(' '), endIndex: i };
}

/**
 * Processes a single block-scalar key line and its continuation lines.
 * @param {string} line - Line matching BLOCK_SCALAR_PATTERN
 * @param {string[]} lines - All lines
 * @param {number} lineIndex - Index of current line
 * @param {string} encryptionKey - Encryption key
 * @param {Object} stats - Mutable stats object
 * @returns {{ resultLine: string, nextIndex: number }|null} Result or null if not a block scalar
 */
function processBlockScalarLine(line, lines, lineIndex, encryptionKey, stats) {
  const blockMatch = line.match(BLOCK_SCALAR_PATTERN);
  if (!blockMatch) {
    return null;
  }
  const [, indent, key, blockIndicator, trailingWhitespace, comment] = blockMatch;
  const keyIndentLen = indent.length;
  const folded = blockIndicator.startsWith('>');
  const { value: rawValue, endIndex } = collectBlockScalarLines(lines, lineIndex + 1, keyIndentLen);
  const value = folded ? rawValue.replace(/\s+/g, ' ').trim() : rawValue;
  stats.total++;
  const needEncrypt = shouldEncryptValue(value);
  const outValue = needEncrypt ? encryptSecret(value, encryptionKey) : value;
  if (needEncrypt) {
    stats.encrypted++;
  }
  const resultLine = `${indent}${key}: ${outValue}${trailingWhitespace || ''}${comment || ''}`;
  return { resultLine, nextIndex: endIndex };
}

function encryptYamlValues(content, encryptionKey) {
  const lines = content.split(/\r?\n/);
  const encryptedLines = [];
  const stats = { encrypted: 0, total: 0 };
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      encryptedLines.push(line);
      i++;
      continue;
    }

    const blockResult = processBlockScalarLine(line, lines, i, encryptionKey, stats);
    if (blockResult) {
      encryptedLines.push(blockResult.resultLine);
      i = blockResult.nextIndex;
      continue;
    }

    encryptedLines.push(processLineForEncryption(line, encryptionKey, stats));
    i++;
  }

  return {
    content: encryptedLines.join('\n'),
    encrypted: stats.encrypted,
    total: stats.total
  };
}

module.exports = {
  encryptYamlValues,
  shouldEncryptValue,
  isYamlPrimitive,
  extractValue,
  formatValue
};

