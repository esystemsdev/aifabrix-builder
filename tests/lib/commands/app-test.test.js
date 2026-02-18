/**
 * Tests for app test command (runAppTest, getTestCommand).
 * @fileoverview Unit tests for lib/commands/app-test.js
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({ getDeveloperId: jest.fn().mockResolvedValue('01') }));
jest.mock('../../../lib/utils/app-run-containers', () => ({
  getContainerName: jest.fn((app, devId) => `aifabrix-dev${devId}-${app}`),
  checkContainerRunning: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../../lib/utils/compose-generator', () => ({ getImageName: jest.fn(() => 'myapp') }));
jest.mock('../../../lib/utils/paths', () => ({
  getBuilderPath: jest.fn((app) => `/builder/${app}`),
  resolveApplicationConfigPath: jest.fn((p) => `${p}/application.yaml`)
}));
jest.mock('../../../lib/utils/config-format', () => ({ loadConfigFile: jest.fn(() => ({})) }));
jest.mock('child_process', () => ({ spawn: jest.fn() }));

const containerHelpers = require('../../../lib/utils/app-run-containers');
const { runAppTest, getTestCommand } = require('../../../lib/commands/app-test');
const spawn = require('child_process').spawn;

describe('app-test command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    containerHelpers.checkContainerRunning.mockResolvedValue(true);
    require('../../../lib/utils/config-format').loadConfigFile.mockReturnValue({});
    require('../../../lib/utils/compose-generator').getImageName.mockReturnValue('myapp');
    spawn.mockReturnValue({
      on: jest.fn((ev, fn) => {
        if (ev === 'close') setImmediate(() => fn(0));
        return { on: jest.fn() };
      })
    });
  });

  describe('getTestCommand', () => {
    it('returns build.scripts.test when set', () => {
      expect(getTestCommand({ build: { scripts: { test: 'pnpm test:unit' } } })).toBe('pnpm test:unit');
    });
    it('returns make test for python', () => {
      expect(getTestCommand({ language: 'python' })).toBe('make test');
    });
    it('returns pnpm test for default', () => {
      expect(getTestCommand({})).toBe('pnpm test');
    });
  });

  describe('runAppTest', () => {
    it('throws when --env is not dev or tst', async() => {
      await expect(runAppTest('myapp', { env: 'pro' })).rejects.toThrow('--env must be dev or tst');
    });
    it('throws when container not running in dev', async() => {
      containerHelpers.checkContainerRunning.mockResolvedValue(false);
      await expect(runAppTest('myapp', { env: 'dev' })).rejects.toThrow('not running');
    });
    it('runs test in container for dev', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      await runAppTest('myapp', { env: 'dev' });
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining(['exec', 'aifabrix-dev01-myapp', 'sh', '-c', 'pnpm test']), expect.any(Object));
      exitSpy.mockRestore();
    });
  });
});
