/**
 * Shared string redaction for file logs (audit, installation), CLI output, and
 * `aifabrix logs <app>` container env lines (PII / secrets).
 * Single implementation to avoid secret-handling drift between logs.
 *
 * @fileoverview Sensitive substring masking for operational logs
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

/** Env key patterns that indicate a secret (mask value) — same rules as aifabrix logs <app>. */
const SECRET_KEY_PATTERN = /password|secret|token|credential|api[_-]?key/i;

/** Prefixes to strip before checking key (avoids masking KEYCLOAK_SERVER_URL etc.) */
const KEY_PREFIXES_TO_STRIP = /^KEYCLOAK_|^KEY_VAULT_/;

/**
 * URL with embedded credentials: scheme://user:password@host → scheme://user:***@host
 * (shared with {@link maskEnvLine} / aifabrix logs <app> env dump)
 */
const URL_CREDENTIAL_PATTERN = /(\w+:\/\/)([^:@]*):([^@]+)@/g;

/**
 * Masks embedded user:password@ in URLs inside any string.
 *
 * @param {string} text
 * @returns {string}
 */
function maskUrlEmbeddedCredentials(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  return text.replace(URL_CREDENTIAL_PATTERN, '$1$2:***@');
}

/**
 * Masks a single env line (KEY=value) for PII/secrets — same behavior as aifabrix logs <app> environment dump.
 *
 * @param {string} line - Line in form KEY=value
 * @returns {string} Same line or KEY=*** or value with masked URL credentials
 */
function maskEnvLine(line) {
  const eq = line.indexOf('=');
  if (eq <= 0) {
    return line;
  }
  const key = line.slice(0, eq);
  const value = line.slice(eq + 1);

  const keyForCheck = key.replace(KEY_PREFIXES_TO_STRIP, '');
  const isSecretKey = SECRET_KEY_PATTERN.test(keyForCheck);

  const maskedValue = maskUrlEmbeddedCredentials(value);
  const hasUrlCredentials = maskedValue !== value;

  if (isSecretKey) {
    return `${key}=***`;
  }
  if (hasUrlCredentials) {
    return `${key}=${maskedValue}`;
  }
  return line;
}

/**
 * Masks sensitive data in strings (audit/installation log messages, metadata).
 * Also applies URL embedded-credential masking (same as {@link maskEnvLine} values).
 *
 * @param {string} value - Value to mask
 * @returns {string}
 */
function maskSensitiveData(value) {
  if (!value || typeof value !== 'string') {
    return value;
  }

  const sensitivePatterns = [
    { pattern: /password[=:]\s*([^\s]+)/gi, replacement: 'password=***' },
    { pattern: /secret[=:]\s*([^\s]+)/gi, replacement: 'secret=***' },
    { pattern: /key[=:]\s*([^\s]+)/gi, replacement: 'key=***' },
    { pattern: /token[=:]\s*([^\s]+)/gi, replacement: 'token=***' },
    { pattern: /api[_-]?key[=:]\s*([^\s]+)/gi, replacement: 'api_key=***' }
  ];

  let masked = value;
  for (const { pattern, replacement } of sensitivePatterns) {
    masked = masked.replace(pattern, replacement);
  }

  masked = maskUrlEmbeddedCredentials(masked);

  if (/^[a-f0-9]{32,}$/i.test(masked.trim())) {
    return '***';
  }

  return masked;
}

module.exports = {
  maskSensitiveData,
  maskEnvLine,
  maskUrlEmbeddedCredentials
};
