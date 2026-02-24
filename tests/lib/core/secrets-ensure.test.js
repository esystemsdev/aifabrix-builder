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
  getAifabrixHome: jest.fn(() => '/home/.aifabrix')
}));

jest.mock('../../../lib/utils/remote-dev-auth', () => ({
  isRemoteSecretsUrl: jest.fn(),
  getRemoteDevAuth: jest.fn()
}));

jest.mock('../../../lib/api/dev.api', () => ({
  listSecrets: jest.fn(),
  addSecret: jest.fn()
}));

jest.mock('../../../lib/utils/secrets-generator', () => ({
  findMissingSecretKeys: jest.fn(),
  generateSecretValue: jest.fn((key) => `generated-${key}`),
  loadExistingSecrets: jest.fn(() => ({})),
  appendSecretsToFile: jest.fn()
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

const fs = require('fs');
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn()
}));

const config = require('../../../lib/core/config');
const pathsUtil = require('../../../lib/utils/paths');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../../../lib/utils/remote-dev-auth');
const devApi = require('../../../lib/api/dev.api');
const secretsGenerator = require('../../../lib/utils/secrets-generator');

const {
  ensureSecretsForKeys,
  ensureSecretsFromEnvTemplate,
  ensureInfraSecrets,
  resolveWriteTarget,
  loadExistingFromTarget,
  INFRA_SECRET_KEYS
} = require('../../../lib/core/secrets-ensure');

describe('secrets-ensure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getSecretsPath.mockResolvedValue(null);
    config.getSecretsEncryptionKey.mockResolvedValue(null);
    isRemoteSecretsUrl.mockReturnValue(false);
    secretsGenerator.loadExistingSecrets.mockReturnValue({});
    fs.existsSync.mockReturnValue(true);
  });

  describe('INFRA_SECRET_KEYS', () => {
    it('includes expected infra secret keys', () => {
      expect(INFRA_SECRET_KEYS).toContain('postgres-passwordKeyVault');
      expect(INFRA_SECRET_KEYS).toContain('redis-passwordKeyVault');
      expect(INFRA_SECRET_KEYS).toContain('databases-miso-controller-0-passwordKeyVault');
      expect(Array.isArray(INFRA_SECRET_KEYS)).toBe(true);
    });
  });

  describe('resolveWriteTarget', () => {
    it('returns file target with user path when no config', async() => {
      config.getSecretsPath.mockResolvedValue(null);
      pathsUtil.getAifabrixHome.mockReturnValue('/home/.aifabrix');
      const target = await resolveWriteTarget();
      expect(target).toEqual({ type: 'file', filePath: '/home/.aifabrix/secrets.local.yaml' });
    });

    it('returns remote target when config is URL and isRemoteSecretsUrl true', async() => {
      config.getSecretsPath.mockResolvedValue('https://dev.example.com/secrets/');
      isRemoteSecretsUrl.mockReturnValue(true);
      getRemoteDevAuth.mockResolvedValue({ clientCertPem: 'pem' });
      const target = await resolveWriteTarget();
      expect(target.type).toBe('remote');
      expect(target.serverUrl).toBe('https://dev.example.com/secrets');
      expect(target.clientCertPem).toBe('pem');
      expect(target.filePath).toBe('/home/.aifabrix/secrets.local.yaml');
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
        clientCertPem: 'pem'
      };
      const result = await loadExistingFromTarget(target);
      expect(result).toEqual({ k1: 'v1', k2: 'v2' });
      expect(devApi.listSecrets).toHaveBeenCalledWith('https://dev.example.com', 'pem');
    });

    it('returns empty object when remote API throws', async() => {
      devApi.listSecrets.mockRejectedValue(new Error('network'));
      const target = {
        type: 'remote',
        serverUrl: 'https://dev.example.com',
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

    it('passes adminPwd as suggested value for postgres-passwordKeyVault when provided', async() => {
      secretsGenerator.loadExistingSecrets.mockReturnValue({});
      config.getSecretsPath.mockResolvedValue(null);

      await ensureInfraSecrets({ adminPwd: 'my-admin-pwd' });

      expect(secretsGenerator.appendSecretsToFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ 'postgres-passwordKeyVault': 'my-admin-pwd' })
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
});
