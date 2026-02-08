/**
 * Tests for app-logs command
 * @fileoverview Unit tests for lib/commands/app-logs.js
 */

jest.mock('../../../lib/utils/logger', () => ({ log: jest.fn() }));
jest.mock('../../../lib/core/config', () => ({ getDeveloperId: jest.fn().mockResolvedValue(0) }));
jest.mock('../../../lib/utils/app-run-containers', () => ({ getContainerName: jest.fn((app, devId) => `aifabrix-${app}`) }));
jest.mock('../../../lib/app/push', () => ({ validateAppName: jest.fn() }));

const { exec, spawn } = require('child_process');
jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn()
}));

// Mock util.promisify so exec returns { stdout, stderr } (like real Node exec)
const util = require('util');
jest.spyOn(util, 'promisify').mockImplementation((fn) => fn);

const appLogs = require('../../../lib/commands/app-logs');

describe('app-logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('../../../lib/core/config').getDeveloperId.mockResolvedValue(0);
  });

  describe('maskEnvLine', () => {
    it('masks line when key matches secret pattern', () => {
      expect(appLogs.maskEnvLine('PASSWORD=secret')).toBe('PASSWORD=***');
      expect(appLogs.maskEnvLine('API_KEY=abc')).toBe('API_KEY=***');
      expect(appLogs.maskEnvLine('CLIENT_SECRET=xyz')).toBe('CLIENT_SECRET=***');
    });

    it('masks KEYCLOAK_ only when suffix is secret (PASSWORD, SECRET, etc.)', () => {
      expect(appLogs.maskEnvLine('KEYCLOAK_ADMIN_PASSWORD=admin')).toBe('KEYCLOAK_ADMIN_PASSWORD=***');
      expect(appLogs.maskEnvLine('KEYCLOAK_CLIENT_SECRET=xyz')).toBe('KEYCLOAK_CLIENT_SECRET=***');
      expect(appLogs.maskEnvLine('KEYCLOAK_SERVER_URL=http://keycloak:8080')).toBe('KEYCLOAK_SERVER_URL=http://keycloak:8080');
      expect(appLogs.maskEnvLine('KEYCLOAK_REALM=aifabrix')).toBe('KEYCLOAK_REALM=aifabrix');
      expect(appLogs.maskEnvLine('KEYCLOAK_EVENTS_ENABLED=true')).toBe('KEYCLOAK_EVENTS_ENABLED=true');
    });

    it('masks credentials in URL values (postgresql://, etc.)', () => {
      expect(appLogs.maskEnvLine('DATABASE_URL=postgresql://miso_user:miso_pass123@postgres:5432/miso')).toBe(
        'DATABASE_URL=postgresql://miso_user:***@postgres:5432/miso'
      );
      expect(appLogs.maskEnvLine('DATABASELOG_URL=postgresql://miso_logs_user:miso_logs_pass123@postgres:5432/miso-logs')).toBe(
        'DATABASELOG_URL=postgresql://miso_logs_user:***@postgres:5432/miso-logs'
      );
    });

    it('leaves line unchanged when key does not match', () => {
      expect(appLogs.maskEnvLine('NODE_ENV=development')).toBe('NODE_ENV=development');
      expect(appLogs.maskEnvLine('PORT=3000')).toBe('PORT=3000');
    });
  });

  describe('runAppLogs', () => {
    it('validates app name and runs docker logs with default tail', async() => {
      exec.mockImplementation((cmd) =>
        Promise.resolve({
          stdout: cmd.includes('env') ? 'NODE_ENV=dev\n' : 'log line',
          stderr: ''
        })
      );
      spawn.mockImplementation(() => ({
        on: jest.fn((ev, fn) => {
          if (ev === 'close') setImmediate(() => fn(0));
          return { on: jest.fn() };
        })
      }));

      await appLogs.runAppLogs('myapp', { follow: false, tail: 100 });

      expect(require('../../../lib/app/push').validateAppName).toHaveBeenCalledWith('myapp');
      expect(exec).toHaveBeenCalled();
    });

    it('sorts env variable keys alphabetically', async() => {
      const unsortedEnv = 'PATH=/usr/bin\nNODE_ENV=dev\nABC=123\nHOME=/root';
      exec.mockImplementation((cmd) =>
        Promise.resolve({
          stdout: cmd.includes('env') ? unsortedEnv : '',
          stderr: ''
        })
      );
      spawn.mockImplementation(() => ({
        on: jest.fn((ev, fn) => {
          if (ev === 'close') setImmediate(() => fn(0));
          return { on: jest.fn() };
        })
      }));

      const logger = require('../../../lib/utils/logger');
      await appLogs.runAppLogs('myapp', { follow: false, tail: 100 });

      const logCalls = logger.log.mock.calls.map((c) => c[0]);
      const envCalls = logCalls.filter((l) => l && typeof l === 'string' && !l.includes('---') && !l.includes('Container') && l !== '\n');
      expect(envCalls).toEqual(['ABC=123', 'HOME=/root', 'NODE_ENV=dev', 'PATH=/usr/bin']);
    });

    it('throws on invalid app name', async() => {
      const push = require('../../../lib/app/push');
      push.validateAppName.mockImplementation(() => {
        throw new Error('Application name is required');
      });
      await expect(appLogs.runAppLogs('ab', {})).rejects.toThrow();
    });
  });
});
