/**
 * Tests for AI Fabrix Builder Auth Status Command
 *
 * @fileoverview Unit tests for commands/auth-status.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { handleAuthStatus } = require('../../../lib/commands/auth-status');
const config = require('../../../lib/core/config');
const tokenManager = require('../../../lib/utils/token-manager');
const authApi = require('../../../lib/api/auth.api');
const controllerUrl = require('../../../lib/utils/controller-url');
const logger = require('../../../lib/utils/logger');

// Mock modules
jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/api/auth.api');
jest.mock('../../../lib/utils/controller-url');
jest.mock('../../../lib/utils/logger');

describe('Auth Status Command Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.log.mockImplementation(() => {});
    config.getConfig.mockResolvedValue({ environments: {} });
    config.getCurrentEnvironment.mockResolvedValue('dev');
    config.getSecretsEncryptionKey.mockResolvedValue(null);
    controllerUrl.resolveControllerUrl.mockResolvedValue('http://localhost:3000');
  });

  describe('handleAuthStatus', () => {
    it('should display authenticated status with device token', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'device-token-123',
        controller: 'http://localhost:3000'
      });

      authApi.getAuthUser.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: {
            id: 'user-123',
            email: 'user@example.com',
            username: 'user'
          },
          expiresAt: '2024-01-15T10:30:00Z'
        }
      });

      await handleAuthStatus({});

      expect(controllerUrl.resolveControllerUrl).toHaveBeenCalledWith({}, { environments: {} });
      expect(tokenManager.getOrRefreshDeviceToken).toHaveBeenCalledWith('http://localhost:3000');
      expect(authApi.getAuthUser).toHaveBeenCalledWith(
        'http://localhost:3000',
        { type: 'bearer', token: 'device-token-123' }
      );
      expect(logger.log).toHaveBeenCalledWith(chalk.bold('\n🔐 Authentication Status\n'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Controller:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Status:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Authenticated'));
    });

    it('should display not authenticated status when no token found', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue(null);
      config.getConfig.mockResolvedValue({
        clientTokens: {}
      });

      await handleAuthStatus({});

      expect(logger.log).toHaveBeenCalledWith(chalk.bold('\n🔐 Authentication Status\n'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Status:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Run "aifabrix login"'));
    });

    it('should display client token status when device token not available', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue(null);
      config.getConfig.mockResolvedValue({
        environments: {
          dev: {
            clients: {
              myapp: {
                token: 'client-token-123',
                controller: 'http://localhost:3000',
                expiresAt: '2024-01-15T10:30:00Z'
              }
            }
          }
        }
      });
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      authApi.getAuthUser.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: {
            email: 'app@example.com'
          },
          expiresAt: '2024-01-15T10:30:00Z'
        }
      });

      await handleAuthStatus({});

      expect(authApi.getAuthUser).toHaveBeenCalledWith(
        'http://localhost:3000',
        { type: 'bearer', token: 'client-token-123' }
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Client Token'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('myapp'));
    });

    it('should use explicit controller URL from options', async() => {
      controllerUrl.resolveControllerUrl.mockResolvedValue('https://custom.controller.com');
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue(null);
      const mockConfig = { environments: {} };
      config.getConfig.mockResolvedValue(mockConfig);

      await handleAuthStatus({ controller: 'https://custom.controller.com' });

      expect(controllerUrl.resolveControllerUrl).toHaveBeenCalledWith(
        { controller: 'https://custom.controller.com' },
        mockConfig
      );
      expect(tokenManager.getOrRefreshDeviceToken).toHaveBeenCalledWith('https://custom.controller.com');
    });

    it('should use explicit environment from options', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue(null);
      config.getConfig.mockResolvedValue({
        environments: {
          prod: {
            clients: {
              myapp: {
                token: 'client-token-123',
                controller: 'http://localhost:3000',
                expiresAt: '2024-01-15T10:30:00Z'
              }
            }
          }
        }
      });
      config.getSecretsEncryptionKey.mockResolvedValue(null);

      authApi.getAuthUser.mockResolvedValue({
        success: true,
        data: { authenticated: true }
      });

      await handleAuthStatus({ environment: 'prod' });

      expect(authApi.getAuthUser).toHaveBeenCalledWith(
        'http://localhost:3000',
        { type: 'bearer', token: 'client-token-123' }
      );
    });

    it('should handle token validation failure gracefully', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'invalid-token',
        controller: 'http://localhost:3000'
      });

      authApi.getAuthUser.mockResolvedValue({
        success: false,
        error: 'Token expired'
      });

      await handleAuthStatus({});

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Token expired'));
    });

    it('should handle token validation error gracefully', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'device-token-123',
        controller: 'http://localhost:3000'
      });

      authApi.getAuthUser.mockRejectedValue(new Error('Network error'));

      await handleAuthStatus({});

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Network error'));
    });
  });
});
