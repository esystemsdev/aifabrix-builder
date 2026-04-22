/**
 * Tests for Secrets Ensure Module
 *
 * @fileoverview Unit tests for lib/core/secrets-ensure.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/core/config', () => ({
  getSecretsPath: jest.fn(),
  getSecretsEncryptionKey: jest.fn()
}));

jest.mock('../../../lib/utils/paths', () => ({
  getAifabrixHome: jest.fn(() => '/home/.aifabrix'),
  getPrimaryUserSecretsLocalPath: jest.fn(() => '/home/.aifabrix/secrets.local.yaml'),
  listBuilderAppNames: jest.fn(() => []),
  listIntegrationAppNames: jest.fn(() => []),
  getBuilderPath: jest.fn((n) => `/builder/${n}`),
  getIntegrationPath: jest.fn((n) => `/integration/${n}`)
}));

jest.mock('../../../lib/utils/remote-dev-auth', () => ({
  isRemoteSecretsUrl: jest.fn(),
  getRemoteDevAuth: jest.fn(),
  resolveSharedSecretsEndpoint: jest.fn(async(p) => p)
}));

jest.mock('../../../lib/api/dev.api', () => ({
  listSecrets: jest.fn(),
  addSecret: jest.fn()
}));

jest.mock('../../../lib/utils/secrets-generator', () => ({
  findMissingSecretKeys: jest.fn(),
  generateSecretValue: jest.fn((key) => `generated-${key}`),
  loadExistingSecrets: jest.fn(() => ({})),
  appendSecretsToFile: jest.fn(),
  saveSecretsFile: jest.fn()
}));

jest.mock('../../../lib/utils/secrets-encryption', () => ({
  encryptSecret: jest.fn((val) => `encrypted(${val})`)
}));

jest.mock('../../../lib/utils/secrets-helpers', () => ({
  loadEnvTemplate: jest.fn(() => 'KV=kv://my-secretKeyVault')
}));

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn()
}));

const path = require('path');
const fs = require('fs');
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn()
}));
// infra-parameter-catalog reads via fs-real-sync, not mocked `fs`; keep real disk for bundled YAML.
jest.unmock('../../../lib/internal/fs-real-sync');

const config = require('../../../lib/core/config');
const pathsUtil = require('../../../lib/utils/paths');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../../../lib/utils/remote-dev-auth');
const devApi = require('../../../lib/api/dev.api');
const secretsGenerator = require('../../../lib/utils/secrets-generator');
const logger = require('../../../lib/utils/logger');
const { clearInfraParameterCatalogCache } = require('../../../lib/parameters/infra-parameter-catalog');

const secretsEnsure = require('../../../lib/core/secrets-ensure');
const {
  ensureSecretsForKeys,
  ensureSecretsFromEnvTemplate,
  ensureInfraSecrets,
  setSecretInStore,
  resolveWriteTarget,
  loadExistingFromTarget,
  getInfraSecretKeysForUpInfra,
  buildInfraPlaceholderContext
} = secretsEnsure;

describe('secrets-ensure', () => {
  beforeEach(() => {
    clearInfraParameterCatalogCache();
    jest.clearAllMocks();
    config.getSecretsPath.mockResolvedValue(null);
    config.getSecretsEncryptionKey.mockResolvedValue(null);
    isRemoteSecretsUrl.mockReturnValue(false);
    secretsGenerator.loadExistingSecrets.mockReturnValue({});
    fs.existsSync.mockReturnValue(true);
    const realFs = jest.requireActual('fs');
    fs.readFileSync.mockImplementation((filepath, enc) => {
      const s = String(filepath);
      if (s.includes('infra.parameter.yaml') || s.includes('infra-parameter.schema.json')) {
        return realFs.readFileSync(filepath, enc);
      }
      return Buffer.alloc(0);
    });
  });

  describe('INFRA_SECRET_KEYS', () => {
    it('includes expected infra secret keys from infra.parameter.yaml (getter; read after fs mock)', () => {
      const keys = secretsEnsure.INFRA_SECRET_KEYS;
      expect(keys).toContain('postgres-passwordKeyVault');
      expect(keys).toContain('redis-passwordKeyVault');
      expect(keys).toContain('databases-miso-controller-0-passwordKeyVault');
      expect(keys).toContain('databases-miso-controller-1-urlKeyVault');
      expect(Array.isArray(keys)).toBe(true);
    });
  });

  describe('getInfraSecretKeysForUpInfra', () => {
    it('includes postgres, redis, keycloak-internal, and miso-controller DB indices 0 and 1', () => {
      const keys = getInfraSecretKeysForUpInfra();
      expect(keys).toContain('postgres-passwordKeyVault');
      expect(keys).toContain('redis-url');
      expect(keys).toContain('keycloak-internal-server-url');
      expect(keys).toContain('databases-miso-controller-0-urlKeyVault');
      expect(keys).toContain('databases-miso-controller-1-passwordKeyVault');
    });

    it('includes every standardUpInfraEnsureKeys entry from shipped infra.parameter.yaml', () => {
      const realFs = jest.requireActual('fs');
      const yaml = require('js-yaml');
      const catPath = path.join(__dirname, '../../../lib/schema/infra.parameter.yaml');
      const doc = yaml.load(realFs.readFileSync(catPath, 'utf8'));
      const bootstrap = doc.standardUpInfraEnsureKeys || [];
      expect(bootstrap.length).toBeGreaterThan(0);
      const keys = getInfraSecretKeysForUpInfra();
      for (const k of bootstrap) {
        expect(keys).toContain(k);
      }
    });
  });

  describe('resolveWriteTarget', () => {
    it('returns file target with user path when no config', async() => {
      config.getSecretsPath.mockResolvedValue(null);
      pathsUtil.getPrimaryUserSecretsLocalPath.mockReturnValue('/home/.aifabrix/secrets.local.yaml');
      const target = await resolveWriteTarget();
      expect(target).toEqual({ type: 'file', filePath: '/home/.aifabrix/secrets.local.yaml' });
    });

    it('returns remote target when config is URL and isRemoteSecretsUrl true', async() => {
      config.getSecretsPath.mockResolvedValue('https://dev.example.com/secrets/');
      isRemoteSecretsUrl.mockReturnValue(true);
      getRemoteDevAuth.mockResolvedValue({
        serverUrl: 'https://dev.example.com',
        clientCertPem: 'pem',
        serverCaPem: null
      });
      const target = await resolveWriteTarget();
      expect(target.type).toBe('remote');
      expect(target.serverUrl).toBe('https://dev.example.com');
      expect(target.secretsEndpointUrl).toBe('https://dev.example.com/secrets');
      expect(target.clientCertPem).toBe('pem');
      expect(target.serverCaPem).toBeNull();
      expect(target.filePath).toBe(path.join('/home/.aifabrix', 'secrets.local.yaml'));
    });

    it('returns file target for absolute path in config', async() => {
      config.getSecretsPath.mockResolvedValue('/abs/secrets.yaml');
      isRemoteSecretsUrl.mockReturnValue(false);
      const target = await resolveWriteTarget();
      expect(target).toEqual({ type: 'file', filePath: '/abs/secrets.yaml' });
    });
  });

  describe('loadExistingFromTarget', () => {
    it('loads from file when type is file', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({ a: '1' });
      const target = { type: 'file', filePath: '/path/secrets.yaml' };
      const result = await loadExistingFromTarget(target);
      expect(result).toEqual({ a: '1' });
      expect(secretsGenerator.loadExistingSecrets).toHaveBeenCalledWith('/path/secrets.yaml');
    });

    it('loads from remote API when type is remote and returns array', async() => {
      devApi.listSecrets.mockResolvedValue([
        { name: 'k1', value: 'v1' },
        { name: 'k2', value: 'v2' }
      ]);
      const target = {
        type: 'remote',
        serverUrl: 'https://dev.example.com',
        secretsEndpointUrl: 'https://dev.example.com/api/dev/secrets',
        clientCertPem: 'pem'
      };
      const result = await loadExistingFromTarget(target);
      expect(result).toEqual({ k1: 'v1', k2: 'v2' });
      expect(devApi.listSecrets).toHaveBeenCalledWith(
        'https://dev.example.com',
        'pem',
        undefined,
        'https://dev.example.com/api/dev/secrets'
      );
    });

    it('returns empty object when remote API throws', async() => {
      devApi.listSecrets.mockRejectedValue(new Error('network'));
      const target = {
        type: 'remote',
        serverUrl: 'https://dev.example.com',
        secretsEndpointUrl: 'https://dev.example.com/api/dev/secrets',
        clientCertPem: 'pem'
      };
      const result = await loadExistingFromTarget(target);
      expect(result).toEqual({});
    });

    it('falls back to file when type is remote with filePath only', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({ x: 'y' });
      const target = { type: 'remote', filePath: '/fallback/secrets.yaml' };
      const result = await loadExistingFromTarget(target);
      expect(result).toEqual({ x: 'y' });
      expect(secretsGenerator.loadExistingSecrets).toHaveBeenCalledWith('/fallback/secrets.yaml');
    });
  });

  describe('ensureSecretsForKeys', () => {
    it('returns empty array when keys is empty or not array', async() => {
      await expect(ensureSecretsForKeys([])).resolves.toEqual([]);
      await expect(ensureSecretsForKeys(null)).resolves.toEqual([]);
      await expect(ensureSecretsForKeys(undefined)).resolves.toEqual([]);
    });

    it('adds missing keys to file and returns added keys', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      secretsGenerator.generateSecretValue.mockImplementation((k) => `gen-${k}`);
      config.getSecretsPath.mockResolvedValue(null);
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      const result = await ensureSecretsForKeys(['newKey1', 'newKey2']);

      expect(result).toContain('newKey1');
      expect(result).toContain('newKey2');
      expect(secretsGenerator.appendSecretsToFile).toHaveBeenCalled();
    });

    it('skips keys that already exist and are non-empty', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({ existing: 'value' });
      config.getSecretsPath.mockResolvedValue(null);

      const result = await ensureSecretsForKeys(['existing']);

      expect(result).toEqual([]);
      expect(secretsGenerator.appendSecretsToFile).not.toHaveBeenCalled();
    });

    it('does not backfill redis-passwordKeyVault when empty (allowed empty)', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({
        'postgres-passwordKeyVault': 'admin123',
        'redis-passwordKeyVault': ''
      });
      config.getSecretsPath.mockResolvedValue(null);

      const result = await ensureInfraSecrets();

      expect(result).not.toContain('redis-passwordKeyVault');
      const appendCalls = secretsGenerator.appendSecretsToFile.mock.calls;
      const hasRedisBackfill = appendCalls.some(
        (call) => call[1] && 'redis-passwordKeyVault' in call[1]
      );
      expect(hasRedisBackfill).toBe(false);
    });

    it('uses suggestedValues when provided', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      config.getSecretsPath.mockResolvedValue(null);
      await ensureSecretsForKeys(['myKey'], {
        suggestedValues: { myKey: 'suggested-value' }
      });
      expect(secretsGenerator.appendSecretsToFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ myKey: 'suggested-value' })
      );
    });

    it('uses _targetOverride when provided', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      const customPath = '/custom/secrets.yaml';
      await ensureSecretsForKeys(['k1'], {
        _targetOverride: { type: 'file', filePath: customPath }
      });
      expect(secretsGenerator.loadExistingSecrets).toHaveBeenCalledWith(customPath);
      expect(secretsGenerator.appendSecretsToFile).toHaveBeenCalledWith(
        customPath,
        expect.any(Object)
      );
    });
  });

  describe('ensureInfraSecrets', () => {
    it('calls ensureSecretsForKeys with INFRA_SECRET_KEYS', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      config.getSecretsPath.mockResolvedValue(null);

      const result = await ensureInfraSecrets();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('passes merged placeholderContext so adminPwd overrides {{adminPassword}}', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      config.getSecretsPath.mockResolvedValue(null);

      await ensureInfraSecrets({ adminPwd: 'my-admin-pwd' });

      expect(secretsGenerator.generateSecretValue).toHaveBeenCalledWith(
        'postgres-passwordKeyVault',
        expect.objectContaining({ adminPassword: 'my-admin-pwd' })
      );
    });

    it('buildInfraPlaceholderContext merges CLI flags with catalog defaults', () => {
      const ctx = buildInfraPlaceholderContext({
        adminPassword: 'cliPwd',
        adminEmail: 'cli@example.com',
        userPassword: 'cliUser'
      });
      expect(ctx.adminPassword).toBe('cliPwd');
      expect(ctx.adminEmail).toBe('cli@example.com');
      expect(ctx.userPassword).toBe('cliUser');
    });

    it('overwrites keycloak default user password in store when userPassword CLI is set', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      config.getSecretsPath.mockResolvedValue(null);
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      await ensureInfraSecrets({ userPassword: 'cliUserPwd' });

      const wroteUserPwd = secretsGenerator.saveSecretsFile.mock.calls.some(
        (call) => call[1] && call[1]['keycloak-default-passwordKeyVault'] === 'cliUserPwd'
      );
      expect(wroteUserPwd).toBe(true);
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('{{userPassword}}')
      );
    });

    it('syncs every catalog literal using {{adminPassword}} when adminPwd CLI is set', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      config.getSecretsPath.mockResolvedValue(null);
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      await ensureInfraSecrets({ adminPwd: 'cli-admin-sync' });

      const calls = secretsGenerator.saveSecretsFile.mock.calls;
      const hasKey = (k) => calls.some((c) => c[1] && c[1][k] === 'cli-admin-sync');
      expect(hasKey('postgres-passwordKeyVault')).toBe(true);
      expect(hasKey('keycloak-admin-passwordKeyVault')).toBe(true);
      expect(hasKey('miso-controller-admin-passwordKeyVault')).toBe(true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('{{adminPassword}}'));
    });

    it('syncs miso-controller-admin-emailKeyVault when adminEmail CLI is set', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      config.getSecretsPath.mockResolvedValue(null);
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      await ensureInfraSecrets({ adminEmail: 'sync@example.com' });

      const wrote = secretsGenerator.saveSecretsFile.mock.calls.some(
        (c) => c[1] && c[1]['miso-controller-admin-emailKeyVault'] === 'sync@example.com'
      );
      expect(wrote).toBe(true);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('{{adminEmail}}'));
    });

    it('applies full up-infra-style CLI bundle to secrets store (admin, user, email) and TLS placeholder context', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      config.getSecretsPath.mockResolvedValue(null);
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      await ensureInfraSecrets({
        adminPassword: 'admin1234',
        adminEmail: 'admin@esystems.fi',
        userPassword: 'user1234',
        tlsEnabled: false
      });

      const merged = Object.assign({}, ...secretsGenerator.saveSecretsFile.mock.calls.map((c) => c[1] || {}));
      expect(merged['postgres-passwordKeyVault']).toBe('admin1234');
      expect(merged['keycloak-default-passwordKeyVault']).toBe('user1234');
      expect(merged['miso-controller-admin-emailKeyVault']).toBe('admin@esystems.fi');

      expect(secretsGenerator.generateSecretValue).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          TLS_ENABLED: 'false',
          HTTP_ENABLED: 'true',
          adminPassword: 'admin1234',
          adminEmail: 'admin@esystems.fi',
          userPassword: 'user1234'
        })
      );
    });
  });

  describe('ensureSecretsFromEnvTemplate', () => {
    it('returns added keys when template path exists and has missing keys', async() => {
      const { loadEnvTemplate } = require('../../../lib/utils/secrets-helpers');
      loadEnvTemplate.mockReturnValue('KV=kv://missingKeyKeyVault');
      secretsGenerator.findMissingSecretKeys.mockReturnValue(['missingKeyKeyVault']);
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      fs.existsSync.mockReturnValue(true);

      const result = await ensureSecretsFromEnvTemplate('/any/existing/env.template');

      expect(Array.isArray(result)).toBe(true);
      expect(loadEnvTemplate).toHaveBeenCalledWith('/any/existing/env.template');
    });

    it('accepts template content string with kv:// and ensures missing keys', async() => {
      secretsGenerator.findMissingSecretKeys.mockReturnValue(['fromContentKeyVault']);
      secretsGenerator.loadExistingSecrets.mockReturnValue({});

      const result = await ensureSecretsFromEnvTemplate('SOME=kv://fromContentKeyVault');

      expect(Array.isArray(result)).toBe(true);
      expect(secretsGenerator.findMissingSecretKeys).toHaveBeenCalledWith(
        'SOME=kv://fromContentKeyVault',
        expect.any(Object)
      );
    });

    it('throws when path does not exist and looks like path', async() => {
      fs.existsSync.mockReturnValue(false);
      await expect(
        ensureSecretsFromEnvTemplate('/nonexistent/env.template')
      ).rejects.toThrow(/env.template not found/);
    });

    it('throws when content is empty and no path', async() => {
      await expect(ensureSecretsFromEnvTemplate('')).rejects.toThrow(
        /env.template path or content is required/
      );
    });
  });

  describe('setSecretInStore', () => {
    it('writes to file when target is file and merges with existing', async() => {
      config.getSecretsPath.mockResolvedValue(null);
      secretsGenerator.loadExistingSecrets.mockReturnValue({ existing: 'v1' });
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      await setSecretInStore('postgres-passwordKeyVault', 'mypwd');

      expect(secretsGenerator.saveSecretsFile).toHaveBeenCalledWith(
        path.join('/home/.aifabrix', 'secrets.local.yaml'),
        expect.objectContaining({
          existing: 'v1',
          'postgres-passwordKeyVault': 'mypwd'
        })
      );
    });

    it('encrypts value when secrets-encryption is set', async() => {
      const { encryptSecret } = require('../../../lib/utils/secrets-encryption');
      config.getSecretsPath.mockResolvedValue(null);
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      config.getSecretsEncryptionKey.mockResolvedValue('enc-key');
      encryptSecret.mockReturnValue('encrypted(mypwd)');

      await setSecretInStore('myKey', 'mypwd');

      expect(secretsGenerator.saveSecretsFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ myKey: 'encrypted(mypwd)' })
      );
    });

    it('calls remote addSecret when target is remote', async() => {
      config.getSecretsPath.mockResolvedValue('https://dev.example.com/');
      isRemoteSecretsUrl.mockReturnValue(true);
      getRemoteDevAuth.mockResolvedValue({
        serverUrl: 'https://dev.example.com',
        clientCertPem: 'pem',
        serverCaPem: null
      });
      devApi.addSecret.mockResolvedValue({});

      await setSecretInStore('k', 'v');

      expect(devApi.addSecret).toHaveBeenCalledWith(
        'https://dev.example.com',
        'pem',
        { key: 'k', value: 'v' },
        undefined,
        'https://dev.example.com'
      );
      expect(secretsGenerator.saveSecretsFile).not.toHaveBeenCalled();
    });

    it('does nothing when key is empty or value is undefined', async() => {
      config.getSecretsPath.mockResolvedValue(null);
      await setSecretInStore('', 'v');
      await setSecretInStore('k', undefined);
      expect(secretsGenerator.saveSecretsFile).not.toHaveBeenCalled();
    });
  });
});
