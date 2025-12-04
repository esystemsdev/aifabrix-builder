/**
 * Tests for AI Fabrix Builder CLI Utils Module
 *
 * @fileoverview Unit tests for cli-utils.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/logger', () => ({
  error: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { validateCommand, handleCommandError } = require('../../../lib/utils/cli-utils');

describe('CLI Utils Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCommand', () => {
    it('should return true for any command (placeholder implementation)', () => {
      expect(validateCommand('test-command', {})).toBe(true);
      expect(validateCommand('build', { app: 'myapp' })).toBe(true);
    });
  });

  describe('handleCommandError', () => {
    it('should handle formatted errors', () => {
      const error = new Error('Test error');
      error.formatted = 'Formatted\nError\nMessage';

      handleCommandError(error, 'test-command');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in test-command command'));
      expect(logger.error).toHaveBeenCalledWith('   Formatted');
      expect(logger.error).toHaveBeenCalledWith('   Error');
      expect(logger.error).toHaveBeenCalledWith('   Message');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('doctor'));
    });

    it('should handle configuration not found errors', () => {
      const error = new Error('Configuration not found');

      handleCommandError(error, 'build');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in build command'));
      expect(logger.error).toHaveBeenCalledWith('   Configuration not found');
    });

    it('should handle schema validation errors', () => {
      const error = new Error('Field "app.key" does not match schema');

      handleCommandError(error, 'validate');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in validate command'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('does not match schema'));
    });

    it('should handle Docker image not found errors', () => {
      const error = new Error('Docker image myapp:latest not found locally');

      handleCommandError(error, 'run');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in run command'));
      expect(logger.error).toHaveBeenCalledWith('   Docker image not found.');
      expect(logger.error).toHaveBeenCalledWith('   Run: aifabrix build <app> first');
    });

    it('should handle Docker not running errors', () => {
      const error = new Error('Docker is not running');

      handleCommandError(error, 'build');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in build command'));
      expect(logger.error).toHaveBeenCalledWith('   Docker is not running or not installed.');
      expect(logger.error).toHaveBeenCalledWith('   Please start Docker Desktop and try again.');
    });

    it('should handle port conflict errors', () => {
      const error = new Error('Port 3000 is already in use');

      handleCommandError(error, 'run');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in run command'));
      expect(logger.error).toHaveBeenCalledWith('   Port conflict detected.');
      expect(logger.error).toHaveBeenCalledWith('   Run "aifabrix doctor" to check which ports are in use.');
    });

    it('should handle permission denied errors', () => {
      const error = new Error('Permission denied: /path/to/file');

      handleCommandError(error, 'build');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in build command'));
      expect(logger.error).toHaveBeenCalledWith('   Permission denied.');
      expect(logger.error).toHaveBeenCalledWith('   Make sure you have the necessary permissions to run Docker commands.');
    });

    it('should not match permission denied for permissions field validation', () => {
      const error = new Error('Field "permissions" is required');

      handleCommandError(error, 'validate');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in validate command'));
      // Should not show permission denied message
      expect(logger.error).not.toHaveBeenCalledWith('   Permission denied.');
    });

    it('should handle Azure CLI errors', () => {
      const error = new Error('Azure CLI is not installed');

      handleCommandError(error, 'push');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in push command'));
      expect(logger.error).toHaveBeenCalledWith('   Azure CLI is not installed or not working properly.');
      expect(logger.error).toHaveBeenCalledWith('   Install from: https://docs.microsoft.com/cli/azure/install-azure-cli');
      expect(logger.error).toHaveBeenCalledWith('   Run: az login');
    });

    it('should handle ACR authentication errors', () => {
      const error = new Error('ACR authentication required');

      handleCommandError(error, 'push');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in push command'));
      expect(logger.error).toHaveBeenCalledWith('   Azure Container Registry authentication failed.');
      expect(logger.error).toHaveBeenCalledWith('   Run: az acr login --name <registry-name>');
      expect(logger.error).toHaveBeenCalledWith('   Or login to Azure: az login');
    });

    it('should handle invalid ACR URL errors', () => {
      const error = new Error('Invalid ACR URL format');

      handleCommandError(error, 'push');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in push command'));
      expect(logger.error).toHaveBeenCalledWith('   Invalid registry URL format.');
      expect(logger.error).toHaveBeenCalledWith('   Use format: *.azurecr.io (e.g., myacr.azurecr.io)');
    });

    it('should handle missing registry URL errors', () => {
      const error = new Error('Registry URL is required');

      handleCommandError(error, 'push');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in push command'));
      expect(logger.error).toHaveBeenCalledWith('   Registry URL is required.');
      expect(logger.error).toHaveBeenCalledWith('   Provide via --registry flag or configure in variables.yaml under image.registry');
    });

    it('should handle missing secrets errors with app name', () => {
      const error = new Error('Missing secrets: DATABASE_PASSWORD, API_KEY\nSecrets file location: /path/to/secrets.yaml\nRun "aifabrix resolve myapp"');

      handleCommandError(error, 'resolve');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in resolve command'));
      expect(logger.error).toHaveBeenCalledWith('   Missing secrets: DATABASE_PASSWORD, API_KEY');
      expect(logger.error).toHaveBeenCalledWith('   Secrets file location: /path/to/secrets.yaml');
      expect(logger.error).toHaveBeenCalledWith('   Run: aifabrix resolve myapp to generate missing secrets.');
    });

    it('should handle missing secrets errors without app name', () => {
      const error = new Error('Missing secrets in secrets file');

      handleCommandError(error, 'resolve');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in resolve command'));
      expect(logger.error).toHaveBeenCalledWith('   Missing secrets in secrets file.');
      expect(logger.error).toHaveBeenCalledWith('   Run: aifabrix resolve <app-name> to generate missing secrets.');
    });

    it('should handle deployment retry errors', () => {
      const error = new Error('Deployment failed after 3 attempts: Connection timeout');

      handleCommandError(error, 'deploy');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in deploy command'));
      expect(logger.error).toHaveBeenCalledWith('   Connection timeout');
    });

    it('should handle generic errors', () => {
      const error = new Error('Generic error message');

      handleCommandError(error, 'test-command');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in test-command command'));
      expect(logger.error).toHaveBeenCalledWith('   Generic error message');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('doctor'));
    });

    it('should handle errors without message', () => {
      const error = new Error();

      handleCommandError(error, 'test-command');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in test-command command'));
      expect(logger.error).toHaveBeenCalledWith('   ');
    });

    it('should handle formatted errors with empty lines', () => {
      const error = new Error('Test');
      error.formatted = 'Line 1\n\nLine 2\n   \nLine 3';

      handleCommandError(error, 'test-command');

      // Should skip empty lines
      expect(logger.error).toHaveBeenCalledWith('   Line 1');
      expect(logger.error).toHaveBeenCalledWith('   Line 2');
      expect(logger.error).toHaveBeenCalledWith('   Line 3');
    });

    it('should always show doctor command suggestion', () => {
      const error = new Error('Any error');

      handleCommandError(error, 'any-command');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('doctor'));
    });
  });
});

