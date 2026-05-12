/**
 * @fileoverview Tests for orphan infra Docker teardown helpers
 */

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

jest.mock('../../../lib/utils/docker', () => ({
  getComposeCommand: jest.fn().mockResolvedValue('docker compose')
}));

jest.mock('../../../lib/infrastructure/services', () => ({
  execAsyncWithCwd: jest.fn()
}));

const dockerUtils = require('../../../lib/utils/docker');
const { execAsyncWithCwd } = require('../../../lib/infrastructure/services');
const {
  getInfraBridgeNetworkName,
  tryComposeProjectDown,
  stopInfraDockerStackOrphaned
} = require('../../../lib/infrastructure/orphan-infra-docker-teardown');

describe('orphan-infra-docker-teardown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getInfraBridgeNetworkName matches dev 0 and non-zero naming', () => {
    expect(getInfraBridgeNetworkName(0)).toBe('infra-aifabrix-network');
    expect(getInfraBridgeNetworkName('6')).toBe('infra-dev6-aifabrix-network');
  });

  it('tryComposeProjectDown runs docker compose down with project and -v when requested', async() => {
    execAsyncWithCwd.mockResolvedValue({ stdout: '', stderr: '' });
    await tryComposeProjectDown(6, true);
    expect(dockerUtils.getComposeCommand).toHaveBeenCalled();
    expect(execAsyncWithCwd).toHaveBeenCalledWith('docker compose -p "infra-dev6" down -v');
  });

  it('stopInfraDockerStackOrphaned removes network after containers', async() => {
    execAsyncWithCwd.mockImplementation(async(cmd) => {
      if (cmd.includes('network inspect')) {
        return { stdout: '{"abc":{"Name":"aifabrix-dev6-postgres"}}', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });
    await stopInfraDockerStackOrphaned('6', { removeVolumes: true });
    expect(execAsyncWithCwd).toHaveBeenCalledWith(expect.stringContaining('docker rm -f'));
    expect(execAsyncWithCwd).toHaveBeenCalledWith('docker network rm "infra-dev6-aifabrix-network"');
  });
});
