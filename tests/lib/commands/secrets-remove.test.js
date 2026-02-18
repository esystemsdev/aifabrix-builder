/**
 * Tests for secret remove command (handleSecretsRemove).
 * @fileoverview Unit tests for lib/commands/secrets-remove.js
 */

const path = require('path');

jest.mock('chalk', () => {
  const m = (s) => s; m.green = (s) => s; return m;
});
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({ getAifabrixSecretsPath: jest.fn() }));
jest.mock('../../../lib/utils/paths', () => ({ getAifabrixHome: jest.fn(() => '/home/.aifabrix') }));
jest.mock('../../../lib/utils/remote-dev-auth', () => ({
  isRemoteSecretsUrl: jest.fn(),
  getRemoteDevAuth: jest.fn()
}));
jest.mock('../../../lib/api/dev.api');
jest.mock('fs');
jest.mock('js-yaml', () => ({ load: jest.fn(() => ({})), dump: jest.fn(() => 'key: value\n') }));

const fs = require('fs');
const config = require('../../../lib/core/config');
const devApi = require('../../../lib/api/dev.api');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../../../lib/utils/remote-dev-auth');
const { handleSecretsRemove } = require('../../../lib/commands/secrets-remove');

describe('secrets-remove command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getAifabrixSecretsPath.mockResolvedValue(null);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('key1: v1\nkey2: v2\n');
    require('js-yaml').load.mockReturnValue({ key1: 'v1', key2: 'v2' });
    fs.writeFileSync.mockImplementation(() => {});
  });

  it('throws when key is missing', async() => {
    await expect(handleSecretsRemove(null, {})).rejects.toThrow('Secret key is required');
    await expect(handleSecretsRemove('', {})).rejects.toThrow('Secret key is required');
  });

  it('removes from user secrets file when shared is false', async() => {
    await handleSecretsRemove('key1', { shared: false });
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(require('../../../lib/utils/logger').log).toHaveBeenCalledWith(expect.stringContaining('removed from user secrets'));
  });

  it('throws when key not in user file', async() => {
    require('js-yaml').load.mockReturnValue({ other: 'v' });
    await expect(handleSecretsRemove('missing', { shared: false })).rejects.toThrow('not found');
  });

  it('throws when shared and aifabrix-secrets not configured', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue(null);
    await expect(handleSecretsRemove('k', { shared: true })).rejects.toThrow('Shared secrets not configured');
  });

  it('removes from remote API when shared and URL', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
    isRemoteSecretsUrl.mockReturnValue(true);
    getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://dev.example.com', clientCertPem: 'pem' });
    devApi.deleteSecret.mockResolvedValue(undefined);
    await handleSecretsRemove('KEY1', { shared: true });
    expect(devApi.deleteSecret).toHaveBeenCalledWith('https://dev.example.com', 'pem', 'KEY1');
  });

  it('throws when remote returns 404', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
    isRemoteSecretsUrl.mockReturnValue(true);
    getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://dev.example.com', clientCertPem: 'pem' });
    const err = new Error('Not found');
    err.status = 404;
    devApi.deleteSecret.mockRejectedValue(err);
    await expect(handleSecretsRemove('MISSING', { shared: true })).rejects.toThrow('not found');
  });
});
