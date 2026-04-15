/**
 * Tests for AI Fabrix Builder CLI Utils Module
 *
 * @fileoverview Unit tests for cli-utils.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock logger with plain functions and call arrays (no jest.fn()) to avoid Jest ModuleMocker
// Symbol.hasInstance stack overflow when other suites (e.g. external-system-display) run in the same worker
const loggerCallArrays = { error: [], log: [], warn: [], info: [] };
jest.mock('../../../lib/utils/logger', () => ({
  error: (...args) => {
    loggerCallArrays.error.push(args);
  },
  log: (...args) => {
    loggerCallArrays.log.push(args);
  },
  warn: (...args) => {
    loggerCallArrays.warn.push(args);
  },
  info: (...args) => {
    loggerCallArrays.info.push(args);
  }
}));

/**
 * Coerce logger first arg to string without `String(jest.fn())` — Jest's mock + Symbol.hasInstance can overflow the stack.
 * @param {*} v - First argument passed to logger.*(...)
 * @returns {string}
 */
function loggerArg0ToString(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  return '';
}

// Do not jest.mock('fs') at module scope: Jest's mock + instanceof can recurse infinitely
// (Symbol.hasInstance stack overflow) when this file shares a worker with other suites.
// appendWizardError tests spy on fs.promises only inside their describe block.

const logger = require('../../../lib/utils/logger');
const {
  validateCommand,
  handleCommandError,
  isAuthenticationError,
  appendWizardError,
  logOfflinePathWhenType
} = require('../../../lib/utils/cli-utils');

describe('CLI Utils Module', () => {
  beforeEach(() => {
    loggerCallArrays.error.length = 0;
    loggerCallArrays.log.length = 0;
    loggerCallArrays.warn.length = 0;
    loggerCallArrays.info.length = 0;
    // Re-apply plain logger implementation so SUT uses our call arrays when this
    // suite runs in the same worker as a file that mocks logger with jest.fn()
    logger.error = (...args) => {
      loggerCallArrays.error.push(args);
    };
    logger.log = (...args) => {
      loggerCallArrays.log.push(args);
    };
    logger.warn = (...args) => {
      loggerCallArrays.warn.push(args);
    };
    logger.info = (...args) => {
      loggerCallArrays.info.push(args);
    };
  });

  describe('validateCommand', () => {
    it('should return true for any command (placeholder implementation)', () => {
      expect(validateCommand('test-command', {})).toBe(true);
      expect(validateCommand('build', { app: 'myapp' })).toBe(true);
    });
  });

  describe('isAuthenticationError', () => {
    it('should return false for null or undefined', () => {
      expect(isAuthenticationError(null)).toBe(false);
      expect(isAuthenticationError(undefined)).toBe(false);
    });

    it('should return true when error.authFailure is true', () => {
      const err = new Error('No valid authentication found');
      err.authFailure = true;
      err.controllerUrl = 'http://localhost:3100';
      expect(isAuthenticationError(err)).toBe(true);
    });

    it('should return true when message contains 401', () => {
      expect(isAuthenticationError(new Error('Request failed with status 401'))).toBe(true);
    });

    it('should return true when message contains unauthorized', () => {
      expect(isAuthenticationError(new Error('Unauthorized'))).toBe(true);
      expect(isAuthenticationError(new Error('unauthorized access'))).toBe(true);
    });

    it('should return true when message contains authentication', () => {
      expect(isAuthenticationError(new Error('Authentication failed'))).toBe(true);
      expect(isAuthenticationError(new Error('Authentication required'))).toBe(true);
    });

    it('should return true when message contains token expired', () => {
      expect(isAuthenticationError(new Error('Token expired'))).toBe(true);
    });

    it('should return true when message contains login required', () => {
      expect(isAuthenticationError(new Error('Login required'))).toBe(true);
    });

    it('should return true when message contains device token or refresh token', () => {
      expect(isAuthenticationError(new Error('Device token authentication required'))).toBe(true);
      expect(isAuthenticationError(new Error('Refresh token has expired'))).toBe(true);
    });

    it('should return true when error.formatted contains auth hint', () => {
      const err = new Error('Request failed');
      err.formatted = 'To authenticate, run: aifabrix login';
      expect(isAuthenticationError(err)).toBe(true);
    });

    it('should return false for non-auth errors', () => {
      expect(isAuthenticationError(new Error('Configuration not found'))).toBe(false);
      expect(isAuthenticationError(new Error('Port 3000 is in use'))).toBe(false);
      expect(isAuthenticationError(new Error('Validation failed'))).toBe(false);
    });
  });

  describe('handleCommandError', () => {
    it('should handle formatted errors', () => {
      const error = new Error('Test error');
      error.formatted = 'Formatted\nError\nMessage';

      handleCommandError(error, 'test-command');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in test-command command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Formatted')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Error')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Message')).toBe(true);
      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('doctor'))).toBe(true);
    });

    it('should handle configuration not found errors', () => {
      const error = new Error('Configuration not found');

      handleCommandError(error, 'build');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in build command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Configuration not found')).toBe(true);
    });

    it('should handle schema validation errors', () => {
      const error = new Error('Field "app.key" does not match schema');

      handleCommandError(error, 'validate');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in validate command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('does not match schema'))).toBe(true);
    });

    it('should handle Docker image not found errors', () => {
      const error = new Error('Docker image myapp:latest not found locally');

      handleCommandError(error, 'run');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in run command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Docker image not found.')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Run: aifabrix build <app> first')).toBe(true);
    });

    it('should preserve template-app hint when Docker image not found (up-miso/up-dataplane)', () => {
      const error = new Error(
        'Docker image aifabrix/keycloak:latest not found\nPull the image (e.g. docker pull aifabrix/keycloak:latest) or use --image keycloak=<image> for up-miso/up-dataplane.'
      );

      handleCommandError(error, 'up-miso');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in up-miso command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Docker image aifabrix/keycloak:latest not found')).toBe(true);
      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Pull the image'))).toBe(true);
      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('use --image keycloak='))).toBe(true);
    });

    it('should handle Docker not running errors', () => {
      const { getDockerDaemonStartHintSentence } = require('../../../lib/utils/docker-not-running-hint');
      const error = new Error('Docker is not running');

      handleCommandError(error, 'build');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in build command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Docker is not running or not installed.')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === `   ${getDockerDaemonStartHintSentence()}`)).toBe(true);
      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('docker-endpoint'))).toBe(true);
    });

    it('should handle port conflict errors', () => {
      const error = new Error('Port 3000 is already in use');

      handleCommandError(error, 'run');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in run command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Port conflict detected.')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Run "aifabrix doctor" to check which ports are in use.')).toBe(true);
    });

    it('should handle API permission denied errors with hint', () => {
      const error = new Error('Permission denied: /path/to/file');

      handleCommandError(error, 'build');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in build command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Permission denied: /path/to/file')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Ensure your token has the required permission (e.g. external-system:delete for delete).')).toBe(true);
    });

    it('should handle Docker permission denied errors', () => {
      const error = new Error('Got permission denied while trying to connect to the Docker daemon socket');

      handleCommandError(error, 'run');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in run command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Permission denied when using Docker'))).toBe(true);
      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('docker-endpoint'))).toBe(true);
    });

    it('should not label plain EACCES mkdir as Docker or API token (local filesystem path)', () => {
      const error = new Error('EACCES: permission denied, mkdir \'/aifabrix-miso\'');

      handleCommandError(error, 'secret set');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Permission denied when using Docker'))).toBe(false);
      expect(
        loggerCallArrays.error.some(
          (a) =>
            loggerArg0ToString(a[0]).includes('Ensure your token has the required permission') &&
            loggerArg0ToString(a[0]).includes('external-system:delete')
        )
      ).toBe(false);
      expect(
        loggerCallArrays.error.some((a) =>
          loggerArg0ToString(a[0]).includes('local filesystem path or permissions issue')
        )
      ).toBe(true);
    });

    it('should append docker-endpoint hints to infrastructure Docker failure message', () => {
      const error = new Error(
        'Cannot use Docker for infrastructure: Docker Compose check failed (see Cause below).\n\nCause: x'
      );

      handleCommandError(error, 'up-infra');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('up-infra'))).toBe(true);
      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Cannot use Docker for infrastructure'))).toBe(true);
      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('docker-endpoint'))).toBe(true);
    });

    it('should not match permission denied for permissions field validation', () => {
      const error = new Error('Field "permissions" is required');

      handleCommandError(error, 'validate');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in validate command'))).toBe(true);
      // Should not show permission denied message
      expect(loggerCallArrays.error.some(a => a[0] === '   Permission denied.')).toBe(false);
    });

    it('should handle Azure CLI errors', () => {
      const error = new Error('Azure CLI is not installed');

      handleCommandError(error, 'push');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in push command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Azure CLI is not installed or not working properly.')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Install from: https://docs.microsoft.com/cli/azure/install-azure-cli')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Run: az login')).toBe(true);
    });

    it('should not misclassify Docker/build failures that happen to contain substring "az" as Azure CLI', () => {
      const error = new Error(
        'Build failed: Docker build failed: lazy evaluation in build step failed'
      );

      handleCommandError(error, 'build');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in build command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Azure CLI is not installed or not working properly.')).toBe(false);
    });

    it('should handle ACR authentication errors', () => {
      const error = new Error('ACR authentication required');

      handleCommandError(error, 'push');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in push command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Azure Container Registry authentication failed.')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Run: az acr login --name <registry-name>')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Or login to Azure: az login')).toBe(true);
    });

    it('should handle invalid ACR URL errors', () => {
      const error = new Error('Invalid ACR URL format');

      handleCommandError(error, 'push');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in push command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Invalid registry URL format.')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Use format: *.azurecr.io (e.g., myacr.azurecr.io)')).toBe(true);
    });

    it('should handle missing registry URL errors', () => {
      const error = new Error('Registry URL is required');

      handleCommandError(error, 'push');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in push command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Registry URL is required.')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Provide via --registry flag or configure in application.yaml under image.registry')).toBe(true);
    });

    it('should handle missing secrets errors with app name', () => {
      const error = new Error('Missing secrets: DATABASE_PASSWORD, API_KEY\nSecrets file location: /path/to/secrets.yaml\nRun "aifabrix resolve myapp"');

      handleCommandError(error, 'resolve');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in resolve command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Missing secrets: DATABASE_PASSWORD, API_KEY')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Secrets file location: /path/to/secrets.yaml')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Run: aifabrix resolve myapp to generate missing secrets.')).toBe(true);
    });

    it('should handle missing secrets errors without app name', () => {
      const error = new Error('Missing secrets in secrets file');

      handleCommandError(error, 'resolve');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in resolve command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Missing secrets in secrets file.')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Run: aifabrix resolve <app-name> to generate missing secrets.')).toBe(true);
    });

    it('should handle deployment retry errors', () => {
      const error = new Error('Deployment failed after 3 attempts: Connection timeout');

      handleCommandError(error, 'deploy');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in deploy command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Connection timeout')).toBe(true);
    });

    it('should handle generic errors', () => {
      const error = new Error('Generic error message');

      handleCommandError(error, 'test-command');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in test-command command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Generic error message')).toBe(true);
      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('doctor'))).toBe(true);
    });

    it('should handle errors without message', () => {
      const error = new Error();

      handleCommandError(error, 'test-command');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in test-command command'))).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   ')).toBe(true);
    });

    it('should handle formatted errors with empty lines', () => {
      const error = new Error('Test');
      error.formatted = 'Line 1\n\nLine 2\n   \nLine 3';

      handleCommandError(error, 'test-command');

      // Should skip empty lines
      expect(loggerCallArrays.error.some(a => a[0] === '   Line 1')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Line 2')).toBe(true);
      expect(loggerCallArrays.error.some(a => a[0] === '   Line 3')).toBe(true);
    });

    it('should always show doctor command suggestion', () => {
      const error = new Error('Any error');

      handleCommandError(error, 'any-command');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('doctor'))).toBe(true);
    });

    it('should log wizardResumeMessage when present on error', () => {
      const error = new Error('Wizard failed');
      error.wizardResumeMessage = 'To resume: aifabrix wizard myapp';

      handleCommandError(error, 'wizard');

      expect(loggerCallArrays.error.some(a => loggerArg0ToString(a[0]).includes('Error in wizard command'))).toBe(true);
      // Use a safe check (loop + String) to avoid Symbol.hasInstance stack overflow when
      // this suite runs in the same worker as a file that mocks logger with jest.fn()
      let hasResumeMessage = false;
      const logArr = loggerCallArrays.log;
      for (let i = 0; i < logArr.length; i++) {
        try {
          const a = logArr[i];
          const first = (a !== null && a !== undefined) && a[0];
          if (loggerArg0ToString(first) === 'To resume: aifabrix wizard myapp') {
            hasResumeMessage = true;
            break;
          }
        } catch (_) { /* ignore */ }
      }
      expect(hasResumeMessage).toBe(true);
    });
  });

  describe('appendWizardError', () => {
    const fs = require('fs');
    let mkdirSpy;
    let appendFileSpy;
    const mkdirCalls = [];
    const appendFileCalls = [];
    let mkdirReject = false;

    beforeEach(() => {
      mkdirCalls.length = 0;
      appendFileCalls.length = 0;
      mkdirReject = false;
      mkdirSpy = jest.spyOn(fs.promises, 'mkdir').mockImplementation((p, opts) => {
        mkdirCalls.push([p, opts]);
        if (mkdirReject) return Promise.reject(new Error('Permission denied'));
        return Promise.resolve();
      });
      appendFileSpy = jest.spyOn(fs.promises, 'appendFile').mockImplementation((p, data, enc) => {
        appendFileCalls.push([p, data, enc]);
        return Promise.resolve();
      });
    });

    afterEach(() => {
      mkdirSpy.mockRestore();
      appendFileSpy.mockRestore();
    });

    it('should append error message to integration/<systemKey>/error.log', async() => {
      await appendWizardError('myapp', new Error('Test error'));

      expect(mkdirCalls).toHaveLength(1);
      expect(mkdirCalls[0][0]).toMatch(/integration[\\/]myapp$/);
      expect(mkdirCalls[0][1]).toEqual({ recursive: true });
      expect(appendFileCalls).toHaveLength(1);
      expect(appendFileCalls[0][0]).toMatch(/integration[\\/]myapp[\\/]error\.log$/);
      expect(appendFileCalls[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}T.* Test error\n$/);
      expect(appendFileCalls[0][2]).toBe('utf8');
    });

    it('should write stripped error.formatted to error.log when formatted is longer than message', async() => {
      const err = new Error('Short');
      err.formatted = '\x1b[31mLong validation message with details and field list\x1b[0m';

      await appendWizardError('myapp', err);

      const written = appendFileCalls[0][1];
      expect(written).toContain('Long validation message with details and field list');
      expect(written).not.toContain('\x1b[');
    });

    it('should write error.message when error.formatted is absent', async() => {
      await appendWizardError('myapp', new Error('Only message'));

      const written = appendFileCalls[0][1];
      expect(written).toContain('Only message');
    });

    it('should write error.message when error.formatted is shorter than message', async() => {
      const err = new Error('Long error message here');
      err.formatted = '\x1b[31mShort\x1b[0m';

      await appendWizardError('myapp', err);

      const written = appendFileCalls[0][1];
      expect(written).toContain('Long error message here');
    });

    it('should no-op when appKey is empty or invalid', async() => {
      await appendWizardError('', new Error('x'));
      await appendWizardError('UPPERCASE', new Error('x'));

      expect(mkdirCalls).toHaveLength(0);
      expect(appendFileCalls).toHaveLength(0);
    });

    it('should not throw when fs fails', async() => {
      mkdirReject = true;

      await appendWizardError('myapp', new Error('x'));

      expect(loggerCallArrays.warn.some(a => loggerArg0ToString(a[0]).includes('Could not write wizard error.log'))).toBe(true);
    });
  });

  describe('logOfflinePathWhenType', () => {
    const path = require('path');
    let origRelative;
    beforeEach(() => {
      origRelative = path.relative.bind(path);
      jest.spyOn(path, 'relative').mockImplementation((cwd, p) => {
        if (typeof p === 'string' && p.includes('integration') && p.includes('hubspot-test')) return 'integration/hubspot-test';
        if (typeof p === 'string' && p.includes('builder') && p.includes('myapp')) return 'bar/builder/myapp';
        return origRelative(cwd, p);
      });
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log "Using: <path>" when options.type is "app"', () => {
      logOfflinePathWhenType('/foo/bar/builder/myapp', { type: 'app' });
      expect(loggerCallArrays.log.some(a => loggerArg0ToString(a[0]).includes('Using:'))).toBe(true);
      expect(loggerCallArrays.log.some(a => /builder[/\\]myapp/.test(loggerArg0ToString(a[0])))).toBe(true);
    });

    it('should log "Using: <path>" when options.type is "external"', () => {
      logOfflinePathWhenType('/foo/integration/hubspot-test', { type: 'external' });
      expect(loggerCallArrays.log.some(a => loggerArg0ToString(a[0]).includes('Using:'))).toBe(true);
      expect(loggerCallArrays.log.some(a => /integration[/\\]hubspot/.test(loggerArg0ToString(a[0])))).toBe(true);
    });

    it('should not log when options is missing', () => {
      loggerCallArrays.log.length = 0;
      logOfflinePathWhenType('/foo/builder/myapp', undefined);
      expect(loggerCallArrays.log.some(a => loggerArg0ToString(a[0]).includes('Using:'))).toBe(false);
    });

    it('should not log when options.type is not "app" or "external"', () => {
      loggerCallArrays.log.length = 0;
      logOfflinePathWhenType('/foo/builder/myapp', {});
      logOfflinePathWhenType('/foo/builder/myapp', { type: 'other' });
      const calls = loggerCallArrays.log.map(c => c[0]);
      const usingCalls = calls.filter(m => typeof m === 'string' && m.includes('Using:'));
      expect(usingCalls).toHaveLength(0);
    });

    it('should not log when appPath is falsy', () => {
      loggerCallArrays.log.length = 0;
      logOfflinePathWhenType(null, { type: 'app' });
      logOfflinePathWhenType(undefined, { type: 'external' });
      logOfflinePathWhenType('', { type: 'app' });
      const calls = loggerCallArrays.log.map(c => c[0]);
      const usingCalls = calls.filter(m => typeof m === 'string' && m.includes('Using:'));
      expect(usingCalls).toHaveLength(0);
    });
  });
});

