/**
 * Tests for credential-secrets-env (KV_* → kv://, payload scan, push)
 *
 * @fileoverview Tests for lib/utils/credential-secrets-env.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/core/secrets', () => ({
  loadSecrets: jest.fn()
}));
jest.mock('../../../lib/api/credential.api', () => ({
  storeCredentialSecrets: jest.fn()
}));

const fs = require('fs');
const {
  collectKvEnvVarsAsSecretItems,
  collectKvRefsFromPayload,
  pushCredentialSecrets,
  kvEnvKeyToPath,
  systemKeyToKvPrefix,
  securityKeyToVar,
  isValidKvPath,
  resolveKvValue
} = require('../../../lib/utils/credential-secrets-env');
const { loadSecrets } = require('../../../lib/core/secrets');
const { storeCredentialSecrets } = require('../../../lib/api/credential.api');

describe('credential-secrets-env', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadSecrets.mockResolvedValue({});
  });

  describe('systemKeyToKvPrefix', () => {
    it('should convert hubspot to HUBSPOT', () => {
      expect(systemKeyToKvPrefix('hubspot')).toBe('HUBSPOT');
    });
    it('should convert my-hubspot to MY_HUBSPOT', () => {
      expect(systemKeyToKvPrefix('my-hubspot')).toBe('MY_HUBSPOT');
    });
    it('should return empty string for empty or invalid', () => {
      expect(systemKeyToKvPrefix('')).toBe('');
      expect(systemKeyToKvPrefix(null)).toBe('');
      expect(systemKeyToKvPrefix(undefined)).toBe('');
    });
  });

  describe('securityKeyToVar', () => {
    it('should convert camelCase security key to UPPERCASE no underscores', () => {
      expect(securityKeyToVar('clientId')).toBe('CLIENTID');
      expect(securityKeyToVar('clientSecret')).toBe('CLIENTSECRET');
    });
    it('should handle keys with existing underscores', () => {
      expect(securityKeyToVar('client_id')).toBe('CLIENTID');
    });
    it('should return empty string for empty or invalid', () => {
      expect(securityKeyToVar('')).toBe('');
      expect(securityKeyToVar(null)).toBe('');
      expect(securityKeyToVar(undefined)).toBe('');
    });
  });

  describe('kvEnvKeyToPath', () => {
    it('should convert KV_A_B to kv://a/b (format kv://system-key/variable)', () => {
      expect(kvEnvKeyToPath('KV_A_B')).toBe('kv://a/b');
    });
    it('should convert KV_SECRETS_CLIENT_SECRET to kv://secrets/clientSecret', () => {
      expect(kvEnvKeyToPath('KV_SECRETS_CLIENT_SECRET')).toBe('kv://secrets/clientSecret');
    });
    it('should convert KV_MICROSOFT_TEAMS_CLIENT_ID to kv://microsoft-teams/clientId when systemKey not provided', () => {
      expect(kvEnvKeyToPath('KV_MICROSOFT_TEAMS_CLIENT_ID')).toBe('kv://microsoft-teams/clientId');
    });
    it('should convert KV_MICROSOFT_TEAMS_CLIENTID to kv://microsoft-teams/clientId (inferred)', () => {
      expect(kvEnvKeyToPath('KV_MICROSOFT_TEAMS_CLIENTID')).toBe('kv://microsoft-teams/clientId');
    });
    it('should use systemKey when provided (microsoft-teams)', () => {
      expect(kvEnvKeyToPath('KV_MICROSOFT_TEAMS_CLIENT_ID', 'microsoft-teams')).toBe('kv://microsoft-teams/clientId');
      expect(kvEnvKeyToPath('KV_MICROSOFT_TEAMS_CLIENTSECRET', 'microsoft-teams')).toBe('kv://microsoft-teams/clientSecret');
    });
    it('should use systemKey when provided (hubspot)', () => {
      expect(kvEnvKeyToPath('KV_HUBSPOT_CLIENTID', 'hubspot')).toBe('kv://hubspot/clientId');
      expect(kvEnvKeyToPath('KV_HUBSPOT_CLIENTSECRET', 'hubspot')).toBe('kv://hubspot/clientSecret');
    });
    it('should return null for non-KV_ key', () => {
      expect(kvEnvKeyToPath('OTHER_VAR')).toBeNull();
      expect(kvEnvKeyToPath('KV')).toBeNull();
    });
    it('should return null for empty or invalid', () => {
      expect(kvEnvKeyToPath('')).toBeNull();
      expect(kvEnvKeyToPath('KV_')).toBeNull();
    });
  });

  describe('collectKvEnvVarsAsSecretItems', () => {
    it('should collect KV_* as items with kv path key and raw value', () => {
      const envMap = {
        KV_SECRETS_FOO: 'plainValue',
        KV_A_B: 'another'
      };
      const items = collectKvEnvVarsAsSecretItems(envMap);
      expect(items).toEqual([
        { key: 'kv://secrets/foo', value: 'plainValue' },
        { key: 'kv://a/b', value: 'another' }
      ]);
    });
    it('should use value as key when value is kv:// path (e.g. microsoft-teams)', () => {
      const envMap = {
        KV_MICROSOFT_TEAMS_CLIENT_ID: 'kv://microsoft-teams/clientId',
        KV_MICROSOFT_TEAMS_CLIENT_SECRET: 'kv://microsoft-teams/clientSecret'
      };
      const items = collectKvEnvVarsAsSecretItems(envMap);
      expect(items).toEqual([
        { key: 'kv://microsoft-teams/clientId', value: 'kv://microsoft-teams/clientId' },
        { key: 'kv://microsoft-teams/clientSecret', value: 'kv://microsoft-teams/clientSecret' }
      ]);
    });
    it('should omit non-KV_ keys', () => {
      const envMap = {
        KV_FOO: 'v1',
        DATABASE_URL: 'postgres://localhost',
        OTHER: 'x'
      };
      const items = collectKvEnvVarsAsSecretItems(envMap);
      expect(items).toEqual([{ key: 'kv://foo', value: 'v1' }]);
    });
    it('should skip empty values', () => {
      const envMap = {
        KV_A: 'ok',
        KV_B: '',
        KV_C: '  \t  '
      };
      const items = collectKvEnvVarsAsSecretItems(envMap);
      expect(items).toEqual([{ key: 'kv://a', value: 'ok' }]);
    });
    it('should return empty array for null or non-object', () => {
      expect(collectKvEnvVarsAsSecretItems(null)).toEqual([]);
      expect(collectKvEnvVarsAsSecretItems(undefined)).toEqual([]);
      expect(collectKvEnvVarsAsSecretItems({})).toEqual([]);
    });
  });

  describe('resolveKvValue', () => {
    it('should return plain value unchanged', () => {
      expect(resolveKvValue({}, 'plain')).toBe('plain');
      expect(resolveKvValue({ a: 'x' }, 'hello')).toBe('hello');
    });
    it('should resolve kv:// path from secrets', () => {
      const secrets = { 'secrets/foo': 'resolved' };
      expect(resolveKvValue(secrets, 'kv://secrets/foo')).toBe('resolved');
    });
    it('does not resolve path-style ref via hyphen key (secrets/foo and secrets-foo are different)', () => {
      const secrets = { 'secrets-foo': 'resolved' };
      expect(resolveKvValue(secrets, 'kv://secrets/foo')).toBeNull();
    });
    it('should return null when kv ref cannot be resolved', () => {
      expect(resolveKvValue({}, 'kv://missing/key')).toBeNull();
    });
  });

  describe('collectKvRefsFromPayload', () => {
    it('should return unique kv refs from nested object', () => {
      const payload = {
        application: { config: { url: 'kv://secrets/api-url' } },
        dataSources: [{ credentials: 'kv://secrets/foo' }, { same: 'kv://secrets/foo' }]
      };
      const refs = collectKvRefsFromPayload(payload);
      expect(refs.sort()).toEqual(['kv://secrets/api-url', 'kv://secrets/foo']);
    });
    it('should return empty array for non-string primitives', () => {
      expect(collectKvRefsFromPayload(123)).toEqual([]);
      expect(collectKvRefsFromPayload(null)).toEqual([]);
    });
    it('should find refs in arrays', () => {
      const refs = collectKvRefsFromPayload(['kv://a/b', 'kv://a/c']);
      expect(refs.sort()).toEqual(['kv://a/b', 'kv://a/c']);
    });
  });

  describe('isValidKvPath', () => {
    it('should accept valid kv paths', () => {
      expect(isValidKvPath('kv://secrets/foo')).toBe(true);
      expect(isValidKvPath('kv://a')).toBe(true);
      expect(isValidKvPath('kv://a/b-c')).toBe(true);
    });
    it('should reject invalid', () => {
      expect(isValidKvPath('')).toBe(false);
      expect(isValidKvPath('http://x')).toBe(false);
      expect(isValidKvPath('kv://')).toBe(false);
    });
  });

  describe('pushCredentialSecrets', () => {
    it('should return { pushed: 0, skipped: true } when no items and no .env', async() => {
      const result = await pushCredentialSecrets('https://dp.example.com', { type: 'bearer', token: 't' }, {});
      expect(result).toEqual({ pushed: 0, skipped: true });
      expect(storeCredentialSecrets).not.toHaveBeenCalled();
    });

    it('should read .env and push resolved items when envFilePath exists', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('KV_SECRETS_FOO=plainValue\n');
      loadSecrets.mockResolvedValue({});
      storeCredentialSecrets.mockResolvedValue({ success: true, stored: 1 });

      const result = await pushCredentialSecrets('https://dp.example.com', { type: 'bearer', token: 't' }, {
        envFilePath: '/integration/myapp/.env',
        appName: 'myapp'
      });

      expect(result.pushed).toBe(1);
      expect(storeCredentialSecrets).toHaveBeenCalledWith(
        'https://dp.example.com',
        { type: 'bearer', token: 't' },
        [{ key: 'kv://secrets/foo', value: 'plainValue' }]
      );
      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });

    it('should return warning on 403 and not throw', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('KV_FOO=bar\n');
      storeCredentialSecrets.mockResolvedValue({ success: false, status: 403 });

      const result = await pushCredentialSecrets('https://dp.example.com', { type: 'bearer', token: 't' }, {
        envFilePath: '/integration/myapp/.env',
        appName: 'myapp'
      });

      expect(result.pushed).toBe(0);
      expect(result.warning).toContain('credential:create');
      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });

    it('should include payload kv refs resolved from loadSecrets', async() => {
      loadSecrets.mockResolvedValue({ 'secrets/api-key': 'secret123' });
      storeCredentialSecrets.mockResolvedValue({ success: true, stored: 1 });

      const result = await pushCredentialSecrets('https://dp.example.com', { type: 'bearer', token: 't' }, {
        appName: 'myapp',
        payload: { application: { config: { apiKey: 'kv://secrets/api-key' } } }
      });

      expect(result.pushed).toBe(1);
      expect(storeCredentialSecrets).toHaveBeenCalledWith(
        'https://dp.example.com',
        expect.any(Object),
        [{ key: 'kv://secrets/api-key', value: 'secret123' }]
      );
    });

    it('should resolve kv:// in .env value via loadSecrets and send plain value to API', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('KV_SECRETS_TOKEN=kv://secrets/token\n');
      loadSecrets.mockResolvedValue({ 'secrets/token': 'plain-token-value' });
      storeCredentialSecrets.mockResolvedValue({ success: true, stored: 1 });

      const result = await pushCredentialSecrets('https://dp.example.com', { type: 'bearer', token: 't' }, {
        envFilePath: '/integration/app/.env',
        appName: 'app'
      });

      expect(result.pushed).toBe(1);
      expect(storeCredentialSecrets).toHaveBeenCalledWith(
        'https://dp.example.com',
        expect.any(Object),
        [{ key: 'kv://secrets/token', value: 'plain-token-value' }]
      );
      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });

    it('should skip .env item when value is kv:// ref but resolution fails', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('KV_GOOD=plain\nKV_BAD=kv://secrets/missing\n');
      loadSecrets.mockResolvedValue({});
      storeCredentialSecrets.mockResolvedValue({ success: true, stored: 1 });

      const result = await pushCredentialSecrets('https://dp.example.com', { type: 'bearer', token: 't' }, {
        envFilePath: '/integration/app/.env',
        appName: 'app'
      });

      expect(result.pushed).toBe(1);
      expect(storeCredentialSecrets).toHaveBeenCalledWith(
        'https://dp.example.com',
        expect.any(Object),
        [{ key: 'kv://good', value: 'plain' }]
      );
      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });

    it('should skip payload kv ref when resolution fails', async() => {
      loadSecrets.mockResolvedValue({ 'secrets/known': 'v1' });
      storeCredentialSecrets.mockResolvedValue({ success: true, stored: 1 });

      const result = await pushCredentialSecrets('https://dp.example.com', { type: 'bearer', token: 't' }, {
        appName: 'myapp',
        payload: {
          a: 'kv://secrets/known',
          b: 'kv://secrets/unknown'
        }
      });

      expect(result.pushed).toBe(1);
      expect(storeCredentialSecrets).toHaveBeenCalledWith(
        'https://dp.example.com',
        expect.any(Object),
        [{ key: 'kv://secrets/known', value: 'v1' }]
      );
    });

    it('should merge .env and payload sources and dedupe by key', async() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue('KV_SECRETS_SHARED=from-env\nKV_SECRETS_ENV_ONLY=env\n');
      loadSecrets.mockResolvedValue({
        'secrets/shared': 'from-payload',
        'secrets/env-only': 'env',
        'secrets/payload-only': 'payload'
      });
      storeCredentialSecrets.mockResolvedValue({ success: true, stored: 3 });

      const result = await pushCredentialSecrets('https://dp.example.com', { type: 'bearer', token: 't' }, {
        envFilePath: '/integration/app/.env',
        appName: 'app',
        payload: { ref: 'kv://secrets/shared', other: 'kv://secrets/payload-only' }
      });

      expect(result.pushed).toBe(3);
      const sent = storeCredentialSecrets.mock.calls[0][2];
      const keys = sent.map(({ key }) => key).sort();
      expect(keys).toEqual(['kv://secrets-env/only', 'kv://secrets/payload-only', 'kv://secrets/shared']);
      const sharedItem = sent.find(({ key }) => key === 'kv://secrets/shared');
      expect(sharedItem.value).toBe('from-env');
      fs.existsSync.mockRestore();
      fs.readFileSync.mockRestore();
    });
  });
});
