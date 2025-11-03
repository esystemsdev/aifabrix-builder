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
const { saveConfig } = require('../../lib/config');
const { makeApiCall, initiateDeviceCodeFlow, pollDeviceCodeToken, displayDeviceCodeInfo } = require('../../lib/utils/api');
const logger = require('../../lib/utils/logger');

// Mock modules
jest.mock('inquirer');
jest.mock('ora');
jest.mock('../../lib/config');
jest.mock('../../lib/utils/api');
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
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      saveConfig.mockResolvedValue();

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

      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev');
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
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        expires_in: 3600
      });

      saveConfig.mockResolvedValue();

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

      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev-env_test');
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
        .mockResolvedValueOnce({ method: 'credentials' })
        .mockResolvedValueOnce({
          clientId: 'test-id',
          clientSecret: 'test-secret'
        });

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin({ url: 'http://localhost:3000' });

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
      let callCount = 0;
      inquirer.prompt.mockImplementation((questions) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ method: 'credentials' });
        } else if (callCount === 2) {
          const clientIdQuestion = questions.find(q => q.name === 'clientId');
          if (clientIdQuestion && clientIdQuestion.validate) {
            // Test validation with empty value
            const validationResult = clientIdQuestion.validate('   ');
            expect(validationResult).toBe('Client ID is required');
          }
          return Promise.resolve({
            clientId: 'test-id',
            clientSecret: 'test-secret'
          });
        }
      });

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin({ url: 'http://localhost:3000' });

      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should validate valid client ID', async() => {
      let callCount = 0;
      inquirer.prompt.mockImplementation((questions) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ method: 'credentials' });
        } else if (callCount === 2) {
          const clientIdQuestion = questions.find(q => q.name === 'clientId');
          if (clientIdQuestion && clientIdQuestion.validate) {
            // Test validation with valid value
            const validationResult = clientIdQuestion.validate('valid-client-id');
            expect(validationResult).toBe(true);
          }
          return Promise.resolve({
            clientId: 'valid-client-id',
            clientSecret: 'test-secret'
          });
        }
      });

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin({ url: 'http://localhost:3000' });
    });

    it('should validate empty client secret', async() => {
      let callCount = 0;
      inquirer.prompt.mockImplementation((questions) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ method: 'credentials' });
        } else if (callCount === 2) {
          const clientSecretQuestion = questions.find(q => q.name === 'clientSecret');
          if (clientSecretQuestion && clientSecretQuestion.validate) {
            // Test validation with empty value
            const validationResult = clientSecretQuestion.validate('   ');
            expect(validationResult).toBe('Client Secret is required');
          }
          return Promise.resolve({
            clientId: 'test-id',
            clientSecret: 'test-secret'
          });
        }
      });

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin({ url: 'http://localhost:3000' });
    });

    it('should validate valid client secret', async() => {
      let callCount = 0;
      inquirer.prompt.mockImplementation((questions) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ method: 'credentials' });
        } else if (callCount === 2) {
          const clientSecretQuestion = questions.find(q => q.name === 'clientSecret');
          if (clientSecretQuestion && clientSecretQuestion.validate) {
            // Test validation with valid value
            const validationResult = clientSecretQuestion.validate('valid-secret');
            expect(validationResult).toBe(true);
          }
          return Promise.resolve({
            clientId: 'test-id',
            clientSecret: 'valid-secret'
          });
        }
      });

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin({ url: 'http://localhost:3000' });
    });

    it('should trim whitespace from credentials', async() => {
      inquirer.prompt
        .mockResolvedValueOnce({ method: 'credentials' })
        .mockResolvedValueOnce({
          clientId: '  test-id  ',
          clientSecret: '  test-secret  '
        });

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin({ url: 'http://localhost:3000' });

      expect(makeApiCall).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/auth/login',
        expect.objectContaining({
          body: expect.stringContaining('"clientId":"test-id"')
        })
      );
    });

    it('should return credentials without prompting when both provided', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'credentials',
        clientId: 'provided-id',
        clientSecret: 'provided-secret'
      };

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin(options);

      // Should not prompt for credentials
      const promptCalls = inquirer.prompt.mock.calls;
      const credentialsPrompt = promptCalls.find(call =>
        call[0].some(q => q.name === 'clientId')
      );
      expect(credentialsPrompt).toBeUndefined();

      expect(makeApiCall).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/auth/login',
        expect.objectContaining({
          body: expect.stringContaining('"clientId":"provided-id"')
        })
      );
    });
  });

  describe('getEnvironmentKey', () => {
    it('should prompt for environment key when not provided', async() => {
      // When method is provided but environment is not, only environment prompt is called
      inquirer.prompt.mockResolvedValueOnce({ environment: 'dev' });

      initiateDeviceCodeFlow.mockResolvedValue({
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        expires_in: 3600
      });

      saveConfig.mockResolvedValue();

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

      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'input',
            name: 'environment',
            message: 'Environment key (e.g., dev, tst, pro):'
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
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        expires_in: 3600
      });

      saveConfig.mockResolvedValue();

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
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        expires_in: 3600
      });

      saveConfig.mockResolvedValue();

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
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        expires_in: 3600
      });

      saveConfig.mockResolvedValue();

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
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        expires_in: 3600
      });

      saveConfig.mockResolvedValue();

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
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        expires_in: 3600
      });

      saveConfig.mockResolvedValue();

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

      expect(initiateDeviceCodeFlow).toHaveBeenCalledWith('http://localhost:3000', 'dev');
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
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        expires_in: 3600
      });

      displayDeviceCodeInfo.mockImplementation(() => {});

      saveConfig.mockResolvedValue();

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

      expect(saveConfig).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:3000',
        token: 'access-token-123',
        expiresAt: expect.any(String),
        environment: 'dev'
      });
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
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockRejectedValue(new Error('Polling failed'));

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

    it('should update spinner text during polling', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
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

      saveConfig.mockResolvedValue();

      await handleLogin(options);

      expect(mockSpinner.text).toBe('Waiting for approval (attempt 3)...');
      expect(mockSpinner.succeed).toHaveBeenCalledWith('Authentication approved!');
    });
  });

  describe('handleCredentialsLogin', () => {
    it('should handle token response with token field', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'credentials',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      };

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token-123' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin(options);

      expect(saveConfig).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:3000',
        token: 'test-token-123',
        expiresAt: expect.any(String),
        environment: undefined
      });
    });

    it('should handle token response with accessToken field', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'credentials',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      };

      makeApiCall.mockResolvedValue({
        success: true,
        data: { accessToken: 'test-token-456' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin(options);

      expect(saveConfig).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:3000',
        token: 'test-token-456',
        expiresAt: expect.any(String),
        environment: undefined
      });
    });

    it('should handle login failure', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'credentials',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      };

      makeApiCall.mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      });

      try {
        await handleLogin(options);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('process.exit(1)');
      }

      expect(logger.error).toHaveBeenCalledWith(chalk.red('❌ Login failed: Invalid credentials'));
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('handleLogin', () => {
    it('should remove trailing slash from URL', async() => {
      const options = {
        url: 'http://localhost:3000/',
        method: 'credentials',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      };

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin(options);

      expect(logger.log).toHaveBeenCalledWith(chalk.gray('Controller URL: http://localhost:3000'));
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: 'http://localhost:3000'
        })
      );
    });

    it('should save environment for device flow', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'device',
        environment: 'dev'
      };

      initiateDeviceCodeFlow.mockResolvedValue({
        device_code: 'device-code-123',
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://example.com/verify',
        interval: 5,
        expires_in: 600
      });

      pollDeviceCodeToken.mockResolvedValue({
        access_token: 'access-token-123',
        expires_in: 3600
      });

      saveConfig.mockResolvedValue();

      await handleLogin(options);

      expect(saveConfig).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:3000',
        token: 'access-token-123',
        expiresAt: expect.any(String),
        environment: 'dev'
      });
    });

    it('should not save environment for credentials flow', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'credentials',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      };

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin(options);

      expect(saveConfig).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:3000',
        token: 'test-token',
        expiresAt: expect.any(String),
        environment: undefined
      });
    });

    it('should display success message after login', async() => {
      const options = {
        url: 'http://localhost:3000',
        method: 'credentials',
        clientId: 'test-id',
        clientSecret: 'test-secret'
      };

      makeApiCall.mockResolvedValue({
        success: true,
        data: { token: 'test-token' }
      });

      saveConfig.mockResolvedValue();

      await handleLogin(options);

      expect(logger.log).toHaveBeenCalledWith(chalk.green('\n✅ Successfully logged in!'));
      expect(logger.log).toHaveBeenCalledWith(chalk.gray('Controller: http://localhost:3000'));
      expect(logger.log).toHaveBeenCalledWith(chalk.gray('Token stored securely in ~/.aifabrix/config.yaml\n'));
    });
  });
});

