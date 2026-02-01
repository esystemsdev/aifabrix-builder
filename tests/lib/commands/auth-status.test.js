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
const wizardDataplane = require('../../../lib/commands/wizard-dataplane');
const datasourceDeploy = require('../../../lib/datasource/deploy');
const dataplaneHealth = require('../../../lib/utils/dataplane-health');

// Mock modules
jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/api/auth.api');
jest.mock('../../../lib/utils/controller-url');
jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/commands/wizard-dataplane');
jest.mock('../../../lib/datasource/deploy');
jest.mock('../../../lib/utils/dataplane-health');

describe('Auth Status Command Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.log.mockImplementation(() => {});
    config.getConfig.mockResolvedValue({ environments: {} });
    config.getCurrentEnvironment.mockResolvedValue('dev');
    config.resolveEnvironment = jest.fn().mockResolvedValue('dev');
    config.getSecretsEncryptionKey.mockResolvedValue(null);
    controllerUrl.resolveControllerUrl.mockResolvedValue('http://localhost:3000');
    wizardDataplane.findDataplaneServiceAppKey.mockResolvedValue('dataplane');
    datasourceDeploy.getDataplaneUrl.mockResolvedValue('http://localhost:3611');
    dataplaneHealth.checkDataplaneHealth.mockResolvedValue(true);
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

      expect(controllerUrl.resolveControllerUrl).toHaveBeenCalledWith();
      expect(tokenManager.getOrRefreshDeviceToken).toHaveBeenCalledWith('http://localhost:3000');
      expect(authApi.getAuthUser).toHaveBeenCalledWith(
        'http://localhost:3000',
        { type: 'bearer', token: 'device-token-123' }
      );
      expect(logger.log).toHaveBeenCalledWith(chalk.bold('\n🔐 Authentication Status\n'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Controller:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Status:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Authenticated'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dataplane:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Connected'));
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

    it('should use controller URL from config', async() => {
      controllerUrl.resolveControllerUrl.mockResolvedValue('https://custom.controller.com');
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue(null);
      const mockConfig = { environments: {} };
      config.getConfig.mockResolvedValue(mockConfig);

      await handleAuthStatus({});

      expect(controllerUrl.resolveControllerUrl).toHaveBeenCalledWith();
      expect(tokenManager.getOrRefreshDeviceToken).toHaveBeenCalledWith('https://custom.controller.com');
    });

    it('should use environment from config', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue(null);
      config.resolveEnvironment = jest.fn().mockResolvedValue('prod');
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

      await handleAuthStatus({});

      expect(config.resolveEnvironment).toHaveBeenCalledWith();
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

    it('should display dataplane not reachable when health check fails', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'device-token-123',
        controller: 'http://localhost:3000'
      });
      authApi.getAuthUser.mockResolvedValue({
        success: true,
        data: { authenticated: true }
      });
      dataplaneHealth.checkDataplaneHealth.mockResolvedValue(false);

      await handleAuthStatus({});

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dataplane:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Not reachable'));
    });

    it('should display dataplane not discovered when URL resolution fails', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'device-token-123',
        controller: 'http://localhost:3000'
      });
      authApi.getAuthUser.mockResolvedValue({
        success: true,
        data: { authenticated: true }
      });
      wizardDataplane.findDataplaneServiceAppKey.mockResolvedValue(null);
      datasourceDeploy.getDataplaneUrl.mockRejectedValue(new Error('Not found'));

      await handleAuthStatus({});

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dataplane:'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Not discovered'));
    });

    it('should display Controller and Dataplane Open API docs URLs when authenticated', async() => {
      tokenManager.getOrRefreshDeviceToken.mockResolvedValue({
        token: 'device-token-123',
        controller: 'http://localhost:3000'
      });
      authApi.getAuthUser.mockResolvedValue({
        success: true,
        data: { authenticated: true, user: { email: 'u@e.com' } }
      });
      dataplaneHealth.checkDataplaneHealth.mockResolvedValue(true);

      await handleAuthStatus({});

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('http://localhost:3000/api/docs'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('http://localhost:3611/api/docs'));
    });
  });
});
