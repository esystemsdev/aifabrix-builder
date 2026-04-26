/**
 * Tests for AI Fabrix Builder CLI Error Handling
 *
 * @fileoverview Unit tests for CLI error handling functionality
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock modules
jest.mock('fs');
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/test'),
  tmpdir: jest.fn(() => '/tmp'),
  platform: jest.fn(() => 'linux'),
  arch: jest.fn(() => 'x64'),
  EOL: '\n'
}));
jest.mock('child_process');
jest.mock('net');

// Mock problematic dependencies
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
  createPromptModule: jest.fn(() => ({
    prompt: jest.fn()
  }))
}));

jest.mock('chalk', () => {
  const createMockFn = (text) => text;
  const mockChalk = createMockFn;
  ['blue', 'green', 'red', 'yellow', 'cyan', 'magenta', 'white', 'gray',
    'bold', 'dim', 'italic', 'underline', 'strikethrough', 'reset', 'inverse',
    'black', 'redBright', 'greenBright', 'yellowBright', 'blueBright',
    'magentaBright', 'cyanBright', 'whiteBright', 'bgBlack', 'bgRed', 'bgGreen',
    'bgYellow', 'bgBlue', 'bgMagenta', 'bgCyan', 'bgWhite', 'bgBlackBright',
    'bgRedBright', 'bgGreenBright', 'bgYellowBright', 'bgBlueBright',
    'bgMagentaBright', 'bgCyanBright', 'bgWhiteBright'].forEach(prop => {
    mockChalk[prop] = createMockFn;
  });
  return mockChalk;
});

// Mock other chalk-dependent packages
jest.mock('log-symbols', () => ({
  success: '✔',
  error: '✖',
  warning: '⚠',
  info: 'ℹ'
}));

jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis()
  }));
});

// Mock the lib modules
jest.mock('../../lib/core/secrets');
jest.mock('../../lib/generator');
jest.mock('../../lib/core/key-generator');
jest.mock('../../lib/validation/validator');
jest.mock('../../lib/infrastructure');
jest.mock('../../lib/app');
jest.mock('../../lib/build');

const { handleCommandError, validateCommand } = require('../../lib/utils/cli-utils');

describe('CLI Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock environment variables to prevent supports-color issues
    process.env.FORCE_COLOR = '0';
    process.env.NO_COLOR = '1';
    process.env.TERM = 'dumb';

    // Mock console methods to capture output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error handling', () => {
    it('should handle command errors with helpful messages', () => {
      const { getDockerDaemonStartHintSentence, getDockerApiOverTcpHintLines } = require('../../lib/utils/docker-not-running-hint');

      // Test the handleCommandError function (cli-utils avoids loading full lib/cli)
      const error = new Error('Docker is not running');
      const command = 'build';

      handleCommandError(error, command);

      expect(console.error).toHaveBeenCalledWith('\n✖ Error in build command:');
      expect(console.error).toHaveBeenCalledWith('   Docker is not running or not installed.');
      expect(console.error).toHaveBeenCalledWith(`   ${getDockerDaemonStartHintSentence()}`);
      for (const line of getDockerApiOverTcpHintLines()) {
        expect(console.error).toHaveBeenCalledWith(line);
      }
      expect(console.error).toHaveBeenCalledWith('\n💡 Run "aifabrix doctor" for environment diagnostics.\n');
    });

    it('should handle port conflict errors', () => {
      const error = new Error('port 5432 is already in use');
      const command = 'up-infra';

      handleCommandError(error, command);

      expect(console.error).toHaveBeenCalledWith('\n✖ Error in up-infra command:');
      expect(console.error).toHaveBeenCalledWith('   Port conflict detected.');
      expect(console.error).toHaveBeenCalledWith('   Run "aifabrix doctor" to check which ports are in use.');
    });

    it('should handle API permission errors with hint', () => {
      const error = new Error('permission denied');
      const command = 'build';

      handleCommandError(error, command);

      expect(console.error).toHaveBeenCalledWith('\n✖ Error in build command:');
      expect(console.error).toHaveBeenCalledWith('   permission denied');
      expect(console.error).toHaveBeenCalledWith('   Ensure your token has the required permission (e.g. external-system:delete for delete).');
    });

    it('should handle Docker permission denied errors', () => {
      const { getDockerApiOverTcpHintLines } = require('../../lib/utils/docker-not-running-hint');

      const error = new Error('Got permission denied while trying to connect to the Docker daemon socket');
      const command = 'run';

      handleCommandError(error, command);

      expect(console.error).toHaveBeenCalledWith('\n✖ Error in run command:');
      expect(console.error).toHaveBeenCalledWith(
        '   Permission denied when using Docker (e.g. unix socket).'
      );
      expect(console.error).toHaveBeenCalledWith(
        '   On Linux you can add your user to the "docker" group and log in again, or use the Engine API via docker-endpoint:'
      );
      for (const line of getDockerApiOverTcpHintLines()) {
        expect(console.error).toHaveBeenCalledWith(line);
      }
    });

    it('should handle Azure CLI errors', () => {
      const error = new Error('Azure CLI is not installed');
      const command = 'push';

      handleCommandError(error, command);

      expect(console.error).toHaveBeenCalledWith('\n✖ Error in push command:');
      expect(console.error).toHaveBeenCalledWith('   Azure CLI is not installed or not working properly.');
    });

    it('should handle ACR authentication errors', () => {
      const error = new Error('ACR authentication failed');
      const command = 'push';

      handleCommandError(error, command);

      expect(console.error).toHaveBeenCalledWith('   Azure Container Registry authentication failed.');
      expect(console.error).toHaveBeenCalledWith('   Run: az acr login --name <registry-name>');
    });

    it('should handle image not found errors', () => {
      const error = new Error('image not found locally');
      const command = 'run';

      handleCommandError(error, command);

      expect(console.error).toHaveBeenCalledWith('   Docker image not found.');
      expect(console.error).toHaveBeenCalledWith('   Run: aifabrix build <app> first');
    });

    it('should handle invalid registry URL errors', () => {
      const error = new Error('Expected format: *.azurecr.io');
      const command = 'push';

      handleCommandError(error, command);

      expect(console.error).toHaveBeenCalledWith('   Invalid registry URL format.');
      expect(console.error).toHaveBeenCalledWith('   Use format: *.azurecr.io (e.g., myacr.azurecr.io)');
    });

    it('should handle registry URL required errors', () => {
      const error = new Error('Registry URL is required');
      const command = 'push';

      handleCommandError(error, command);

      expect(console.error).toHaveBeenCalledWith('   Registry URL is required.');
      expect(console.error).toHaveBeenCalledWith('   Provide via --registry flag or configure in application.yaml under image.registry');
    });

    it('should handle generic errors', () => {
      const error = new Error('Something went wrong');
      const command = 'deploy';

      handleCommandError(error, command);

      expect(console.error).toHaveBeenCalledWith('\n✖ Error in deploy command:');
      expect(console.error).toHaveBeenCalledWith('   Something went wrong');
    });
  });

  describe('Command validation', () => {
    it('should validate command arguments', () => {
      const result = validateCommand('build', {});
      expect(result).toBe(true);
    });
  });
});
