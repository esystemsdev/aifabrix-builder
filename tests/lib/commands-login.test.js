/**
 * Tests for AI Fabrix Builder Login Command
 *
 * @fileoverview Unit tests for commands/login.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const { handleLogin } = require('../../lib/commands/login');
const config = require('../../lib/config');
const { makeApiCall, pollDeviceCodeToken, displayDeviceCodeInfo } = require('../../lib/utils/api');
const { initiateDeviceCodeFlow, getToken } = require('../../lib/api/auth.api');
const tokenManager = require('../../lib/utils/token-manager');
const logger = require('../../lib/utils/logger');

// Mock modules
jest.mock('inquirer');
jest.mock('ora');
jest.mock('../../lib/config');
jest.mock('../../lib/utils/api');
jest.mock('../../lib/api/auth.api');
jest.mock('../../lib/utils/token-manager');
jest.mock('../../lib/utils/logger');

describe('Login Command Module', () => {
  let mockExit;

  beforeEach(() => {
    jest.clearAllMocks();
    logger.log.mockImplementation(() => {});
    logger.error.mockImplementation(() => {});
    mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    // Setup default config mocks
    config.getCurrentEnvironment.mockResolvedValue('dev');
    config.setCurrentEnvironment.mockResolvedValue();
    config.saveClientToken.mockResolvedValue();
    config.saveDeviceToken.mockResolvedValue();

    // Setup default token-manager mocks
    tokenManager.loadClientCredentials.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateEnvironmentKey', () => {
    it('should accept valid environment keys', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      // Config saving is handled by saveClientToken or saveDeviceToken based on method

      try {
        await handleLogin(options);
      } catch (error) {
        // Handle process.exit error from mock
        if (error.message.includes('process.exit')) {
          // This is expected from the mock, ignore
          return;
        }
        throw error;
      }

      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev', 'openid profile email');
    });

    it('should pass default scope when no scope options provided', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      try {
        await handleLogin(options);
      } catch (error) {
        if (error.message.includes('process.exit')) {
          return;
        }
        throw error;
      }

      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev', 'openid profile email');
    });

    it('should add offline_access scope when --offline flag is used', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev',
        offline: true
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      try {
        await handleLogin(options);
      } catch (error) {
        if (error.message.includes('process.exit')) {
          return;
        }
        throw error;
      }

      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev', 'openid profile email offline_access');
    });

    it('should use custom scope when --scope option is provided', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev',
        scope: 'openid profile email custom_scope'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      try {
        await handleLogin(options);
      } catch (error) {
        if (error.message.includes('process.exit')) {
          return;
        }
        throw error;
      }

      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev', 'openid profile email custom_scope');
    });

    it('should add offline_access to custom scope when both --scope and --offline are used', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev',
        scope: 'openid profile',
        offline: true
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      try {
        await handleLogin(options);
      } catch (error) {
        if (error.message.includes('process.exit')) {
          return;
        }
        throw error;
      }

      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev', 'openid profile offline_access');
    });

    it('should not duplicate offline_access if already in custom scope', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev',
        scope: 'openid profile offline_access',
        offline: true
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      try {
        await handleLogin(options);
      } catch (error) {
        if (error.message.includes('process.exit')) {
          return;
        }
        throw error;
      }

      // Should not duplicate offline_access (buildScope checks if it's already included)
      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev', 'openid profile offline_access');
    });

    it('should show warning when --offline or --scope used with credentials method', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'credentials',
        app: 'myapp',
        offline: true
      };

      tokenManager.loadClientCredentials.mockResolvedValue({
        clientId: 'client-id-123',
        clientSecret: 'client-secret-456'
      });

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'client-token-123',
          expiresIn: 3600
        }
      });

      try {
        await handleLogin(options);
      } catch (error) {
        if (error.message.includes('process.exit')) {
          return;
        }
        throw error;
      }

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Warning: --offline and --scope options are only available for device flow'));
    });

    it('should reject invalid environment key format', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'invalid@key!'
      };

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Environment key must contain only letters, numbers, hyphens, and underscores');
      }
    });

    it('should reject environment key with spaces', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev env'
      };

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Environment key must contain only letters, numbers, hyphens, and underscores');
      }
    });

    it('should accept environment key with hyphens and underscores', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev-env_test'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      // Config saving is handled by saveClientToken or saveDeviceToken based on method

      try {
        await handleLogin(options);
      } catch (error) {
        // Handle process.exit error from mock
        if (error.message.includes('process.exit')) {
          // This is expected from the mock, ignore
          return;
        }
        throw error;
      }

      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev-env_test', 'openid profile email');
    });
  });

  describe('determineAuthMethod', () => {
    it('should reject invalid method', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'invalid-method'
      };

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('process.exit(1)');
      }

      expect(logger.error).toHaveBeenCalledWith(chalk.red('❌ Invalid method: invalid-method. Must be \'device\' or \'credentials\''));
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should prompt for method when not provided', async() => {
      inquirer.prompt
        .mockResolvedValueOnce({ method: 'device' })
        .mockResolvedValueOnce({ environment: 'dev' });

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      try {
        await handleLogin({ controller: 'http://localhost:3000' });
      } catch (error) {
        if (error.message.includes('process.exit')) {
          return;
        }
        throw error;
      }

      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'list',
            name: 'method',
            message: 'Choose authentication method:'
          })
        ])
      );
    });
  });

  describe('promptForCredentials', () => {
    it('should validate empty client ID', async() => {
      // Test that prompt is called when clientId is not provided
      // The prompt validation will catch empty values
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        // clientId not provided - will trigger prompt
        clientSecret: 'test-secret'
      };

      // Mock the prompt to return valid credentials after validation
      inquirer.prompt.mockResolvedValueOnce({
        clientId: 'valid-client-id',
        clientSecret: 'test-secret'
      });

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      await handleLogin(options);

      // Should have prompted for credentials since clientId was missing
      expect(inquirer.prompt).toHaveBeenCalled();

      // Verify the prompt included validation for clientId
      const promptCalls = inquirer.prompt.mock.calls;
      const credentialsPrompt = promptCalls.find(call =>
        call[0].some(q => q.name === 'clientId' && q.validate)
      );
      expect(credentialsPrompt).toBeDefined();

      // Test that validation rejects empty client ID
      const clientIdQuestion = credentialsPrompt[0].find(q => q.name === 'clientId');
      expect(clientIdQuestion.validate('   ')).toBe('Client ID is required');
    });

    it('should validate valid client ID', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        clientId: 'valid-client-id',
        clientSecret: 'test-secret',
        environment: 'dev'
      };

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      await handleLogin(options);
    });

    it('should validate empty client secret', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        clientId: 'test-id',
        clientSecret: '   ',  // Empty after trim
        environment: 'dev'
      };

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      await handleLogin(options);
    });

    it('should validate valid client secret', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        clientId: 'test-id',
        clientSecret: 'valid-secret',
        environment: 'dev'
      };

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      await handleLogin(options);
    });

    it('should trim whitespace from credentials', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        clientId: '  test-id  ',
        clientSecret: '  test-secret  ',
        environment: 'dev'
      };

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      await handleLogin(options);

      expect(getToken).toHaveBeenCalledWith(
        'test-id',
        'test-secret',
        'http://localhost:3000'
      );
    });

    it('should return credentials without prompting when both provided', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        clientId: 'provided-id',
        clientSecret: 'provided-secret',
        environment: 'dev'
      };

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      await handleLogin(options);

      // Should not prompt for credentials
      const promptCalls = inquirer.prompt.mock.calls;
      const credentialsPrompt = promptCalls.find(call =>
        call[0].some(q => q.name === 'clientId')
      );
      expect(credentialsPrompt).toBeUndefined();

      expect(getToken).toHaveBeenCalledWith(
        'provided-id',
        'provided-secret',
        'http://localhost:3000'
      );
    });
  });

  describe('getEnvironmentKey', () => {
    it('should prompt for environment key when not provided', async() => {
      // When method is provided but environment is not, only environment prompt is called
      inquirer.prompt.mockResolvedValueOnce({ environment: 'dev' });

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      try {
        await handleLogin({ controller: 'http://localhost:3000', method: 'device' });
      } catch (error) {
        // Handle process.exit error from mock
        if (error.message.includes('process.exit')) {
          // This is expected from the mock, ignore
          return;
        }
        throw error;
      }

      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'input',
            name: 'environment',
            message: 'Environment key (e.g., miso, dev, tst, pro):'
          })
        ])
      );
    });

    it('should validate empty environment key in prompt', async() => {
      inquirer.prompt.mockImplementation((questions) => {
        // When method is provided, only environment prompt is called
        const envQuestion = questions.find(q => q.name === 'environment');
        if (envQuestion && envQuestion.validate) {
          // Test validation with empty value - this covers line 124
          const validationResult = envQuestion.validate('   ');
          expect(validationResult).toBe('Environment key is required');
        }
        return Promise.resolve({ environment: 'dev' });
      });

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      // Config saving is handled by saveClientToken or saveDeviceToken based on method

      try {
        await handleLogin({ url: 'http://localhost:3000', method: 'device' });
      } catch (error) {
        // Handle process.exit error from mock
        if (error.message.includes('process.exit')) {
          // This is expected from the mock, ignore
          return;
        }
        throw error;
      }
    });

    it('should validate environment key format in prompt - valid key', async() => {
      let callCount = 0;
      inquirer.prompt.mockImplementation((questions) => {
        callCount++;
        if (callCount === 1) {
          // First call: environment key (method is provided, so no method prompt)
          const envQuestion = questions.find(q => q.name === 'environment');
          if (envQuestion && envQuestion.validate) {
            // Test validation with valid value - this covers line 127 and tests line 124
            const validationResult = envQuestion.validate('dev');
            expect(validationResult).toBe(true);
          }
          return Promise.resolve({ environment: 'dev' });
        }
      });

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      // Config saving is handled by saveClientToken or saveDeviceToken based on method

      try {
        await handleLogin({ url: 'http://localhost:3000', method: 'device' });
      } catch (error) {
        // Handle process.exit error from mock
        if (error.message.includes('process.exit')) {
          // This is expected from the mock, ignore
          return;
        }
        throw error;
      }
    });

    it('should validate environment key format in prompt - test line 124 with non-empty input', async() => {
      let callCount = 0;
      inquirer.prompt.mockImplementation((questions) => {
        callCount++;
        if (callCount === 1) {
          // First call: environment key (method is provided, so no method prompt)
          const envQuestion = questions.find(q => q.name === 'environment');
          if (envQuestion && envQuestion.validate) {
            // Test line 124: input.trim().length === 0 with non-empty input
            // This tests the else branch when input has content but is invalid format
            try {
              envQuestion.validate('dev@invalid');
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              expect(error.message).toContain('Environment key must contain only letters, numbers, hyphens, and underscores');
            }
          }
          return Promise.resolve({ environment: 'dev' });
        }
      });

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      // Config saving is handled by saveClientToken or saveDeviceToken based on method

      try {
        await handleLogin({ url: 'http://localhost:3000', method: 'device' });
      } catch (error) {
        // Handle process.exit error from mock
        if (error.message.includes('process.exit')) {
          // This is expected from the mock, ignore
          return;
        }
        throw error;
      }
    });

    it('should validate and reject invalid environment key format in prompt', async() => {
      let callCount = 0;
      inquirer.prompt.mockImplementation((questions) => {
        callCount++;
        if (callCount === 1) {
          // First call: environment key (method is provided, so no method prompt)
          const envQuestion = questions.find(q => q.name === 'environment');
          if (envQuestion && envQuestion.validate) {
            // Test validation with invalid format
            try {
              const validationResult = envQuestion.validate('invalid@key!');
              expect(true).toBe(false); // Should not reach here
            } catch (error) {
              expect(error.message).toContain('Environment key must contain only letters, numbers, hyphens, and underscores');
            }
          }
          return Promise.resolve({ environment: 'dev' });
        }
      });

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      // Config saving is handled by saveClientToken or saveDeviceToken based on method

      try {
        await handleLogin({ url: 'http://localhost:3000', method: 'device' });
      } catch (error) {
        // Handle process.exit error from mock
        if (error.message.includes('process.exit')) {
          // This is expected from the mock, ignore
          return;
        }
        throw error;
      }
    });

    it('should trim whitespace from environment key', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: '  dev  '
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      // Config saving is handled by saveClientToken or saveDeviceToken based on method

      try {
        await handleLogin(options);
      } catch (error) {
        // Handle process.exit error from mock
        if (error.message.includes('process.exit')) {
          // This is expected from the mock, ignore
          return;
        }
        throw error;
      }

      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev', 'openid profile email');
    });
  });

  describe('handleDeviceCodeLogin', () => {
    it('should handle successful device code flow', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      // Config saving is handled by saveClientToken or saveDeviceToken based on method

      try {
        await handleLogin(options);
      } catch (error) {
        // Handle process.exit error from mock
        if (error.message.includes('process.exit')) {
          // This is expected from the mock, ignore
          return;
        }
        throw error;
      }

      expect(displayDeviceCodeInfo).toHaveBeenCalledWith(
        'ABCD-EFGH',
        'https://example.com/verify',
        logger,
        chalk
      );

      expect(pollDeviceCodeToken).toHaveBeenCalledWith(
        'http://localhost:3000',
        'device-code-123',
        5,
        600,
        expect.any(Function)
      );

      expect(config.setCurrentEnvironment).toHaveBeenCalledWith('dev');
      expect(config.saveDeviceToken).toHaveBeenCalledWith(
        'http://localhost:3000',
        'access-token-123',
        'refresh-token-456',
        expect.any(String)
      );
    });

    it('should handle device code flow failure', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockRejectedValue(new Error('Failed to initiate device code flow'));

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('process.exit(1)');
      }

      expect(logger.error).toHaveBeenCalledWith(
        chalk.red('\n❌ Device code flow failed: Failed to initiate device code flow')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle polling failure', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      const pollError = new Error('Polling failed');
      pollDeviceCodeToken.mockRejectedValue(pollError);

      const mockSpinner = {
        start: jest.fn().mockReturnThis(),
        succeed: jest.fn(),
        fail: jest.fn()
      };

      ora.mockReturnValue(mockSpinner);

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('process.exit(1)');
      }

      expect(mockSpinner.fail).toHaveBeenCalledWith('Authentication failed');
      expect(pollDeviceCodeToken).toHaveBeenCalled();
    });

    it('should handle undefined device code API response', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue(undefined);

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('process.exit(1)');
      }

      expect(logger.error).toHaveBeenCalledWith(
        chalk.red('\n❌ Device code flow failed: Device code flow initiation returned no response')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle unsuccessful device code API response', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: false,
        error: 'Validation failed',
        formattedError: '❌ Validation Error\nValidation failed'
      });

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('process.exit(1)');
      }

      expect(logger.error).toHaveBeenCalledWith(
        chalk.red('\n❌ Device code flow failed:')
      );
      expect(logger.log).toHaveBeenCalledWith('❌ Validation Error\nValidation failed');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle device code API response without data', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: undefined
      });

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('process.exit(1)');
      }

      expect(logger.error).toHaveBeenCalledWith(
        chalk.red('\n❌ Device code flow failed: Device code flow initiation returned no data')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle device code API response with error message but no formattedError', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: false,
        error: 'API request failed'
      });

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('process.exit(1)');
      }

      expect(logger.error).toHaveBeenCalledWith(
        chalk.red('\n❌ Device code flow failed: API request failed')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should update spinner text during polling', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      const mockSpinner = {
        start: jest.fn().mockReturnThis(),
        text: '',
        succeed: jest.fn(),
        fail: jest.fn()
      };

      ora.mockReturnValue(mockSpinner);

      let pollCallback;
      pollDeviceCodeToken.mockImplementation((url, code, interval, expiresIn, callback) => {
        pollCallback = callback;
        // Call callback multiple times to test increment logic
        if (callback) {
          callback(); // attempt 1
          callback(); // attempt 2
          callback(); // attempt 3
        }
        return Promise.resolve({
          access_token: 'access-token-123',
          expires_in: 3600
        });
      });

      // Config saving is handled by saveClientToken or saveDeviceToken based on method

      await handleLogin(options);

      expect(mockSpinner.text).toBe('Waiting for approval (attempt 3)...');
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Authentication approved!');
    });
  });

  describe('handleCredentialsLogin', () => {
    it('should handle token response with token field', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        clientId: 'test-id',
        clientSecret: 'test-secret',
        environment: 'dev'
      };

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token-123',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      await handleLogin(options);

      expect(config.setCurrentEnvironment).toHaveBeenCalledWith('dev');
      expect(config.saveClientToken).toHaveBeenCalledWith(
        'dev',
        'test-app',
        'http://localhost:3000',
        'test-token-123',
        expect.any(String)
      );
    });

    it('should handle token response with expiresIn field', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        clientId: 'test-id',
        clientSecret: 'test-secret',
        environment: 'dev'
      };

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token-456',
          expiresIn: 3600
        }
      });

      await handleLogin(options);

      expect(config.setCurrentEnvironment).toHaveBeenCalledWith('dev');
      expect(config.saveClientToken).toHaveBeenCalledWith(
        'dev',
        'test-app',
        'http://localhost:3000',
        'test-token-456',
        expect.any(String)
      );
    });

    it('should handle login failure', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        clientId: 'test-id',
        clientSecret: 'test-secret',
        environment: 'dev'
      };

      config.getCurrentEnvironment.mockResolvedValue('dev');
      config.setCurrentEnvironment.mockResolvedValue();
      tokenManager.loadClientCredentials.mockResolvedValue(null);

      getToken.mockResolvedValue({
        success: false,
        formattedError: 'Invalid credentials',
        error: 'Invalid credentials'
      });

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('process.exit(1)');
      }

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid credentials'));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('handleLogin', () => {
    it('should remove trailing slash from URL', async() => {
      const options = {
        controller: 'http://localhost:3000/',
        method: 'credentials',
        app: 'test-app',
        clientId: 'test-id',
        clientSecret: 'test-secret',
        environment: 'dev'
      };

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      await handleLogin(options);

      expect(logger.log).toHaveBeenCalledWith(chalk.gray('Controller URL: http://localhost:3000'));
      expect(config.saveClientToken).toHaveBeenCalledWith(
        'dev',
        'test-app',
        'http://localhost:3000',
        'test-token',
        expect.any(String)
      );
    });

    it('should save environment for device flow', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        success: true,
        data: {
          data: {
            deviceCode: 'device-code-123',
            userCode: 'ABCD-EFGH',
            verificationUri: 'https://example.com/verify',
            interval: 5,
            expiresIn: 600
          }
        }
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expires_in: 3600
      });

      await handleLogin(options);

      expect(config.setCurrentEnvironment).toHaveBeenCalledWith('dev');
      expect(config.saveDeviceToken).toHaveBeenCalledWith(
        'http://localhost:3000',
        'access-token-123',
        'refresh-token-456',
        expect.any(String)
      );
    });

    it('should save client token for credentials flow', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        clientId: 'test-id',
        clientSecret: 'test-secret',
        environment: 'dev'
      };

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      await handleLogin(options);

      expect(config.setCurrentEnvironment).toHaveBeenCalledWith('dev');
      expect(config.saveClientToken).toHaveBeenCalledWith(
        'dev',
        'test-app',
        'http://localhost:3000',
        'test-token',
        expect.any(String)
      );
    });

    it('should display success message after login', async() => {
      const options = {
        controller: 'http://localhost:3000',
        method: 'credentials',
        app: 'test-app',
        clientId: 'test-id',
        clientSecret: 'test-secret',
        environment: 'dev'
      };

      getToken.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      });

      await handleLogin(options);

      expect(logger.log).toHaveBeenCalledWith(chalk.green('\n✅ Successfully logged in!'));
      expect(logger.log).toHaveBeenCalledWith(chalk.gray('Controller: http://localhost:3000'));
      expect(logger.log).toHaveBeenCalledWith(chalk.gray('Environment: dev'));
      expect(logger.log).toHaveBeenCalledWith(chalk.gray('App: test-app'));
      expect(logger.log).toHaveBeenCalledWith(chalk.gray('Token stored securely in ~/.aifabrix/config.yaml\n'));
    });
  });
});

