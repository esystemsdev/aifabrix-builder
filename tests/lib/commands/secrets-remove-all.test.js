/**
 * Tests for secret remove-all command (handleSecretsRemoveAll).
 * @fileoverview Unit tests for lib/commands/secrets-remove-all.js
 */

jest.mock('chalk', () => {
  const m = s => s;
  m.green = s => s;
  m.yellow = s => s;
  m.bold = s => s;
  m.gray = s => s;
  return m;
});
jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({
  getAifabrixSecretsPath: jest.fn(),
  getRemoteServer: jest.fn().mockResolvedValue(null),
  getDeveloperId: jest.fn().mockResolvedValue('1')
}));
jest.mock('../../../lib/utils/paths', () => ({
  getPrimaryUserSecretsLocalPath: jest.fn(() => '/home/.aifabrix/secrets.local.yaml'),
  getAifabrixWork: jest.fn(() => null)
}));
jest.mock('../../../lib/utils/remote-dev-auth', () => {
  const actual = jest.requireActual('../../../lib/utils/remote-dev-auth');
  return {
    ...actual,
    isRemoteSecretsUrl: jest.fn(),
    getRemoteDevAuth: jest.fn(),
    getSharedSecretsRemoteHostname: jest.fn(() => 'dev.example.com')
  };
});
jest.mock('../../../lib/api/dev.api');
jest.mock('fs');
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: (_q, cb) => {
      cb('no');
    },
    close: jest.fn()
  }))
}));
jest.mock('js-yaml', () => ({ load: jest.fn(() => ({})), dump: jest.fn(() => '{}\n') }));

const fs = require('fs');
const readline = require('readline');
const config = require('../../../lib/core/config');
const devApi = require('../../../lib/api/dev.api');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../../../lib/utils/remote-dev-auth');
const { handleSecretsRemoveAll } = require('../../../lib/commands/secrets-remove-all');

describe('secrets-remove-all command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const actual = jest.requireActual('../../../lib/utils/remote-dev-auth');
    isRemoteSecretsUrl.mockImplementation(actual.isRemoteSecretsUrl);
    getRemoteDevAuth.mockResolvedValue(null);
    config.getAifabrixSecretsPath.mockResolvedValue(null);
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('a: "1"\nb: "2"\n');
    require('js-yaml').load.mockReturnValue({ a: '1', b: '2' });
    fs.writeFileSync.mockImplementation(() => {});
    readline.createInterface.mockReturnValue({
      question: (_q, cb) => {
        cb('no');
      },
      close: jest.fn()
    });
  });

  it('logs when no user secrets', async() => {
    require('js-yaml').load.mockReturnValue({});
    await handleSecretsRemoveAll({});
    expect(require('../../../lib/utils/logger').log).toHaveBeenCalledWith(expect.stringContaining('No user secrets'));
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('removes all user secrets when --yes', async() => {
    await handleSecretsRemoveAll({ yes: true });
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(require('../../../lib/utils/logger').log).toHaveBeenCalledWith(expect.stringContaining('Removed 2 secret'));
  });

  it('cancels when user does not type yes', async() => {
    readline.createInterface.mockReturnValue({
      question: (_q, cb) => {
        cb('nope');
      },
      close: jest.fn()
    });
    await handleSecretsRemoveAll({});
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(require('../../../lib/utils/logger').log).toHaveBeenCalledWith(expect.stringContaining('Cancelled'));
  });

  it('proceeds when user types yes', async() => {
    readline.createInterface.mockReturnValue({
      question: (_q, cb) => {
        cb('yes');
      },
      close: jest.fn()
    });
    await handleSecretsRemoveAll({});
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('throws when shared and aifabrix-secrets not configured', async() => {
    await expect(handleSecretsRemoveAll({ shared: true })).rejects.toThrow('Shared secrets not configured');
  });

  it('removes all shared file secrets when --yes', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue('/tmp/shared.yaml');
    isRemoteSecretsUrl.mockReturnValue(false);
    await handleSecretsRemoveAll({ shared: true, yes: true });
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(require('../../../lib/utils/logger').log).toHaveBeenCalledWith(expect.stringContaining('Removed 2 secret'));
  });

  it('removes all remote shared secrets when --yes', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
    isRemoteSecretsUrl.mockReturnValue(true);
    getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://dev.example.com', clientCertPem: 'pem' });
    devApi.listSecrets.mockResolvedValue([{ name: 'K1' }, { key: 'K2' }]);
    devApi.deleteSecret.mockResolvedValue(undefined);
    await handleSecretsRemoveAll({ shared: true, yes: true });
    expect(devApi.deleteSecret).toHaveBeenCalledTimes(2);
    expect(devApi.deleteSecret).toHaveBeenCalledWith(
      'https://dev.example.com',
      'pem',
      'K1',
      undefined,
      'https://dev.example.com/secrets'
    );
  });

  it('logs when remote has no secrets', async() => {
    config.getAifabrixSecretsPath.mockResolvedValue('https://dev.example.com/secrets');
    isRemoteSecretsUrl.mockReturnValue(true);
    getRemoteDevAuth.mockResolvedValue({ serverUrl: 'https://dev.example.com', clientCertPem: 'pem' });
    devApi.listSecrets.mockResolvedValue([]);
    await handleSecretsRemoveAll({ shared: true, yes: true });
    expect(devApi.deleteSecret).not.toHaveBeenCalled();
    expect(require('../../../lib/utils/logger').log).toHaveBeenCalledWith(expect.stringContaining('No shared secrets'));
  });
});
