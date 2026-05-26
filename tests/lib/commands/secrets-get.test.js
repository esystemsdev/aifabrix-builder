/**
 * Tests for secret get command (handleSecretsGet).
 * @fileoverview Unit tests for lib/commands/secrets-get.js
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({
  getAifabrixSecretsPath: jest.fn(),
  getSecretsEncryptionKey: jest.fn().mockResolvedValue(null)
}));
jest.mock('../../../lib/core/secrets-load', () => ({
  decryptSecretsObject: jest.fn(async(obj) => obj)
}));
jest.mock('../../../lib/utils/secrets-utils', () => ({
  loadPrimaryUserSecrets: jest.fn()
}));
jest.mock('../../../lib/utils/remote-secrets-loader', () => ({
  loadConfiguredSharedSecretsStore: jest.fn()
}));
jest.mock('../../../lib/utils/remote-dev-auth', () => {
  const actual = jest.requireActual('../../../lib/utils/remote-dev-auth');
  return {
    ...actual,
    resolveSharedSecretsEndpoint: jest.fn(),
    isRemoteSecretsUrl: jest.fn(),
    getRemoteDevAuth: jest.fn()
  };
});
jest.mock('../../../lib/api/dev.api', () => ({
  listSecrets: jest.fn()
}));

const { loadPrimaryUserSecrets } = require('../../../lib/utils/secrets-utils');
const { loadConfiguredSharedSecretsStore } = require('../../../lib/utils/remote-secrets-loader');
const {
  resolveSharedSecretsEndpoint,
  isRemoteSecretsUrl,
  getRemoteDevAuth
} = require('../../../lib/utils/remote-dev-auth');
const { handleSecretsGet, isSecretPresent } = require('../../../lib/commands/secrets-get');
const logger = require('../../../lib/utils/logger');

describe('secrets-get command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const actual = jest.requireActual('../../../lib/utils/remote-dev-auth');
    isRemoteSecretsUrl.mockImplementation(actual.isRemoteSecretsUrl);
    resolveSharedSecretsEndpoint.mockImplementation(async(p) => p);
  });

  describe('isSecretPresent', () => {
    it('returns false for empty or missing values', () => {
      expect(isSecretPresent(undefined)).toBe(false);
      expect(isSecretPresent('')).toBe(false);
      expect(isSecretPresent('   ')).toBe(false);
    });

    it('returns true for non-empty values', () => {
      expect(isSecretPresent('pat-abc')).toBe(true);
      expect(isSecretPresent('secure://x')).toBe(true);
    });
  });

  it('returns local secret without printing when --exists', async() => {
    loadPrimaryUserSecrets.mockReturnValue({ 'hubspot-demo/apiKey': 'pat-token' });
    const result = await handleSecretsGet('hubspot-demo/apiKey', { exists: true });
    expect(result).toEqual({ key: 'hubspot-demo/apiKey', exists: true });
    expect(logger.log).not.toHaveBeenCalled();
    expect(loadConfiguredSharedSecretsStore).not.toHaveBeenCalled();
  });

  it('prints value when not --exists', async() => {
    loadPrimaryUserSecrets.mockReturnValue({ 'hubspot-demo/apiKey': 'pat-token' });
    await handleSecretsGet('hubspot-demo/apiKey', {});
    expect(logger.log).toHaveBeenCalledWith('pat-token');
  });

  it('throws when secret missing from local file', async() => {
    loadPrimaryUserSecrets.mockReturnValue({});
    await expect(handleSecretsGet('hubspot-demo/apiKey', { exists: true })).rejects.toThrow(
      /missing or empty in local secrets file/
    );
    expect(loadConfiguredSharedSecretsStore).not.toHaveBeenCalled();
  });

  it('throws when secret exists only in shared store (no --shared)', async() => {
    loadPrimaryUserSecrets.mockReturnValue({});
    const { getAifabrixSecretsPath } = require('../../../lib/core/config');
    getAifabrixSecretsPath.mockResolvedValue('/team/secrets.local.yaml');
    loadConfiguredSharedSecretsStore.mockResolvedValue({ 'hubspot-demo/apiKey': 'shared-pat' });
    await expect(handleSecretsGet('hubspot-demo/apiKey', { exists: true })).rejects.toThrow(
      /missing or empty in local secrets file/
    );
    expect(loadConfiguredSharedSecretsStore).not.toHaveBeenCalled();
  });

  it('throws when secret missing from configured shared file (--shared)', async() => {
    const { getAifabrixSecretsPath } = require('../../../lib/core/config');
    getAifabrixSecretsPath.mockResolvedValue('/workspace/.aifabrix/secrets.local.yaml');
    isRemoteSecretsUrl.mockReturnValue(false);
    resolveSharedSecretsEndpoint.mockImplementation(async(p) => p);
    loadConfiguredSharedSecretsStore.mockResolvedValue({});
    await expect(
      handleSecretsGet('hubspot-demo/apiKey', { shared: true, exists: true })
    ).rejects.toThrow(/shared secrets file.*\.aifabrix\/secrets\.local\.yaml/);
    expect(loadPrimaryUserSecrets).not.toHaveBeenCalled();
  });

  it('rejects kv:// key prefix', async() => {
    await expect(handleSecretsGet('kv://hubspot-demo/apiKey', {})).rejects.toThrow(/must not start with kv:\/\//);
  });

  it('loads shared store only with --shared', async() => {
    const { getAifabrixSecretsPath } = require('../../../lib/core/config');
    getAifabrixSecretsPath.mockResolvedValue('/team/secrets.local.yaml');
    isRemoteSecretsUrl.mockReturnValue(false);
    loadConfiguredSharedSecretsStore.mockResolvedValue({ 'hubspot-demo/apiKey': 'shared-pat' });
    await handleSecretsGet('hubspot-demo/apiKey', { shared: true, exists: true });
    expect(loadPrimaryUserSecrets).not.toHaveBeenCalled();
    expect(loadConfiguredSharedSecretsStore).toHaveBeenCalled();
  });

  it('throws when shared secrets not configured', async() => {
    const { getAifabrixSecretsPath } = require('../../../lib/core/config');
    getAifabrixSecretsPath.mockResolvedValue(null);
    await expect(handleSecretsGet('hubspot-demo/apiKey', { shared: true })).rejects.toThrow(
      /Shared secrets not configured/
    );
  });

  it('reads shared secret from remote API when URL configured', async() => {
    const { getAifabrixSecretsPath } = require('../../../lib/core/config');
    getAifabrixSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
    isRemoteSecretsUrl.mockReturnValue(true);
    getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://dev.example.com', clientCertPem: 'pem' });
    const devApi = require('../../../lib/api/dev.api');
    devApi.listSecrets.mockResolvedValue([{ name: 'hubspot-demo/apiKey', value: 'remote-pat' }]);
    await handleSecretsGet('hubspot-demo/apiKey', { shared: true, exists: true });
    expect(devApi.listSecrets).toHaveBeenCalled();
    expect(loadConfiguredSharedSecretsStore).not.toHaveBeenCalled();
    expect(loadPrimaryUserSecrets).not.toHaveBeenCalled();
  });
});
