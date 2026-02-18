/**
 * Tests for secret list command (handleSecretsList).
 * @fileoverview Unit tests for lib/commands/secrets-list.js
 */

const path = require('path');

jest.mock('chalk', () => {
  const m = (s) => s;
  m.gray = (s) => s;
  m.blue = (s) => s;
  m.bold = (s) => s;
  return m;
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
jest.mock('js-yaml', () => ({ load: jest.fn().mockReturnValue({}) }));

const fs = require('fs');
const config = require('../../../lib/core/config');
const devApi = require('../../../lib/api/dev.api');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../../../lib/utils/remote-dev-auth');
const { handleSecretsList } = require('../../../lib/commands/secrets-list');
const logger = require('../../../lib/utils/logger');

describe('secrets-list command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getAifabrixSecretsPath.mockResolvedValue(null);
  });

  it('lists user secrets (key and value) sorted, in table format', async() => {
    fs.existsSync.mockReturnValue(true);
    require('js-yaml').load.mockReturnValue({ KEY1: 'v1', KEY2: 'v2' });
    await handleSecretsList({ shared: false });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('User secrets'));
    expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/^Key\s+Value$/));
    const key1Row = 'KEY1'.padEnd(45) + 'v1';
    const key2Row = 'KEY2'.padEnd(45) + 'v2';
    expect(logger.log).toHaveBeenCalledWith(key1Row);
    expect(logger.log).toHaveBeenCalledWith(key2Row);
  });

  it('logs empty message when no user secrets', async() => {
    fs.existsSync.mockReturnValue(false);
    await handleSecretsList({ shared: false });
    expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/No user secrets/));
  });

  it('throws when shared is true and aifabrix-secrets not configured', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue(null);
    await expect(handleSecretsList({ shared: true })).rejects.toThrow('Shared secrets not configured');
  });

  it('lists shared secrets (key and value) from remote API when URL', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
    isRemoteSecretsUrl.mockReturnValue(true);
    getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://dev.example.com', clientCertPem: 'pem' });
    devApi.listSecrets.mockResolvedValue([{ name: 'S1', value: 'val1' }, { name: 'S2', value: 'val2' }]);
    await handleSecretsList({ shared: true });
    expect(devApi.listSecrets).toHaveBeenCalledWith('https://dev.example.com', 'pem');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Shared secrets (remote)'));
    expect(logger.log).toHaveBeenCalledWith('S1'.padEnd(45) + 'val1');
    expect(logger.log).toHaveBeenCalledWith('S2'.padEnd(45) + 'val2');
  });

  it('uses key when name missing in remote API item', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
    isRemoteSecretsUrl.mockReturnValue(true);
    getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://dev.example.com', clientCertPem: 'pem' });
    devApi.listSecrets.mockResolvedValue([{ key: 'LEGACY_KEY', value: 'legacy-val' }]);
    await handleSecretsList({ shared: true });
    expect(logger.log).toHaveBeenCalledWith('LEGACY_KEY'.padEnd(45) + 'legacy-val');
  });

  it('throws when remote URL but auth not configured', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
    isRemoteSecretsUrl.mockReturnValue(true);
    getRemoteDevAuth.mockResolvedValue(null);
    await expect(handleSecretsList({ shared: true })).rejects.toThrow('Remote server is not configured. Set remote-server and run "aifabrix dev init" first.');
  });

  it('lists shared secrets (key and value) from file when aifabrix-secrets is path', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue('/path/to/shared.yaml');
    isRemoteSecretsUrl.mockReturnValue(false);
    fs.existsSync.mockReturnValue(true);
    require('js-yaml').load.mockReturnValue({ SHARED_A: 'secret1', SHARED_B: 'secret2' });
    await handleSecretsList({ shared: true });
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Shared secrets (file: /path/to/shared.yaml)'));
    expect(logger.log).toHaveBeenCalledWith('SHARED_A'.padEnd(45) + 'secret1');
    expect(logger.log).toHaveBeenCalledWith('SHARED_B'.padEnd(45) + 'secret2');
  });

  it('formats null or missing value as empty string (sorted by key)', async() => {
    fs.existsSync.mockReturnValue(true);
    require('js-yaml').load.mockReturnValue({ HAS_VAL: 'x', NO_VAL: null, EMPTY: '' });
    await handleSecretsList({ shared: false });
    expect(logger.log).toHaveBeenCalledWith('EMPTY'.padEnd(45) + '');
    expect(logger.log).toHaveBeenCalledWith('HAS_VAL'.padEnd(45) + 'x');
    expect(logger.log).toHaveBeenCalledWith('NO_VAL'.padEnd(45) + '');
  });
});
