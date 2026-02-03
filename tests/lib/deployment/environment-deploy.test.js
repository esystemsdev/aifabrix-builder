/**
 * Tests for AI Fabrix Builder Environment Deployment Module
 *
 * @fileoverview Unit tests for environment-deploy.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');

const FIXTURE_CONFIG = path.resolve(__dirname, '../../fixtures/environment-deploy-config.json');

jest.mock('fs', () => {
  const realFs = jest.requireActual('fs');
  const configFixture = JSON.stringify({
    environmentConfig: {
      key: 'dev',
      environment: 'dev',
      preset: 's',
      serviceName: 'aifabrix',
      location: 'swedencentral'
    },
    dryRun: false
  });
  const isConfigPath = (p) => typeof p === 'string' && (p.endsWith('environment-deploy-config.json') || p.includes('environment-deploy-config.json'));
  return {
    ...realFs,
    existsSync: (p) => (isConfigPath(p) ? true : realFs.existsSync(p)),
    readFileSync: (p, enc) => (isConfigPath(p) ? configFixture : realFs.readFileSync(p, enc))
  };
});

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

jest.mock('../../../lib/utils/controller-url', () => ({
  resolveControllerUrl: jest.fn()
}));

jest.mock('../../../lib/utils/deployment-validation', () => ({
  validateControllerUrl: jest.fn((url) => url),
  validateEnvironmentKey: jest.fn((key) => key)
}));

jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));

jest.mock('../../../lib/api/deployments.api', () => ({
  deployEnvironment: jest.fn()
}));

jest.mock('../../../lib/api/environments.api', () => ({
  getEnvironmentStatus: jest.fn()
}));

jest.mock('../../../lib/api/pipeline.api', () => ({
  getPipelineDeployment: jest.fn()
}));

jest.mock('../../../lib/utils/deployment-errors', () => ({
  handleDeploymentErrors: jest.fn().mockResolvedValue()
}));

jest.mock('../../../lib/core/audit-logger', () => ({
  logDeploymentAttempt: jest.fn().mockResolvedValue()
}));

const logger = require('../../../lib/utils/logger');
const config = require('../../../lib/core/config');
const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
const { validateControllerUrl, validateEnvironmentKey } = require('../../../lib/utils/deployment-validation');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const deploymentsApi = require('../../../lib/api/deployments.api');
const environmentsApi = require('../../../lib/api/environments.api');
const pipelineApi = require('../../../lib/api/pipeline.api');
const { handleDeploymentErrors } = require('../../../lib/utils/deployment-errors');
const auditLogger = require('../../../lib/core/audit-logger');
const { deployEnvironment } = require('../../../lib/deployment/environment');

describe('Environment Deployment Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveControllerUrl.mockResolvedValue('http://localhost:3000');
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
      const mockDeploymentRecord = { status: 'completed', ready: true, progress: 100 };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      deploymentsApi.deployEnvironment.mockResolvedValueOnce(mockDeploymentResponse); // Initial deployment
      pipelineApi.getPipelineDeployment.mockResolvedValue({ data: mockDeploymentRecord }); // Polling: GET .../deployments/:id returns { data: deployment }

      const deployPromise = deployEnvironment(envKey, { config: FIXTURE_CONFIG, poll: true });

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
      expect(deploymentsApi.deployEnvironment).toHaveBeenCalled();
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
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);

      const result = await deployEnvironment(envKey, { config: FIXTURE_CONFIG, noPoll: true });

      expect(result).toMatchObject({
        success: true,
        environment: envKey
      });
      // Should only call once for deployment, not for polling
      expect(deploymentsApi.deployEnvironment).toHaveBeenCalledTimes(1);
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
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);

      const result = await deployEnvironment(envKey, {
        config: FIXTURE_CONFIG,
        noPoll: true
      });

      expect(result).toMatchObject({
        success: true,
        environment: envKey
      });
      expect(deploymentsApi.deployEnvironment).toHaveBeenCalledWith(
        expect.any(String),
        envKey,
        expect.objectContaining({ token: mockToken.token }),
        expect.objectContaining({
          environmentConfig: expect.objectContaining({
            key: 'dev',
            environment: 'dev',
            preset: 's',
            serviceName: 'aifabrix',
            location: 'swedencentral'
          }),
          dryRun: false
        })
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
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);

      await deployEnvironment(envKey, {
        config: FIXTURE_CONFIG,
        skipValidation: true,
        noPoll: true
      });

      // Validation should still be called (it validates format, not existence)
      expect(validateEnvironmentKey).toHaveBeenCalled();
      expect(validateControllerUrl).toHaveBeenCalled();
    });

    it('should throw error when envKey is missing', async() => {
      await expect(deployEnvironment('', {}))
        .rejects.toThrow('Environment key is required');
    });

    it('should throw error when envKey is not a string', async() => {
      await expect(deployEnvironment(null, {}))
        .rejects.toThrow('Environment key is required');
    });

    it('should throw error when controller URL is missing', async() => {
      resolveControllerUrl.mockResolvedValue(null);
      await expect(deployEnvironment('dev', {}))
        .rejects.toThrow('Controller URL is required. Run "aifabrix login" to set the controller URL in config.yaml');
    });

    it('should throw when config file is missing', async() => {
      getOrRefreshDeviceToken.mockResolvedValue({ token: 't', controller: 'http://localhost:3000' });
      await expect(deployEnvironment('dev', { noPoll: true }))
        .rejects.toThrow('Environment deploy requires a config file');
    });

    it('should throw error when device token is not available', async() => {
      getOrRefreshDeviceToken.mockResolvedValue(null);

      await expect(deployEnvironment('dev', { config: FIXTURE_CONFIG, noPoll: true })).rejects.toThrow('Device token is required');
    });

    it('should throw error when device token has no token property', async() => {
      getOrRefreshDeviceToken.mockResolvedValue({ controller: 'http://localhost:3000' });

      await expect(deployEnvironment('dev', { config: FIXTURE_CONFIG, noPoll: true })).rejects.toThrow('Device token is required');
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
      deploymentsApi.deployEnvironment.mockResolvedValue(mockErrorResponse);

      await expect(deployEnvironment(envKey, { config: FIXTURE_CONFIG, noPoll: true })).rejects.toThrow('Deployment failed');

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
      const pendingDeployment = { data: { data: { status: 'pending', progress: 0 } } };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);
      pipelineApi.getPipelineDeployment.mockReset();
      pipelineApi.getPipelineDeployment.mockResolvedValue(pendingDeployment); // Always pending -> timeout

      const deployPromise = deployEnvironment(envKey, { config: FIXTURE_CONFIG, poll: true }).catch(err => err); // Catch error to prevent unhandled rejection

      // Process initial deployment
      await Promise.resolve();

      // Run 60 polling attempts: each iteration awaits setTimeout(5000) then getPipelineDeployment
      for (let i = 0; i < 60; i++) {
        jest.advanceTimersByTime(5000);
        await jest.runAllTimersAsync();
        await Promise.resolve();
      }

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
      const mockFailedDeployment = { status: 'failed', message: 'Deployment failed' };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);
      pipelineApi.getPipelineDeployment.mockResolvedValue({ data: mockFailedDeployment });

      const deployPromise = deployEnvironment(envKey, { config: FIXTURE_CONFIG, poll: true }).catch(err => err); // Catch error to prevent unhandled rejection

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
      const mockErrorDeployment = { status: 'error', message: 'Error occurred' };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);
      pipelineApi.getPipelineDeployment.mockResolvedValue({ data: mockErrorDeployment });

      const deployPromise = deployEnvironment(envKey, { config: FIXTURE_CONFIG, poll: true }).catch(err => err); // Catch error to prevent unhandled rejection

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
        data: {
          data: {
            status: 'completed',
            progress: 100
          }
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);
      pipelineApi.getPipelineDeployment.mockResolvedValue(mockCompletedStatusResponse);

      const deployPromise = deployEnvironment(envKey, { config: FIXTURE_CONFIG, poll: true });

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
        data: {
          data: {
            status: 'pending',
            progress: 0
          }
        }
      };

      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);
      pipelineApi.getPipelineDeployment
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockStatusResponse); // Subsequent calls succeed but pending

      const deployPromise = deployEnvironment(envKey, { config: FIXTURE_CONFIG, poll: true }).catch(err => err); // Catch error to prevent unhandled rejection

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

    it('should validate controller URL from config', async() => {
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

      resolveControllerUrl.mockResolvedValue(controllerUrl);
      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);

      await deployEnvironment(envKey, { config: FIXTURE_CONFIG, noPoll: true });

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
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);

      await deployEnvironment(envKey, { config: FIXTURE_CONFIG, noPoll: true });

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
      deploymentsApi.deployEnvironment.mockResolvedValue(mockDeploymentResponse);

      const result = await deployEnvironment(envKey, { config: FIXTURE_CONFIG, noPoll: true });

      expect(result).toMatchObject({
        success: true,
        environment: envKey
      });
      // Should not poll if no deploymentId
      expect(deploymentsApi.deployEnvironment).toHaveBeenCalledTimes(1);
    });
  });
});

