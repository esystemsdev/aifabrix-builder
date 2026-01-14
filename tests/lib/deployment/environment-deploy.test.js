/**
 * Tests for AI Fabrix Builder Environment Deployment Module
 *
 * @fileoverview Unit tests for environment-deploy.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

// Mock modules
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

jest.mock('../../../lib/core/config', () => ({
  setCurrentEnvironment: jest.fn().mockResolvedValue(),
  getConfig: jest.fn()
}));

jest.mock('../../../lib/utils/deployment-validation', () => ({
  validateControllerUrl: jest.fn((url) => url),
  validateEnvironmentKey: jest.fn((key) => key)
}));

jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));

jest.mock('../../../lib/utils/api', () => ({
  authenticatedApiCall: jest.fn()
}));

jest.mock('../../../lib/utils/deployment-errors', () => ({
  handleDeploymentErrors: jest.fn().mockResolvedValue()
}));

jest.mock('../../../lib/core/audit-logger', () => ({
  logDeploymentAttempt: jest.fn().mockResolvedValue()
}));

const logger = require('../../../lib/utils/logger');
const config = require('../../../lib/core/config');
const { validateControllerUrl, validateEnvironmentKey } = require('../../../lib/utils/deployment-validation');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const { authenticatedApiCall } = require('../../../lib/utils/api');
const { handleDeploymentErrors } = require('../../../lib/utils/deployment-errors');
const auditLogger = require('../../../lib/core/audit-logger');
const { deployEnvironment } = require('../../../lib/deployment/environment');

describe('Environment Deployment Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('deployEnvironment', () => {
    it('should deploy environment successfully with polling', async() => {
      jest.useFakeTimers({ advanceTimers: true });

      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated',
          url: `${controllerUrl}/environments/${envKey}`
        }
      };
      const mockStatusResponse = {
        success: true,
        data: {
          status: 'ready',
          ready: true
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall
        .mockResolvedValueOnce(mockDeploymentResponse) // Initial deployment
        .mockResolvedValue(mockStatusResponse); // Polling responses

      const deployPromise = deployEnvironment(envKey, {
        controller: controllerUrl,
        poll: true
      });

      // Process initial deployment
      await Promise.resolve();

      // Fast-forward through first polling attempt
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();

      jest.useRealTimers();

      const result = await deployPromise;

      expect(result).toMatchObject({
        success: true,
        environment: envKey,
        status: 'ready'
      });
      expect(config.setCurrentEnvironment).toHaveBeenCalledWith(envKey);
      expect(validateControllerUrl).toHaveBeenCalled();
      expect(validateEnvironmentKey).toHaveBeenCalled();
      expect(auditLogger.logDeploymentAttempt).toHaveBeenCalled();
      expect(authenticatedApiCall).toHaveBeenCalled();
    });

    it('should deploy environment without polling when noPoll is true', async() => {
      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated'
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall.mockResolvedValue(mockDeploymentResponse);

      const result = await deployEnvironment(envKey, {
        controller: controllerUrl,
        noPoll: true
      });

      expect(result).toMatchObject({
        success: true,
        environment: envKey
      });
      // Should only call once for deployment, not for polling
      expect(authenticatedApiCall).toHaveBeenCalledTimes(1);
    });

    it('should deploy environment with config file option', async() => {
      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated'
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall.mockResolvedValue(mockDeploymentResponse);

      const result = await deployEnvironment(envKey, {
        controller: controllerUrl,
        config: '/path/to/config.yaml',
        noPoll: true
      });

      expect(result).toMatchObject({
        success: true,
        environment: envKey
      });
      expect(authenticatedApiCall).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/environments/dev/deploy'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(envKey)
        }),
        mockToken.token
      );
    });

    it('should skip validation when skipValidation is true', async() => {
      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated'
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall.mockResolvedValue(mockDeploymentResponse);

      await deployEnvironment(envKey, {
        controller: controllerUrl,
        skipValidation: true,
        noPoll: true
      });

      // Validation should still be called (it validates format, not existence)
      expect(validateEnvironmentKey).toHaveBeenCalled();
      expect(validateControllerUrl).toHaveBeenCalled();
    });

    it('should throw error when envKey is missing', async() => {
      await expect(deployEnvironment('', { controller: 'http://localhost:3000' }))
        .rejects.toThrow('Environment key is required');
    });

    it('should throw error when envKey is not a string', async() => {
      await expect(deployEnvironment(null, { controller: 'http://localhost:3000' }))
        .rejects.toThrow('Environment key is required');
    });

    it('should throw error when controller URL is missing', async() => {
      await expect(deployEnvironment('dev', {}))
        .rejects.toThrow('Controller URL is required');
    });

    it('should throw error when device token is not available', async() => {
      getOrRefreshDeviceToken.mockResolvedValue(null);

      await expect(deployEnvironment('dev', {
        controller: 'http://localhost:3000',
        noPoll: true
      })).rejects.toThrow('Device token is required');
    });

    it('should throw error when device token has no token property', async() => {
      getOrRefreshDeviceToken.mockResolvedValue({ controller: 'http://localhost:3000' });

      await expect(deployEnvironment('dev', {
        controller: 'http://localhost:3000',
        noPoll: true
      })).rejects.toThrow('Device token is required');
    });

    it('should handle deployment API failure', async() => {
      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockErrorResponse = {
        success: false,
        formattedError: 'Deployment failed',
        error: 'API Error',
        status: 500,
        errorData: { message: 'Internal server error' }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall.mockResolvedValue(mockErrorResponse);

      await expect(deployEnvironment(envKey, {
        controller: controllerUrl,
        noPoll: true
      })).rejects.toThrow('Deployment failed');

      expect(handleDeploymentErrors).toHaveBeenCalled();
    });

    it('should handle polling timeout', async() => {
      jest.useFakeTimers({ advanceTimers: true });

      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated'
        }
      };
      const mockStatusResponse = {
        success: true,
        data: {
          status: 'pending'
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      // Mock 60 calls (maxAttempts) all returning pending status to trigger timeout
      authenticatedApiCall
        .mockResolvedValueOnce(mockDeploymentResponse)
        .mockResolvedValue(mockStatusResponse); // Always pending

      const deployPromise = deployEnvironment(envKey, {
        controller: controllerUrl,
        poll: true
      }).catch(err => err); // Catch error to prevent unhandled rejection

      // Process initial deployment
      await Promise.resolve();

      // Fast-forward through all polling attempts (60 attempts * 5000ms = 300000ms)
      jest.advanceTimersByTime(300000);
      await jest.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();

      jest.useRealTimers();

      const error = await deployPromise;
      expect(error.message).toContain('Environment deployment timeout');
    });

    it('should handle polling failure status', async() => {
      jest.useFakeTimers({ advanceTimers: true });

      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated'
        }
      };
      const mockFailedStatusResponse = {
        success: true,
        data: {
          status: 'failed',
          message: 'Deployment failed'
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall
        .mockResolvedValueOnce(mockDeploymentResponse)
        .mockResolvedValue(mockFailedStatusResponse);

      const deployPromise = deployEnvironment(envKey, {
        controller: controllerUrl,
        poll: true
      }).catch(err => err); // Catch error to prevent unhandled rejection

      // Process initial deployment
      await Promise.resolve();

      // Fast-forward through first polling attempt
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();

      jest.useRealTimers();

      const error = await deployPromise;
      expect(error.message).toContain('Environment deployment failed: Deployment failed');
    });

    it('should handle polling error status', async() => {
      jest.useFakeTimers({ advanceTimers: true });

      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated'
        }
      };
      const mockErrorStatusResponse = {
        success: true,
        data: {
          status: 'error',
          message: 'Error occurred'
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall
        .mockResolvedValueOnce(mockDeploymentResponse)
        .mockResolvedValue(mockErrorStatusResponse);

      const deployPromise = deployEnvironment(envKey, {
        controller: controllerUrl,
        poll: true
      }).catch(err => err); // Catch error to prevent unhandled rejection

      // Process initial deployment
      await Promise.resolve();

      // Fast-forward through first polling attempt
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();

      jest.useRealTimers();

      const error = await deployPromise;
      expect(error.message).toContain('Environment deployment failed: Error occurred');
    });

    it('should handle completed status in polling', async() => {
      jest.useFakeTimers({ advanceTimers: true });

      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated'
        }
      };
      const mockCompletedStatusResponse = {
        success: true,
        data: {
          status: 'completed',
          ready: true
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall
        .mockResolvedValueOnce(mockDeploymentResponse)
        .mockResolvedValue(mockCompletedStatusResponse);

      const deployPromise = deployEnvironment(envKey, {
        controller: controllerUrl,
        poll: true
      });

      // Process initial deployment
      await Promise.resolve();

      // Fast-forward through first polling attempt
      jest.advanceTimersByTime(5000);
      await jest.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();

      jest.useRealTimers();

      const result = await deployPromise;
      expect(result.status).toBe('ready');
    });

    it('should handle polling API errors gracefully', async() => {
      jest.useFakeTimers({ advanceTimers: true });

      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated'
        }
      };
      const mockStatusResponse = {
        success: true,
        data: {
          status: 'pending'
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall
        .mockResolvedValueOnce(mockDeploymentResponse)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockStatusResponse); // Subsequent calls succeed but pending

      const deployPromise = deployEnvironment(envKey, {
        controller: controllerUrl,
        poll: true
      }).catch(err => err); // Catch error to prevent unhandled rejection

      // Process initial deployment
      await Promise.resolve();

      // Fast-forward through all polling attempts
      jest.advanceTimersByTime(300000);
      await jest.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();

      jest.useRealTimers();

      // Should continue polling despite error and eventually timeout
      const error = await deployPromise;
      expect(error.message).toContain('Environment deployment timeout');
    });

    it('should use controller-url option alias', async() => {
      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated'
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall.mockResolvedValue(mockDeploymentResponse);

      await deployEnvironment(envKey, {
        'controller-url': controllerUrl,
        noPoll: true
      });

      expect(validateControllerUrl).toHaveBeenCalledWith(controllerUrl);
    });

    it('should display deployment results correctly', async() => {
      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          deploymentId: 'deploy-123',
          status: 'initiated',
          url: `${controllerUrl}/environments/${envKey}`
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall.mockResolvedValue(mockDeploymentResponse);

      await deployEnvironment(envKey, {
        controller: controllerUrl,
        noPoll: true
      });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Environment deployed successfully'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(envKey));
    });

    it('should handle missing deploymentId in response', async() => {
      const envKey = 'dev';
      const controllerUrl = 'http://localhost:3000';
      const mockToken = {
        token: 'test-token',
        controller: controllerUrl
      };
      const mockDeploymentResponse = {
        success: true,
        data: {
          status: 'initiated'
          // No deploymentId
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      authenticatedApiCall.mockResolvedValue(mockDeploymentResponse);

      const result = await deployEnvironment(envKey, {
        controller: controllerUrl,
        noPoll: true
      });

      expect(result).toMatchObject({
        success: true,
        environment: envKey
      });
      // Should not poll if no deploymentId
      expect(authenticatedApiCall).toHaveBeenCalledTimes(1);
    });
  });
});

