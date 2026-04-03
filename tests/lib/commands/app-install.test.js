/**
 * Tests for app install command (runAppInstall, getInstallCommand).
 * @fileoverview Unit tests for lib/commands/app-install.js
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({
  getDeveloperId: jest.fn().mockResolvedValue('01'),
  getDockerEndpoint: jest.fn().mockResolvedValue(null)
}));
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
jest.mock('../../../lib/core/secrets-env-write', () => ({ resolveAndWriteEnvFile: jest.fn().mockResolvedValue('/tmp/app.env') }));
jest.mock('child_process', () => ({ spawn: jest.fn() }));

const containerHelpers = require('../../../lib/utils/app-run-containers');
const { runAppInstall, getInstallCommand } = require('../../../lib/commands/app-install');
const spawn = require('child_process').spawn;

describe('app-install command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    containerHelpers.checkContainerRunning.mockResolvedValue(true);
    require('../../../lib/utils/config-format').loadConfigFile.mockReturnValue({});
    require('../../../lib/utils/compose-generator').getImageName.mockReturnValue('myapp');
    require('../../../lib/core/secrets-env-write').resolveAndWriteEnvFile.mockResolvedValue('/tmp/app.env');
    spawn.mockReturnValue({
      on: jest.fn((ev, fn) => {
        if (ev === 'close') setImmediate(() => fn(0));
        return { on: jest.fn() };
      })
    });
  });

  describe('getInstallCommand', () => {
    it('returns build.scripts.install when set', () => {
      expect(getInstallCommand({ build: { scripts: { install: 'pnpm i' } } })).toBe('pnpm i');
    });
    it('returns scripts.install from appConfig.scripts when build.scripts not set', () => {
      expect(getInstallCommand({ scripts: { install: 'yarn install' } })).toBe('yarn install');
    });
    it('returns make install for python (build.language)', () => {
      expect(getInstallCommand({ build: { language: 'python' } })).toBe('make install');
    });
    it('returns make install for python', () => {
      expect(getInstallCommand({ language: 'python' })).toBe('make install');
    });
    it('returns pnpm install for default', () => {
      expect(getInstallCommand({})).toBe('pnpm install');
    });
  });

  describe('runAppInstall', () => {
    it('throws when --env is not dev or tst', async() => {
      await expect(runAppInstall('myapp', { env: 'pro' })).rejects.toThrow('--env must be dev or tst');
    });
    it('throws when container not running in dev', async() => {
      containerHelpers.checkContainerRunning.mockResolvedValue(false);
      await expect(runAppInstall('myapp', { env: 'dev' })).rejects.toThrow('not running');
    });
    it('runs install in container for dev', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
      await runAppInstall('myapp', { env: 'dev' });
      expect(secretsEnvWrite.resolveAndWriteEnvFile).toHaveBeenCalledWith('myapp', {});
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining([
        'exec', '-e', 'TMPDIR=/tmp', '-e', 'npm_config_store_dir=/tmp/.pnpm-store', '-e', 'CI=true',
        '--env-file', '/tmp/app.env',
        'aifabrix-dev01-myapp', 'sh', '-c', 'pnpm install --store-dir /tmp/.pnpm-store'
      ]), expect.any(Object));
      exitSpy.mockRestore();
    });
    it('runs install in ephemeral container for tst with env file', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
      await runAppInstall('myapp', { env: 'tst' });
      expect(secretsEnvWrite.resolveAndWriteEnvFile).toHaveBeenCalledWith('myapp', {});
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining([
        'run', '--rm', '-e', 'TMPDIR=/tmp', '-e', 'npm_config_store_dir=/tmp/.pnpm-store', '-e', 'CI=true',
        '--env-file', '/tmp/app.env', 'myapp:latest', 'sh', '-c', 'pnpm install --store-dir /tmp/.pnpm-store'
      ]), expect.any(Object));
      exitSpy.mockRestore();
    });
    it('calls process.exit with code when docker exec returns non-zero in dev', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      spawn.mockReturnValue({
        on: jest.fn((ev, fn) => {
          if (ev === 'close') setImmediate(() => fn(1));
          return { on: jest.fn() };
        })
      });
      await runAppInstall('myapp', { env: 'dev' });
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
    it('calls process.exit with code when docker run returns non-zero in tst', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      spawn.mockReturnValue({
        on: jest.fn((ev, fn) => {
          if (ev === 'close') setImmediate(() => fn(2));
          return { on: jest.fn() };
        })
      });
      await runAppInstall('myapp', { env: 'tst' });
      expect(exitSpy).toHaveBeenCalledWith(2);
      exitSpy.mockRestore();
    });
    it('uses custom image tag in ephemeral run when appConfig.image.tag is set', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      require('../../../lib/utils/config-format').loadConfigFile.mockReturnValue({ image: { tag: 'v1.0' } });
      require('../../../lib/utils/compose-generator').getImageName.mockReturnValue('myapp');
      await runAppInstall('myapp', { env: 'tst' });
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining([
        'run', '--rm', '-e', 'TMPDIR=/tmp', '-e', 'npm_config_store_dir=/tmp/.pnpm-store', '-e', 'CI=true',
        '--env-file', '/tmp/app.env', 'myapp:v1.0', 'sh', '-c', expect.stringContaining('pnpm install')
      ]), expect.any(Object));
      exitSpy.mockRestore();
    });
  });
});
