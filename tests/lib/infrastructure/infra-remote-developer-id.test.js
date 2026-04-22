/**
 * @fileoverview startInfra fails fast when remote-server is non-local but developer-id is invalid (plan 018)
 */

jest.mock('chalk', () => {
  const c = (t) => t;
  c.blue = c.green = c.yellow = c.red = c.gray = c.cyan = (t) => t;
  return c;
});

jest.mock('../../../lib/core/secrets-ensure', () => ({
  ensureInfraSecrets: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../../lib/infrastructure/helpers', () => {
  const actual = jest.requireActual('../../../lib/infrastructure/helpers');
  return {
    ...actual,
    checkDockerAvailability: jest.fn().mockResolvedValue(undefined),
    ensureAdminSecrets: jest.fn().mockResolvedValue('/home/test/.aifabrix/admin-secrets.env')
  };
});

jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue('0'),
  getRemoteServer: jest.fn().mockResolvedValue('https://builder02.local'),
  getDockerEndpoint: jest.fn().mockResolvedValue(null),
  getDockerTlsSkipVerify: jest.fn().mockResolvedValue(false),
  getConfig: jest.fn().mockResolvedValue({ 'developer-id': '0' }),
  saveConfig: jest.fn().mockResolvedValue(),
  clearConfig: jest.fn().mockResolvedValue(),
  CONFIG_DIR: '/home/test/.aifabrix',
  CONFIG_FILE: '/home/test/.aifabrix/config.yaml'
}));

jest.mock('../../../lib/core/secrets', () => ({
  generateAdminSecretsEnv: jest.fn().mockResolvedValue('/home/test/.aifabrix/admin-secrets.env')
}));

jest.mock('../../../lib/utils/docker', () => ({
  ensureDockerAndCompose: jest.fn().mockResolvedValue(undefined),
  getComposeCommand: jest.fn().mockResolvedValue('docker compose')
}));

jest.mock('../../../lib/infrastructure/services', () => ({
  execAsyncWithCwd: jest.fn().mockResolvedValue({ stdout: '', stderr: '' }),
  startDockerServicesAndConfigure: jest.fn().mockResolvedValue(undefined),
  checkInfraHealth: jest.fn().mockResolvedValue({})
}));

const config = require('../../../lib/core/config');
const infra = require('../../../lib/infrastructure');

describe('startInfra remote builder developer-id policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.getDeveloperId.mockResolvedValue('0');
    config.getRemoteServer.mockResolvedValue('https://builder02.local');
  });

  it('rejects when remote-server is non-local and developer-id is 0', async() => {
    await expect(infra.startInfra(null, {})).rejects.toThrow(/positive developer-id/);
    await expect(infra.startInfra(null, {})).rejects.toThrow(/Remote builder at/);
  });

  it('rejects when remote-server is non-local and developer-id is empty', async() => {
    config.getDeveloperId.mockResolvedValue('');
    await expect(infra.startInfra(null, {})).rejects.toThrow(/positive developer-id/);
  });

  it('rejects when remote-server is non-local and developer-id is non-numeric', async() => {
    config.getDeveloperId.mockResolvedValue('abc');
    await expect(infra.startInfra(null, {})).rejects.toThrow(/positive developer-id/);
  });

  it('rejects when remote-server is non-local and developer-id is null from config', async() => {
    config.getDeveloperId.mockResolvedValue(null);
    await expect(infra.startInfra(null, {})).rejects.toThrow(/positive developer-id/);
  });
});
