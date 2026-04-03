/**
 * Tests for app test command (runAppTest, getTestCommand).
 * @fileoverview Unit tests for lib/commands/app-test.js
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
jest.mock('../../../lib/core/secrets-env-write', () => ({ resolveAndWriteEnvFile: jest.fn().mockResolvedValue('/tmp/test.env') }));
jest.mock('child_process', () => ({ spawn: jest.fn() }));

const containerHelpers = require('../../../lib/utils/app-run-containers');
const { runAppTest, getTestCommand, getTestE2eCommand, getTestIntegrationCommand, getLintCommand, runAppTestE2e, runAppTestIntegration, runAppLint } = require('../../../lib/commands/app-test');
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

  describe('getTestE2eCommand', () => {
    it('returns build.scripts.test:e2e when set', () => {
      expect(getTestE2eCommand({ build: { scripts: { 'test:e2e': 'pnpm test:e2e' } } })).toBe('pnpm test:e2e');
    });
    it('returns build.scripts.testE2e when set', () => {
      expect(getTestE2eCommand({ build: { scripts: { testE2e: 'make test:e2e' } } })).toBe('make test:e2e');
    });
    it('returns make test:e2e for python', () => {
      expect(getTestE2eCommand({ language: 'python' })).toBe('make test:e2e');
    });
    it('returns pnpm test:e2e for default', () => {
      expect(getTestE2eCommand({})).toBe('pnpm test:e2e');
    });
  });

  describe('getTestIntegrationCommand', () => {
    it('returns build.scripts.test:integration when set', () => {
      expect(getTestIntegrationCommand({ build: { scripts: { 'test:integration': 'pnpm test:integration' } } })).toBe('pnpm test:integration');
    });
    it('returns build.scripts.testIntegration when set', () => {
      expect(getTestIntegrationCommand({ build: { scripts: { testIntegration: 'make test-integration' } } })).toBe('make test-integration');
    });
    it('falls back to test:e2e when no integration script set', () => {
      expect(getTestIntegrationCommand({})).toBe('pnpm test:e2e');
    });
    it('falls back to testE2e for python when no integration script set', () => {
      expect(getTestIntegrationCommand({ language: 'python' })).toBe('make test:e2e');
    });
  });

  describe('getLintCommand', () => {
    it('returns build.scripts.lint when set', () => {
      expect(getLintCommand({ build: { scripts: { lint: 'pnpm run lint' } } })).toBe('pnpm run lint');
    });
    it('returns make lint for python', () => {
      expect(getLintCommand({ language: 'python' })).toBe('make lint');
    });
    it('returns pnpm lint for default', () => {
      expect(getLintCommand({})).toBe('pnpm lint');
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
      const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
      await runAppTest('myapp', { env: 'dev' });
      expect(secretsEnvWrite.resolveAndWriteEnvFile).toHaveBeenCalledWith('myapp', {});
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining(['exec', '--env-file', '/tmp/test.env', 'aifabrix-dev01-myapp', 'sh', '-c', 'pnpm test']), expect.any(Object));
      exitSpy.mockRestore();
    });
    it('runs test in ephemeral container for tst with env file', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
      await runAppTest('myapp', { env: 'tst' });
      expect(secretsEnvWrite.resolveAndWriteEnvFile).toHaveBeenCalledWith('myapp', {});
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining(['run', '--rm', '--env-file', '/tmp/test.env', 'myapp:latest', 'sh', '-c', 'pnpm test']), expect.any(Object));
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
      await runAppTest('myapp', { env: 'dev' });
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
      await runAppTest('myapp', { env: 'tst' });
      expect(exitSpy).toHaveBeenCalledWith(2);
      exitSpy.mockRestore();
    });
  });

  describe('runAppTestE2e', () => {
    it('throws when --env is not dev or tst', async() => {
      await expect(runAppTestE2e('myapp', { env: 'pro' })).rejects.toThrow('--env must be dev or tst');
    });
    it('throws when container not running in dev', async() => {
      containerHelpers.checkContainerRunning.mockResolvedValue(false);
      await expect(runAppTestE2e('myapp', { env: 'dev' })).rejects.toThrow('not running');
    });
    it('runs test-e2e in container for dev', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
      await runAppTestE2e('myapp', { env: 'dev' });
      expect(secretsEnvWrite.resolveAndWriteEnvFile).toHaveBeenCalledWith('myapp', {});
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining(['exec', '--env-file', '/tmp/test.env', 'aifabrix-dev01-myapp', 'sh', '-c', 'pnpm test:e2e']), expect.any(Object));
      exitSpy.mockRestore();
    });
    it('runs test-e2e in ephemeral container for tst with env file', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
      await runAppTestE2e('myapp', { env: 'tst' });
      expect(secretsEnvWrite.resolveAndWriteEnvFile).toHaveBeenCalledWith('myapp', {});
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining(['run', '--rm', '--env-file', '/tmp/test.env', 'myapp:latest', 'sh', '-c', 'pnpm test:e2e']), expect.any(Object));
      exitSpy.mockRestore();
    });
  });

  describe('runAppTestIntegration', () => {
    it('throws when --env is not dev or tst', async() => {
      await expect(runAppTestIntegration('myapp', { env: 'pro' })).rejects.toThrow('--env must be dev or tst');
    });
    it('throws when container not running in dev', async() => {
      containerHelpers.checkContainerRunning.mockResolvedValue(false);
      await expect(runAppTestIntegration('myapp', { env: 'dev' })).rejects.toThrow('not running');
    });
    it('runs test-integration (defaults to test:e2e) in container for dev', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
      await runAppTestIntegration('myapp', { env: 'dev' });
      expect(secretsEnvWrite.resolveAndWriteEnvFile).toHaveBeenCalledWith('myapp', {});
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining(['exec', '--env-file', '/tmp/test.env', 'aifabrix-dev01-myapp', 'sh', '-c', 'pnpm test:e2e']), expect.any(Object));
      exitSpy.mockRestore();
    });
    it('runs custom test:integration script when set', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      require('../../../lib/utils/config-format').loadConfigFile.mockReturnValue({ build: { scripts: { 'test:integration': 'pnpm test:integration' } } });
      await runAppTestIntegration('myapp', { env: 'dev' });
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining(['--env-file', '/tmp/test.env', 'aifabrix-dev01-myapp', 'sh', '-c', 'pnpm test:integration']), expect.any(Object));
      exitSpy.mockRestore();
    });
  });

  describe('runAppLint', () => {
    it('throws when --env is not dev or tst', async() => {
      await expect(runAppLint('myapp', { env: 'prod' })).rejects.toThrow('--env must be dev or tst');
    });
    it('throws when container not running in dev', async() => {
      containerHelpers.checkContainerRunning.mockResolvedValue(false);
      await expect(runAppLint('myapp', { env: 'dev' })).rejects.toThrow('not running');
    });
    it('runs lint in container for dev', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
      await runAppLint('myapp', { env: 'dev' });
      expect(secretsEnvWrite.resolveAndWriteEnvFile).toHaveBeenCalledWith('myapp', {});
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining(['exec', '--env-file', '/tmp/test.env', 'aifabrix-dev01-myapp', 'sh', '-c', 'pnpm lint']), expect.any(Object));
      exitSpy.mockRestore();
    });
    it('runs lint in ephemeral container for tst with env file', async() => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const secretsEnvWrite = require('../../../lib/core/secrets-env-write');
      await runAppLint('myapp', { env: 'tst' });
      expect(secretsEnvWrite.resolveAndWriteEnvFile).toHaveBeenCalledWith('myapp', {});
      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining(['run', '--rm', '--env-file', '/tmp/test.env', 'myapp:latest', 'sh', '-c', 'pnpm lint']), expect.any(Object));
      exitSpy.mockRestore();
    });
  });
});
