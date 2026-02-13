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

const { PassThrough } = require('stream');
const appLogs = require('../../../lib/commands/app-logs');

describe('app-logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('../../../lib/core/config').getDeveloperId.mockResolvedValue(0);
    require('../../../lib/app/push').validateAppName.mockImplementation(() => {});
  });

  describe('getLogLevel', () => {
    it('parses prefix INFO:, ERROR:, WARN:, WARNING:, DEBUG:', () => {
      expect(appLogs.getLogLevel('INFO: something')).toBe('info');
      expect(appLogs.getLogLevel('ERROR: fail')).toBe('error');
      expect(appLogs.getLogLevel('WARN: warning')).toBe('warn');
      expect(appLogs.getLogLevel('WARNING: warning')).toBe('warn');
      expect(appLogs.getLogLevel('DEBUG: debug')).toBe('debug');
    });

    it('parses lowercase prefix (miso-controller/pino): error:, info:', () => {
      expect(appLogs.getLogLevel('error: generateClientToken failed: Application not found')).toBe('error');
      expect(appLogs.getLogLevel('info: Request completed')).toBe('info');
    });

    it('parses level after timestamp or prefix (e.g. miso-controller with timestamp)', () => {
      expect(
        appLogs.getLogLevel('2026-02-11 08:51:01 error: generateClientToken failed: Application not found')
      ).toBe('error');
      expect(appLogs.getLogLevel('  info: Request completed')).toBe('info');
    });

    it('parses level after word boundary (e.g. [pino]error: or bracket prefix)', () => {
      expect(appLogs.getLogLevel('[pino] error: generateClientToken failed')).toBe('error');
      expect(appLogs.getLogLevel('[pino]error: generateClientToken failed')).toBe('error');
    });

    it('filtering full log with -l error keeps only error lines (miso-controller style)', () => {
      const fullLogLines = [
        'error: generateClientToken failed: Application not found generateClientToken failed: Application not found',
        'info: Request completed Request completed',
        'info: Request completed Request completed'
      ];
      const filtered = fullLogLines.filter((line) =>
        appLogs.passesLevelFilter(appLogs.getLogLevel(line), 'error')
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toContain('error: generateClientToken failed');
      expect(filtered.some((l) => l.includes('info: Request completed'))).toBe(false);
    });

    it('parses JSON "level" field', () => {
      expect(appLogs.getLogLevel('{"level": "info", "msg": "ok"}')).toBe('info');
      expect(appLogs.getLogLevel('{"level":"error"}')).toBe('error');
      expect(appLogs.getLogLevel('{"level": "warning"}')).toBe('warn');
    });

    it('parses JSON "level" numeric (pino/bunyan: 50=error, 60=fatal, 40=warn, 30=info)', () => {
      expect(appLogs.getLogLevel('{"level":50,"msg":"fail"}')).toBe('error');
      expect(appLogs.getLogLevel('{"level": 60}')).toBe('error');
      expect(appLogs.getLogLevel('{"level":40}')).toBe('warn');
      expect(appLogs.getLogLevel('{"level":30}')).toBe('info');
      expect(appLogs.getLogLevel('{"level":20}')).toBe('debug');
    });

    it('fallback: treats line containing word "error" as error level', () => {
      expect(appLogs.getLogLevel('Error: connection refused')).toBe('error');
      expect(appLogs.getLogLevel('Something went wrong: Error: timeout')).toBe('error');
      expect(appLogs.getLogLevel('exception: Error: Application not found')).toBe('error');
    });

    it('returns null for line with no parseable level and no error word', () => {
      expect(appLogs.getLogLevel('plain text')).toBeNull();
      expect(appLogs.getLogLevel('')).toBeNull();
      expect(appLogs.getLogLevel('GET /health 200')).toBeNull();
      expect(appLogs.getLogLevel('  at foo (bar.js:10)')).toBeNull();
    });
  });

  describe('passesLevelFilter', () => {
    it('returns true when minLevel is null or undefined', () => {
      expect(appLogs.passesLevelFilter('info', null)).toBe(true);
      expect(appLogs.passesLevelFilter('error', undefined)).toBe(true);
    });

    it('filter error: only error passes', () => {
      expect(appLogs.passesLevelFilter('error', 'error')).toBe(true);
      expect(appLogs.passesLevelFilter('warn', 'error')).toBe(false);
      expect(appLogs.passesLevelFilter('info', 'error')).toBe(false);
      expect(appLogs.passesLevelFilter('debug', 'error')).toBe(false);
    });

    it('filter info: info, warn, error pass; debug does not', () => {
      expect(appLogs.passesLevelFilter('info', 'info')).toBe(true);
      expect(appLogs.passesLevelFilter('warn', 'info')).toBe(true);
      expect(appLogs.passesLevelFilter('error', 'info')).toBe(true);
      expect(appLogs.passesLevelFilter('debug', 'info')).toBe(false);
    });

    it('filter debug: all levels pass', () => {
      expect(appLogs.passesLevelFilter('debug', 'debug')).toBe(true);
      expect(appLogs.passesLevelFilter('info', 'debug')).toBe(true);
    });

    it('treats null lineLevel as info when filter is set', () => {
      expect(appLogs.passesLevelFilter(null, 'info')).toBe(true);
      expect(appLogs.passesLevelFilter(null, 'error')).toBe(false);
    });
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

    it('filters lines by level when level option is set', async() => {
      exec.mockImplementation((cmd) =>
        Promise.resolve({
          stdout: cmd.includes('env') ? 'NODE_ENV=dev\n' : '',
          stderr: ''
        })
      );
      const written = [];
      jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        written.push(chunk);
        return true;
      });
      const passThrough = new PassThrough();
      const stderrStream = new PassThrough();
      spawn.mockImplementation(() => {
        setImmediate(() => {
          passThrough.write('INFO: ok\n');
          passThrough.write('ERROR: fail\n');
          passThrough.end();
          stderrStream.end();
        });
        let closeCb;
        const onClose = (ev, fn) => {
          if (ev === 'close') {
            closeCb = fn;
            const done = () => {
              if (passThrough.readableEnded && stderrStream.readableEnded) setImmediate(() => closeCb(0));
            };
            passThrough.on('end', done);
            stderrStream.on('end', done);
          }
          return { on: jest.fn() };
        };
        return { stdout: passThrough, stderr: stderrStream, on: onClose };
      });

      await appLogs.runAppLogs('myapp', { follow: false, tail: 100, level: 'error' });

      const out = written.join('');
      expect(out).toContain('ERROR: fail');
      expect(out).not.toContain('INFO: ok');
      process.stdout.write.mockRestore();
    });

    it('shows info and above when level is info', async() => {
      exec.mockImplementation((cmd) =>
        Promise.resolve({
          stdout: cmd.includes('env') ? 'NODE_ENV=dev\n' : '',
          stderr: ''
        })
      );
      const written = [];
      jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        written.push(chunk);
        return true;
      });
      const passThrough = new PassThrough();
      const stderrStream = new PassThrough();
      spawn.mockImplementation(() => {
        setImmediate(() => {
          passThrough.write('INFO: ok\n');
          passThrough.write('ERROR: fail\n');
          passThrough.end();
          stderrStream.end();
        });
        let closeCb;
        const onClose = (ev, fn) => {
          if (ev === 'close') {
            closeCb = fn;
            const done = () => {
              if (passThrough.readableEnded && stderrStream.readableEnded) setImmediate(() => closeCb(0));
            };
            passThrough.on('end', done);
            stderrStream.on('end', done);
          }
          return { on: jest.fn() };
        };
        return { stdout: passThrough, stderr: stderrStream, on: onClose };
      });

      await appLogs.runAppLogs('myapp', { follow: false, tail: 100, level: 'info' });

      const out = written.join('');
      expect(out).toContain('INFO: ok');
      expect(out).toContain('ERROR: fail');
      process.stdout.write.mockRestore();
    });

    it('throws on invalid level', async() => {
      await expect(
        appLogs.runAppLogs('myapp', { follow: false, tail: 100, level: 'invalid' })
      ).rejects.toThrow('Invalid log level \'invalid\'; use one of: debug, info, warn, error');
    });
  });
});
