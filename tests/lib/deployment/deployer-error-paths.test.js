/**
 * Tests for Deployer Error Paths
 *
 * @fileoverview Unit tests for deployer.js error handling paths
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('axios');
jest.mock('../../../lib/core/audit-logger');
jest.mock('../../../lib/utils/logger');
jest.mock('../../../lib/utils/auth-headers');
jest.mock('../../../lib/utils/deployment-validation');
jest.mock('../../../lib/utils/deployment-errors');
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/api/pipeline.api');

const axios = require('axios');
const deployer = require('../../../lib/deployment/deployer');
const logger = require('../../../lib/utils/logger');
const { createAuthHeaders } = require('../../../lib/utils/auth-headers');
const { validateControllerUrl, validateEnvironmentKey } = require('../../../lib/utils/deployment-validation');
const { validatePipeline, deployPipeline, getPipelineDeployment } = require('../../../lib/api/pipeline.api');
const chalk = require('chalk');

describe('Deployer Error Paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    validateControllerUrl.mockReturnValue('https://controller.example.com');
    validateEnvironmentKey.mockImplementation((key) => key);
    createAuthHeaders.mockReturnValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('validateDeployment error paths', () => {
    const tokenManager = require('../../../lib/utils/token-manager');

    beforeEach(() => {
      tokenManager.extractClientCredentials.mockResolvedValue({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });
    });

    it('should handle validation request errors', async() => {
      const url = 'https://controller.example.com';
      const envKey = 'dev';
      const manifest = { app: 'testapp', key: 'testapp' };
      const authConfig = { type: 'client-credentials' };
      const options = {};

      validatePipeline.mockResolvedValue({
        success: false,
        status: 400,
        formattedError: 'Validation request failed',
        error: 'Validation request failed'
      });

      await expect(
        deployer.validateDeployment(url, envKey, manifest, authConfig, options)
      ).rejects.toThrow('Validation request failed');
    });

    it('should handle validation retry errors', async() => {
      const url = 'https://controller.example.com';
      const envKey = 'dev';
      const manifest = { app: 'testapp' };
      const authConfig = { type: 'client-credentials', clientId: 'id', clientSecret: 'secret' };
      // Use maxRetries: 1 so it fails immediately without retrying
      const options = { maxRetries: 1 };

      const error = new Error('Network error');
      error.status = 500;
      validatePipeline.mockRejectedValue(error);

      // With maxRetries: 1, it will attempt once and then throw immediately
      await expect(
        deployer.validateDeployment(url, envKey, manifest, authConfig, options)
      ).rejects.toThrow();
    });
  });

  describe('sendDeploymentRequest', () => {
    it('should throw error when clientId is missing', async() => {
      const url = 'https://controller.example.com';
      const envKey = 'dev';
      const validateToken = 'test-token';
      const authConfig = {
        clientSecret: 'secret'
        // Missing clientId
      };
      const options = {};

      await expect(
        deployer.sendDeploymentRequest(url, envKey, validateToken, authConfig, options)
      ).rejects.toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when clientSecret is missing', async() => {
      const url = 'https://controller.example.com';
      const envKey = 'dev';
      const validateToken = 'test-token';
      const authConfig = {
        clientId: 'client-id'
        // Missing clientSecret
      };
      const options = {};

      await expect(
        deployer.sendDeploymentRequest(url, envKey, validateToken, authConfig, options)
      ).rejects.toThrow('Client ID and Client Secret are required');
    });

    it('should handle deployment request errors', async() => {
      const url = 'https://controller.example.com';
      const envKey = 'dev';
      const validateToken = 'test-token';
      const authConfig = {
        clientId: 'client-id',
        clientSecret: 'client-secret'
      };
      // Use maxRetries: 1 so it attempts once and fails immediately
      const options = { maxRetries: 1 };

      deployPipeline.mockResolvedValue({
        success: false,
        status: 400, // Use 400 instead of 500 to avoid retries (400 errors don't retry)
        formattedError: 'Deployment request failed',
        error: 'Deployment request failed'
      });

      await expect(
        deployer.sendDeploymentRequest(url, envKey, validateToken, authConfig, options)
      ).rejects.toThrow('Deployment request failed');
    });
  });

  describe('pollDeploymentStatus', () => {
    it('should throw error when deployment is not found (404)', async() => {
      const deploymentId = 'deployment-123';
      const controllerUrl = 'https://controller.example.com';
      const envKey = 'dev';
      const authConfig = {};
      const options = { interval: 1000, maxAttempts: 1 };

      getPipelineDeployment.mockResolvedValue({
        success: false,
        status: 404,
        formattedError: 'Deployment deployment-123 not found',
        error: 'Not found',
        data: null
      });

      await expect(
        deployer.pollDeploymentStatus(deploymentId, controllerUrl, envKey, authConfig, options)
      ).rejects.toThrow('Deployment deployment-123 not found');
    });

    it('should throw error on status check failure', async() => {
      const deploymentId = 'deployment-123';
      const controllerUrl = 'https://controller.example.com';
      const envKey = 'dev';
      const authConfig = {};
      const options = { interval: 1000, maxAttempts: 1 };

      getPipelineDeployment.mockResolvedValue({
        success: false,
        status: 500,
        formattedError: 'Status check failed',
        error: 'Internal server error'
      });

      await expect(
        deployer.pollDeploymentStatus(deploymentId, controllerUrl, envKey, authConfig, options)
      ).rejects.toThrow('Status check failed');
    });

    it('should throw error on timeout', async() => {
      const deploymentId = 'deployment-123';
      const controllerUrl = 'https://controller.example.com';
      const envKey = 'dev';
      const authConfig = {};
      // Use maxAttempts: 1 so it fails immediately without waiting for intervals
      const options = { interval: 5000, maxAttempts: 1 };

      // Mock status that never becomes terminal
      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
          data: {
            status: 'in-progress',
            progress: 50
          }
        }
      });

      // With maxAttempts: 1, it will check once and then timeout immediately
      await expect(
        deployer.pollDeploymentStatus(deploymentId, controllerUrl, envKey, authConfig, options)
      ).rejects.toThrow('Deployment timeout');
    });

    it('should handle network errors during polling', async() => {
      const deploymentId = 'deployment-123';
      const controllerUrl = 'https://controller.example.com';
      const envKey = 'dev';
      const authConfig = {};
      const options = { interval: 1000, maxAttempts: 1 };

      // Mock to throw error immediately, which should propagate
      getPipelineDeployment.mockRejectedValue(new Error('Network error'));

      await expect(
        deployer.pollDeploymentStatus(deploymentId, controllerUrl, envKey, authConfig, options)
      ).rejects.toThrow('Network error');
    });
  });

  describe('deployToController error paths', () => {
    const auditLogger = require('../../../lib/core/audit-logger');
    const { handleDeploymentErrors } = require('../../../lib/utils/deployment-errors');
    const tokenManager = require('../../../lib/utils/token-manager');

    beforeEach(() => {
      auditLogger.logDeploymentAttempt.mockResolvedValue();
      tokenManager.extractClientCredentials.mockResolvedValue({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });
    });

    it('should throw error when envKey is missing', async() => {
      const controllerUrl = 'https://controller.example.com';
      const manifest = { app: 'testapp', key: 'testapp' };
      const authConfig = { type: 'client-credentials' };
      const options = {};

      await expect(
        deployer.deployToController(manifest, controllerUrl, null, authConfig, options)
      ).rejects.toThrow('Environment key is required');
    });

    it('should throw error when authConfig is missing', async() => {
      const controllerUrl = 'https://controller.example.com';
      const envKey = 'dev';
      const manifest = { app: 'testapp', key: 'testapp' };
      const options = {};

      await expect(
        deployer.deployToController(manifest, controllerUrl, envKey, null, options)
      ).rejects.toThrow('Authentication configuration is required');
    });

    it('should throw error when authConfig.type is missing', async() => {
      const controllerUrl = 'https://controller.example.com';
      const envKey = 'dev';
      const manifest = { app: 'testapp', key: 'testapp' };
      const authConfig = {};
      const options = {};

      await expect(
        deployer.deployToController(manifest, controllerUrl, envKey, authConfig, options)
      ).rejects.toThrow('Authentication configuration is required');
    });

    it('should handle deployment errors', async() => {
      const controllerUrl = 'https://controller.example.com';
      const envKey = 'dev';
      const manifest = { app: 'testapp', key: 'testapp' };
      const authConfig = { type: 'client-credentials' };
      // Use maxRetries: 1 to avoid retry delays
      const options = { maxRetries: 1 };

      // Mock validateDeployment to fail immediately with a 400 error (no retries)
      const validateError = new Error('Validation failed');
      validateError.status = 400;
      jest.spyOn(deployer, 'validateDeployment').mockRejectedValue(validateError);

      // deployToController catches errors internally and calls handleDeploymentErrors
      // which re-throws, so we should expect an error
      handleDeploymentErrors.mockRejectedValue(new Error('Deployment failed'));

      await expect(
        deployer.deployToController(manifest, controllerUrl, envKey, authConfig, options)
      ).rejects.toThrow();
    });
  });
});

