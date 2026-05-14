/**
 * @fileoverview Tests for lib/utils/log-redaction.js
 */

'use strict';

const { maskSensitiveData, maskEnvLine, maskUrlEmbeddedCredentials } = require('../../../lib/utils/log-redaction');

describe('log-redaction', () => {
  describe('maskSensitiveData', () => {
    it('returns non-string values unchanged', () => {
      expect(maskSensitiveData(null)).toBeNull();
      expect(maskSensitiveData(undefined)).toBeUndefined();
      expect(maskSensitiveData(123)).toBe(123);
      expect(maskSensitiveData({})).toEqual({});
    });

    it('masks password patterns', () => {
      expect(maskSensitiveData('password=secret123')).toBe('password=***');
    });

    it('masks secret patterns', () => {
      const result = maskSensitiveData('secret: mysecretkey');
      expect(result).toBe('secret=***');
    });

    it('masks key patterns', () => {
      expect(maskSensitiveData('key=myapikey123')).toBe('key=***');
    });

    it('masks token patterns', () => {
      expect(maskSensitiveData('token=abc123xyz')).toBe('token=***');
    });

    it('masks api_key patterns', () => {
      expect(maskSensitiveData('api_key=secretkey123')).toBe('api_key=***');
    });

    it('masks long hex strings', () => {
      const hexString = 'a1b2c3d4e5f6789012345678901234567890abcdef';
      expect(maskSensitiveData(hexString)).toBe('***');
    });

    it('does not mask short hex strings', () => {
      const shortHex = 'abc123';
      expect(maskSensitiveData(shortHex)).toBe(shortHex);
    });

    it('masks trimmed long hex strings', () => {
      const hexWithSpaces = '  a1b2c3d4e5f6789012345678901234567890abcdef  ';
      expect(maskSensitiveData(hexWithSpaces)).toBe('***');
    });

    it('masks embedded URL credentials (same as aifabrix logs <app> env values)', () => {
      expect(
        maskSensitiveData('conn postgresql://miso_user:miso_pass123@postgres:5432/miso')
      ).toBe('conn postgresql://miso_user:***@postgres:5432/miso');
    });

    it('returns empty string unchanged', () => {
      expect(maskSensitiveData('')).toBe('');
    });

    it('masks api-key (hyphen) variant', () => {
      expect(maskSensitiveData('api-key=sekret')).toBe('api_key=***');
    });

    it('applies keyword masking before URL masking in one string', () => {
      expect(maskSensitiveData('token=x postgresql://a:b@c/d')).toBe('token=*** postgresql://a:***@c/d');
    });

    it('does not treat URL-only string as long hex', () => {
      const withUrl = 'postgresql://u:deadbeefdeadbeefdeadbeefdeadbeef@h/db';
      expect(maskSensitiveData(withUrl)).toBe('postgresql://u:***@h/db');
    });
  });

  describe('maskUrlEmbeddedCredentials', () => {
    it('replaces user:password@ in supported URL schemes', () => {
      expect(maskUrlEmbeddedCredentials('postgresql://u:p@h/db')).toBe('postgresql://u:***@h/db');
    });

    it('returns non-string or empty input unchanged / passthrough', () => {
      expect(maskUrlEmbeddedCredentials(null)).toBeNull();
      expect(maskUrlEmbeddedCredentials(undefined)).toBeUndefined();
      expect(maskUrlEmbeddedCredentials(0)).toBe(0);
      expect(maskUrlEmbeddedCredentials('')).toBe('');
    });

    it('masks http and https URLs with credentials', () => {
      expect(maskUrlEmbeddedCredentials('http://user:pass@host/path')).toBe('http://user:***@host/path');
      expect(maskUrlEmbeddedCredentials('https://a:b@example.com/')).toBe('https://a:***@example.com/');
    });

    it('masks redis-style URL with password-only userinfo', () => {
      expect(maskUrlEmbeddedCredentials('redis://:mysecret@redis:6379/0')).toBe('redis://:***@redis:6379/0');
    });

    it('masks every credential segment in a string with multiple URLs', () => {
      expect(
        maskUrlEmbeddedCredentials('a=postgresql://u1:p1@h1 b=mysql://u2:p2@h2')
      ).toBe('a=postgresql://u1:***@h1 b=mysql://u2:***@h2');
    });

    it('leaves URLs without user:pass@ unchanged', () => {
      expect(maskUrlEmbeddedCredentials('https://example.com/foo?x=1:y=2')).toBe('https://example.com/foo?x=1:y=2');
    });
  });

  describe('maskEnvLine (aifabrix logs <app> PII)', () => {
    it('masks line when key matches secret pattern', () => {
      expect(maskEnvLine('PASSWORD=secret')).toBe('PASSWORD=***');
      expect(maskEnvLine('API_KEY=abc')).toBe('API_KEY=***');
      expect(maskEnvLine('CLIENT_SECRET=xyz')).toBe('CLIENT_SECRET=***');
    });

    it('masks KEYCLOAK_ only when suffix is secret (PASSWORD, SECRET, etc.)', () => {
      expect(maskEnvLine('KEYCLOAK_ADMIN_PASSWORD=admin')).toBe('KEYCLOAK_ADMIN_PASSWORD=***');
      expect(maskEnvLine('KEYCLOAK_CLIENT_SECRET=xyz')).toBe('KEYCLOAK_CLIENT_SECRET=***');
      expect(maskEnvLine('KEYCLOAK_SERVER_URL=http://keycloak:8080')).toBe('KEYCLOAK_SERVER_URL=http://keycloak:8080');
      expect(maskEnvLine('KEYCLOAK_REALM=aifabrix')).toBe('KEYCLOAK_REALM=aifabrix');
      expect(maskEnvLine('KEYCLOAK_EVENTS_ENABLED=true')).toBe('KEYCLOAK_EVENTS_ENABLED=true');
    });

    it('masks credentials in URL values (postgresql://, etc.)', () => {
      expect(maskEnvLine('DATABASE_URL=postgresql://miso_user:miso_pass123@postgres:5432/miso')).toBe(
        'DATABASE_URL=postgresql://miso_user:***@postgres:5432/miso'
      );
      expect(
        maskEnvLine('DATABASELOG_URL=postgresql://miso_logs_user:miso_logs_pass123@postgres:5432/miso-logs')
      ).toBe('DATABASELOG_URL=postgresql://miso_logs_user:***@postgres:5432/miso-logs');
    });

    it('leaves line unchanged when key does not match and no URL creds', () => {
      expect(maskEnvLine('NODE_ENV=development')).toBe('NODE_ENV=development');
      expect(maskEnvLine('PORT=3000')).toBe('PORT=3000');
    });

    it('returns line unchanged when there is no key or malformed KEY=value', () => {
      expect(maskEnvLine('no-equals-here')).toBe('no-equals-here');
      expect(maskEnvLine('=only-value')).toBe('=only-value');
    });

    it('strips KEY_VAULT_ prefix for secret detection like KEYCLOAK_', () => {
      expect(maskEnvLine('KEY_VAULT_SERVER_URL=https://vault.example')).toBe('KEY_VAULT_SERVER_URL=https://vault.example');
      expect(maskEnvLine('KEY_VAULT_CLIENT_SECRET=abc')).toBe('KEY_VAULT_CLIENT_SECRET=***');
    });

    it('masks entire line when key is secret-shaped even if value is a credentialed URL', () => {
      expect(maskEnvLine('DATABASE_PASSWORD=postgresql://u:p@h/db')).toBe('DATABASE_PASSWORD=***');
    });

    it('masks token and credential key suffixes', () => {
      expect(maskEnvLine('OAUTH_TOKEN=abc123')).toBe('OAUTH_TOKEN=***');
      expect(maskEnvLine('AZURE_CREDENTIAL_JSON={"x":1}')).toBe('AZURE_CREDENTIAL_JSON=***');
    });
  });
});
