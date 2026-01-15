/**
 * Tests for Login Credentials Module
 *
 * @fileoverview Unit tests for lib/commands/login-credentials.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock API modules
jest.mock('../../../lib/api/auth.api', () => ({
  getToken: jest.fn()
}));

jest.mock('../../../lib/utils/api-error-handler', () => ({
  formatApiError: jest.fn((response) => `Formatted error: ${response.error || 'Unknown error'}`)
}));

jest.mock('../../../lib/utils/token-manager', () => ({
  loadClientCredentials: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const inquirer = require('inquirer');
const { getToken } = require('../../../lib/api/auth.api');
const { formatApiError } = require('../../../lib/utils/api-error-handler');
const { loadClientCredentials } = require('../../../lib/utils/token-manager');
const {
  handleCredentialsLogin,
  getCredentialsForLogin,
  promptForCredentials,
  tryLoadCredentialsFromSecrets
} = require('../../../lib/commands/login-credentials');

describe('Login Credentials Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('tryLoadCredentialsFromSecrets', () => {
    it('should return null if appName is not provided', async() => {
      const result = await tryLoadCredentialsFromSecrets(null);

      expect(result).toBeNull();
      expect(loadClientCredentials).not.toHaveBeenCalled();
    });

    it('should return credentials if found in secrets', async() => {
      const credentials = { clientId: 'test-id', clientSecret: 'test-secret' };
      loadClientCredentials.mockResolvedValue(credentials);

      const result = await tryLoadCredentialsFromSecrets('test-app');

      expect(result).toEqual(credentials);
      expect(loadClientCredentials).toHaveBeenCalledWith('test-app');
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('should log warning and return null if credentials not found', async() => {
      loadClientCredentials.mockResolvedValue(null);

      const result = await tryLoadCredentialsFromSecrets('test-app');

      expect(result).toBeNull();
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('⚠️  Credentials not found'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('test-app-client-idKeyVault'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('test-app-client-secretKeyVault'));
    });
  });

  describe('promptForCredentials', () => {
    it('should return credentials if both provided', async() => {
      const result = await promptForCredentials('test-id', 'test-secret');

      expect(result).toEqual({ clientId: 'test-id', clientSecret: 'test-secret' });
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should trim credentials if provided', async() => {
      const result = await promptForCredentials('  test-id  ', '  test-secret  ');

      expect(result).toEqual({ clientId: 'test-id', clientSecret: 'test-secret' });
    });

    it('should prompt for credentials if not provided', async() => {
      inquirer.prompt.mockResolvedValue({
        clientId: 'prompted-id',
        clientSecret: 'prompted-secret'
      });

      const result = await promptForCredentials();

      expect(result).toEqual({ clientId: 'prompted-id', clientSecret: 'prompted-secret' });
      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should use default values when prompting', async() => {
      inquirer.prompt.mockResolvedValue({
        clientId: 'prompted-id',
        clientSecret: 'prompted-secret'
      });

      // Call with only one parameter to trigger prompting
      await promptForCredentials('default-id');

      expect(inquirer.prompt).toHaveBeenCalled();
      const promptCall = inquirer.prompt.mock.calls[0];
      expect(promptCall).toBeDefined();
      expect(promptCall[0]).toBeDefined();
      expect(Array.isArray(promptCall[0])).toBe(true);
      expect(promptCall[0][0].default).toBe('default-id');
      expect(promptCall[0][1].default).toBe('');
    });

    it('should validate client ID is required', async() => {
      inquirer.prompt.mockResolvedValue({
        clientId: 'valid-id',
        clientSecret: 'valid-secret'
      });

      await promptForCredentials();

      const promptCall = inquirer.prompt.mock.calls[0][0];
      const clientIdValidator = promptCall[0].validate;
      expect(clientIdValidator('')).toBe('Client ID is required');
      expect(clientIdValidator('   ')).toBe('Client ID is required');
      expect(clientIdValidator('valid')).toBe(true);
    });

    it('should validate client secret is required', async() => {
      inquirer.prompt.mockResolvedValue({
        clientId: 'valid-id',
        clientSecret: 'valid-secret'
      });

      await promptForCredentials();

      const promptCall = inquirer.prompt.mock.calls[0][0];
      const clientSecretValidator = promptCall[1].validate;
      expect(clientSecretValidator('')).toBe('Client Secret is required');
      expect(clientSecretValidator('   ')).toBe('Client Secret is required');
      expect(clientSecretValidator('valid')).toBe(true);
    });
  });

  describe('getCredentialsForLogin', () => {
    it('should load from secrets if appName provided and credentials not provided', async() => {
      const credentials = { clientId: 'secret-id', clientSecret: 'secret-secret' };
      loadClientCredentials.mockResolvedValue(credentials);

      const result = await getCredentialsForLogin('test-app');

      expect(result).toEqual(credentials);
      expect(loadClientCredentials).toHaveBeenCalledWith('test-app');
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should prompt if credentials not in secrets', async() => {
      loadClientCredentials.mockResolvedValue(null);
      inquirer.prompt.mockResolvedValue({
        clientId: 'prompted-id',
        clientSecret: 'prompted-secret'
      });

      const result = await getCredentialsForLogin('test-app');

      expect(result).toEqual({ clientId: 'prompted-id', clientSecret: 'prompted-secret' });
      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should use provided credentials instead of loading from secrets', async() => {
      const result = await getCredentialsForLogin('test-app', 'provided-id', 'provided-secret');

      expect(result).toEqual({ clientId: 'provided-id', clientSecret: 'provided-secret' });
      expect(loadClientCredentials).not.toHaveBeenCalled();
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should prompt if appName not provided', async() => {
      inquirer.prompt.mockResolvedValue({
        clientId: 'prompted-id',
        clientSecret: 'prompted-secret'
      });

      const result = await getCredentialsForLogin(null);

      expect(result).toEqual({ clientId: 'prompted-id', clientSecret: 'prompted-secret' });
      expect(loadClientCredentials).not.toHaveBeenCalled();
    });
  });

  describe('handleCredentialsLogin', () => {
    it('should successfully login with credentials', async() => {
      const credentials = { clientId: 'test-id', clientSecret: 'test-secret' };
      loadClientCredentials.mockResolvedValue(credentials);
      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600,
          expiresAt: '2024-01-01T00:00:00Z'
        }
      });

      const result = await handleCredentialsLogin('http://localhost:3000', 'test-app');

      expect(result).toEqual({
        token: 'test-token',
        expiresAt: '2024-01-01T00:00:00Z'
      });
      expect(getToken).toHaveBeenCalledWith('test-id', 'test-secret', 'http://localhost:3000');
    });

    it('should calculate expiration from expiresIn if expiresAt not provided', async() => {
      const credentials = { clientId: 'test-id', clientSecret: 'test-secret' };
      loadClientCredentials.mockResolvedValue(credentials);
      const mockDate = new Date('2024-01-01T00:00:00Z');
      const mockDateNow = mockDate.getTime();
      const originalDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(mockDateNow);

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600
        }
      });

      const result = await handleCredentialsLogin('http://localhost:3000', 'test-app');

      expect(result.token).toBe('test-token');
      expect(result.expiresAt).toBeDefined();
      expect(new Date(result.expiresAt).getTime()).toBe(mockDateNow + 3600 * 1000);

      Date.now = originalDateNow;
    });

    it('should use default 24 hour expiration if neither expiresAt nor expiresIn provided', async() => {
      const credentials = { clientId: 'test-id', clientSecret: 'test-secret' };
      loadClientCredentials.mockResolvedValue(credentials);
      const mockDate = new Date('2024-01-01T00:00:00Z');
      const mockDateNow = mockDate.getTime();
      const originalDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(mockDateNow);

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token'
        }
      });

      const result = await handleCredentialsLogin('http://localhost:3000', 'test-app');

      expect(result.token).toBe('test-token');
      const expiresAt = new Date(result.expiresAt).getTime();
      const expectedExpiresAt = mockDateNow + 24 * 60 * 60 * 1000;
      expect(expiresAt).toBe(expectedExpiresAt);

      Date.now = originalDateNow;
    });

    it('should handle login failure', async() => {
      const credentials = { clientId: 'test-id', clientSecret: 'test-secret' };
      loadClientCredentials.mockResolvedValue(credentials);
      getToken.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
        status: 401
      });

      await handleCredentialsLogin('http://localhost:3000', 'test-app');

      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle missing token in response', async() => {
      const credentials = { clientId: 'test-id', clientSecret: 'test-secret' };
      loadClientCredentials.mockResolvedValue(credentials);
      getToken.mockResolvedValue({
        success: true,
        data: {}
      });

      await handleCredentialsLogin('http://localhost:3000', 'test-app');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid response: missing token'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle nested data structure', async() => {
      const credentials = { clientId: 'test-id', clientSecret: 'test-secret' };
      loadClientCredentials.mockResolvedValue(credentials);
      getToken.mockResolvedValue({
        success: true,
        data: {
          data: {
            token: 'nested-token',
            expiresAt: '2024-01-01T00:00:00Z'
          }
        }
      });

      const result = await handleCredentialsLogin('http://localhost:3000', 'test-app');

      expect(result.token).toBe('nested-token');
    });

    it('should provide helpful tips on 401 error', async() => {
      const credentials = { clientId: 'test-id', clientSecret: 'test-secret' };
      loadClientCredentials.mockResolvedValue(credentials);
      getToken.mockResolvedValue({
        success: false,
        error: 'Unauthorized',
        status: 401,
        formattedError: 'Authentication failed'
      });

      await handleCredentialsLogin('http://localhost:3000', 'test-app');

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('💡 Tip:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('test-app-client-idKeyVault'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('test-app-client-secretKeyVault'));
    });

    it('should use provided credentials instead of loading from secrets', async() => {
      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresAt: '2024-01-01T00:00:00Z'
        }
      });

      const result = await handleCredentialsLogin('http://localhost:3000', 'test-app', 'provided-id', 'provided-secret');

      expect(result.token).toBe('test-token');
      expect(getToken).toHaveBeenCalledWith('provided-id', 'provided-secret', 'http://localhost:3000');
      expect(loadClientCredentials).not.toHaveBeenCalled();
    });
  });
});

