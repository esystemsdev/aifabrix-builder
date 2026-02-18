/**
 * Tests for remote-secrets-loader (loadRemoteSharedSecrets, mergeUserWithRemoteSecrets).
 * @fileoverview Unit tests for lib/utils/remote-secrets-loader.js
 */

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/remote-dev-auth', () => ({
  isRemoteSecretsUrl: jest.fn(),
  getRemoteDevAuth: jest.fn()
}));
jest.mock('../../../lib/api/dev.api');

const config = require('../../../lib/core/config');
const devApi = require('../../../lib/api/dev.api');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../../../lib/utils/remote-dev-auth');
const {
  loadRemoteSharedSecrets,
  mergeUserWithRemoteSecrets
} = require('../../../lib/utils/remote-secrets-loader');

describe('remote-secrets-loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadRemoteSharedSecrets', () => {
    it('returns null when secrets path is not set', async() => {
      config.getSecretsPath.mockResolvedValue(null);
      const result = await loadRemoteSharedSecrets();
      expect(result).toBeNull();
    });

    it('returns null when secrets path is file path not URL', async() => {
      config.getSecretsPath.mockResolvedValue('/path/secrets.yaml');
      const result = await loadRemoteSharedSecrets();
      expect(result).toBeNull();
    });

    it('returns null when getRemoteDevAuth returns null', async() => {
      config.getSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
      getRemoteDevAuth.mockResolvedValue(null);
      isRemoteSecretsUrl.mockReturnValue(true);
      const result = await loadRemoteSharedSecrets();
      expect(result).toBeNull();
    });

    it('returns key-value object from listSecrets when remote auth available', async() => {
      config.getSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
      getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://dev.example.com', clientCertPem: 'pem' });
      isRemoteSecretsUrl.mockReturnValue(true);
      devApi.listSecrets.mockResolvedValue([
        { name: 'KEY1', value: 'v1' },
        { name: 'KEY2', value: 123 }
      ]);
      const result = await loadRemoteSharedSecrets();
      expect(result).toEqual({ KEY1: 'v1', KEY2: '123' });
      expect(devApi.listSecrets).toHaveBeenCalledWith('https://dev.example.com', 'pem');
    });

    it('returns null on API error', async() => {
      config.getSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
      getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://dev.example.com', clientCertPem: 'pem' });
      isRemoteSecretsUrl.mockReturnValue(true);
      devApi.listSecrets.mockRejectedValue(new Error('network'));
      const result = await loadRemoteSharedSecrets();
      expect(result).toBeNull();
    });
  });

  describe('mergeUserWithRemoteSecrets', () => {
    it('returns copy of userSecrets when remoteSecrets null', () => {
      const user = { A: 'a' };
      expect(mergeUserWithRemoteSecrets(user, null)).toEqual({ A: 'a' });
    });

    it('merges remote into user; user wins on same key', () => {
      const user = { A: 'userA', B: 'userB' };
      const remote = { B: 'remoteB', C: 'remoteC' };
      expect(mergeUserWithRemoteSecrets(user, remote)).toEqual({
        A: 'userA',
        B: 'userB',
        C: 'remoteC'
      });
    });

    it('fills missing user keys from remote', () => {
      const user = { A: 'a' };
      const remote = { B: 'b', C: 'c' };
      expect(mergeUserWithRemoteSecrets(user, remote)).toEqual({ A: 'a', B: 'b', C: 'c' });
    });

    it('overwrites empty user value with remote', () => {
      const user = { A: '', B: null };
      const remote = { A: 'remoteA', B: 'remoteB' };
      expect(mergeUserWithRemoteSecrets(user, remote)).toEqual({ A: 'remoteA', B: 'remoteB' });
    });
  });
});
