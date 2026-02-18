/**
 * Tests for app shell command (runAppShell).
 * @fileoverview Unit tests for lib/commands/app-shell.js
 */

const { spawn } = require('child_process');

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({ getDeveloperId: jest.fn().mockResolvedValue('01') }));
jest.mock('../../../lib/utils/app-run-containers', () => ({
  getContainerName: jest.fn((app, devId) => `aifabrix-dev${devId}-${app}`),
  checkContainerRunning: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../../lib/utils/paths', () => ({
  getBuilderPath: jest.fn((app) => `/builder/${app}`),
  resolveApplicationConfigPath: jest.fn((p) => `${p}/application.yaml`)
}));
jest.mock('../../../lib/utils/config-format', () => ({ loadConfigFile: jest.fn(() => ({})) }));
jest.mock('child_process', () => ({ spawn: jest.fn() }));

const containerHelpers = require('../../../lib/utils/app-run-containers');
const { runAppShell } = require('../../../lib/commands/app-shell');

describe('app-shell command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    containerHelpers.checkContainerRunning.mockResolvedValue(true);
    spawn.mockReturnValue({
      on: jest.fn((ev, fn) => {
        if (ev === 'close') setImmediate(() => fn(0));
        return { on: jest.fn() };
      })
    });
  });

  it('throws when container is not running', async() => {
    containerHelpers.checkContainerRunning.mockResolvedValue(false);
    await expect(runAppShell('myapp', {})).rejects.toThrow('is not running');
  });

  it('spawns docker exec -it container sh', async() => {
    let resolve;
    const p = new Promise(r => {
      resolve = r;
    });
    spawn.mockReturnValue({
      on: jest.fn((ev, fn) => {
        if (ev === 'close') setImmediate(() => {
          fn(0); resolve();
        });
        if (ev === 'error') return;
        return { on: jest.fn() };
      })
    });

    const run = runAppShell('myapp', {});
    await run;

    expect(spawn).toHaveBeenCalledWith('docker', ['exec', '-it', 'aifabrix-dev01-myapp', 'sh'], expect.objectContaining({ stdio: 'inherit', shell: false }));
  });
});
