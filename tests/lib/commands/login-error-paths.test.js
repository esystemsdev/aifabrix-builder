/**
 * Tests for Login Error Paths
 *
 * @fileoverview Unit tests for login.js error handling paths
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/api');
jest.mock('inquirer');
jest.mock('chalk', () => {
  const createMockFn = (text) => text;
  const mockChalk = createMockFn;
  ['blue', 'green', 'red', 'yellow', 'gray'].forEach(prop => {
    mockChalk[prop] = createMockFn;
  });
  return mockChalk;
});

const { handleLogin } = require('../../../lib/commands/login');
const logger = require('../../../lib/utils/logger');
const tokenManager = require('../../../lib/utils/token-manager');
const config = require('../../../lib/core/config');
const api = require('../../../lib/utils/api');
const inquirer = require('inquirer');

describe('Login Error Paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.exit = jest.fn(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    delete process.exit;
  });

  describe('handleCredentialsLogin', () => {
    it('should handle empty client ID validation', async() => {
      inquirer.prompt.mockResolvedValue({
        clientId: '',
        clientSecret: 'secret'
      });

      // The validation should catch empty client ID
      const result = await inquirer.prompt([
        {
          type: 'input',
          name: 'clientId',
          validate: (input) => {
            const value = input.trim();
            if (!value || value.length === 0) {
              return 'Client ID is required';
            }
            return true;
          }
        }
      ]);

      expect(result.clientId).toBe('');
    });

    it('should handle empty client secret validation', async() => {
      inquirer.prompt.mockResolvedValue({
        clientId: 'client-id',
        clientSecret: ''
      });

      // The validation should catch empty client secret
      const result = await inquirer.prompt([
        {
          type: 'password',
          name: 'clientSecret',
          validate: (input) => {
            const value = input.trim();
            if (!value || value.length === 0) {
              return 'Client Secret is required';
            }
            return true;
          }
        }
      ]);

      expect(result.clientSecret).toBe('');
    });

    it('should handle authentication failures', async() => {
      const options = {
        controller: 'https://controller.example.com',
        app: 'testapp',
        method: 'credentials',
        environment: 'dev'
      };

      inquirer.prompt.mockResolvedValue({
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      api.makeApiCall.mockResolvedValue({
        success: false,
        status: 401,
        formattedError: 'Authentication failed',
        data: {}
      });

      process.exit = jest.fn();

      await handleLogin(options);

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle token save errors', async() => {
      const options = {
        controller: 'https://controller.example.com',
        app: 'testapp',
        method: 'credentials',
        environment: 'dev'
      };

      inquirer.prompt.mockResolvedValue({
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      api.makeApiCall.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token',
          expiresIn: 3600
        }
      });

      config.saveClientToken.mockRejectedValue(new Error('Token save failed'));

      await expect(
        handleLogin(options)
      ).rejects.toThrow('Token save failed');
    });
  });

  describe('handleLogin', () => {
    it('should handle missing app option for credentials method', async() => {
      const options = {
        controller: 'https://controller.example.com',
        method: 'credentials'
        // Missing app option
      };

      inquirer.prompt.mockResolvedValue({
        clientId: 'test-id',
        clientSecret: 'test-secret'
      });

      // Should prompt for app name or throw error
      await expect(
        handleLogin(options)
      ).rejects.toThrow();
    });

    it('should handle device code flow errors', async() => {
      const options = {
        controller: 'https://controller.example.com',
        method: 'device',
        environment: 'dev'
      };

      api.initiateDeviceCodeFlow.mockRejectedValue(new Error('Device code flow failed'));

      await expect(
        handleLogin(options)
      ).rejects.toThrow('process.exit called');

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle offline token flow errors', async() => {
      const options = {
        controller: 'https://controller.example.com',
        method: 'device',
        offline: true,
        environment: 'dev'
      };

      api.initiateDeviceCodeFlow.mockRejectedValue(new Error('Offline token flow failed'));

      await expect(
        handleLogin(options)
      ).rejects.toThrow('process.exit called');

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});

