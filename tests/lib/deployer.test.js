/**
 * Deployment Module Tests
 *
 * Comprehensive unit tests for the deployer module including
 * success scenarios, error handling, validation, and security.
 *
 * @fileoverview Tests for deployment functionality
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const deployer = require('../../lib/deployer');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('deployer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createClientCredentialsHeaders', () => {
    it('should create headers with client ID and secret', () => {
      const headers = deployer.createClientCredentialsHeaders('test-client-id', 'test-secret');
      expect(headers['x-client-id']).toBe('test-client-id');
      expect(headers['x-client-secret']).toBe('test-secret');
    });

    it('should throw error when client ID is missing', () => {
      expect(() => {
        deployer.createClientCredentialsHeaders('', 'secret');
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when client secret is missing', () => {
      expect(() => {
        deployer.createClientCredentialsHeaders('client-id', '');
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when both credentials are missing', () => {
      expect(() => {
        deployer.createClientCredentialsHeaders(null, null);
      }).toThrow('Client ID and Client Secret are required');
    });
  });

  describe('validateEnvironmentKey', () => {
    it('should accept valid environment keys', () => {
      const validKeys = ['dev', 'tst', 'pro', 'miso', 'DEV', 'TST', 'PRO'];
      validKeys.forEach(key => {
        expect(() => deployer.validateEnvironmentKey(key)).not.toThrow();
      });
    });

    it('should normalize environment keys to lowercase', () => {
      expect(deployer.validateEnvironmentKey('DEV')).toBe('dev');
      expect(deployer.validateEnvironmentKey('TST')).toBe('tst');
      expect(deployer.validateEnvironmentKey('PRO')).toBe('pro');
    });

    it('should reject invalid environment keys', () => {
      const invalidKeys = ['prod', 'development', 'test', 'invalid', ''];
      invalidKeys.forEach(key => {
        expect(() => deployer.validateEnvironmentKey(key)).toThrow();
      });
    });

    it('should reject null or undefined environment keys', () => {
      expect(() => deployer.validateEnvironmentKey(null)).toThrow();
      expect(() => deployer.validateEnvironmentKey(undefined)).toThrow();
    });
  });

  describe('validateControllerUrl', () => {
    it('should accept valid HTTPS URLs', () => {
      const validUrls = [
        'https://controller.example.com',
        'https://controller.example.com/',
        'https://controller.example.com:8443',
        'https://subdomain.controller.example.com'
      ];

      validUrls.forEach(url => {
        expect(() => deployer.validateControllerUrl(url)).not.toThrow();
      });
    });

    it('should reject HTTP URLs', () => {
      const invalidUrls = [
        'http://controller.example.com',
        'http://controller.example.com/'
      ];

      invalidUrls.forEach(url => {
        expect(() => deployer.validateControllerUrl(url)).toThrow();
      });
    });

    it('should reject invalid URL formats', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://controller.example.com',
        'controller.example.com',
        '',
        null,
        undefined
      ];

      invalidUrls.forEach(url => {
        expect(() => deployer.validateControllerUrl(url)).toThrow();
      });
    });

    it('should trim trailing slashes', () => {
      const url = deployer.validateControllerUrl('https://controller.example.com/');
      expect(url).toBe('https://controller.example.com');
    });
  });

  describe('sendDeploymentRequest', () => {
    it('should send deployment request successfully', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest', port: 3000 };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          deploymentId: 'deploy-123'
        }
      });

      const result = await deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'dev',
        manifest,
        'test-client-id',
        'test-client-secret',
        { timeout: 5000 }
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should use environment-aware endpoint', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true, deploymentId: 'deploy-123' }
      });

      await deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'tst',
        manifest,
        'client-id',
        'secret'
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://controller.example.com/api/pipeline/tst/deploy',
        manifest,
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-client-id': 'client-id',
            'x-client-secret': 'secret'
          })
        })
      );
    });

    it('should include authentication headers in request', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true, deploymentId: 'deploy-123' }
      });

      await deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'dev',
        manifest,
        'my-client-id',
        'my-client-secret'
      );

      const callArgs = mockedAxios.post.mock.calls[0];
      const requestConfig = callArgs[2];
      expect(requestConfig.headers['x-client-id']).toBe('my-client-id');
      expect(requestConfig.headers['x-client-secret']).toBe('my-client-secret');
      expect(requestConfig.headers['Content-Type']).toBe('application/json');
      expect(requestConfig.headers['User-Agent']).toBe('aifabrix-builder/2.0.0');
    });

    it('should validate environment key before sending request', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };

      await expect(
        deployer.sendDeploymentRequest(
          'https://controller.example.com',
          'invalid-env',
          manifest,
          'client-id',
          'secret'
        )
      ).rejects.toThrow('Invalid environment key');
    });

    it('should retry on transient failures', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };

      mockedAxios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true, deploymentId: 'deploy-123' }
        });

      const result = await deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'dev',
        manifest,
        'test-client-id',
        'test-client-secret',
        { timeout: 10000, maxRetries: 5 }
      );

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async() => {
      mockedAxios.post.mockRejectedValue(new Error('Always fails'));

      const manifest = { key: 'test-app', image: 'test-app:latest' };

      await expect(
        deployer.sendDeploymentRequest('https://controller.example.com', 'dev', manifest, 'client-id', 'secret', {
          timeout: 1000,
          maxRetries: 2
        })
      ).rejects.toThrow();
    });

    it('should handle 400 errors', async() => {
      mockedAxios.post.mockResolvedValue({
        status: 400,
        statusText: 'Bad Request',
        data: { error: 'Invalid manifest' }
      });

      const manifest = { key: 'test-app' };

      await expect(
        deployer.sendDeploymentRequest('https://controller.example.com', 'dev', manifest, 'client-id', 'secret')
      ).rejects.toThrow();
    });
  });

  describe('pollDeploymentStatus', () => {
    it('should poll deployment status successfully', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          deploymentId: 'test-deploy-123',
          status: 'completed',
          progress: 100
        }
      });

      const result = await deployer.pollDeploymentStatus(
        'test-deploy-123',
        'https://controller.example.com',
        'dev',
        'test-client-id',
        'test-client-secret',
        { interval: 100, maxAttempts: 10 }
      );

      expect(result).toBeDefined();
      expect(result.deploymentId).toBe('test-deploy-123');
      expect(result.status).toBe('completed');
    });

    it('should use environment-aware status endpoint', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { deploymentId: 'test-123', status: 'completed' }
      });

      await deployer.pollDeploymentStatus(
        'test-123',
        'https://controller.example.com',
        'pro',
        'client-id',
        'secret'
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://controller.example.com/api/environments/pro/deployments/test-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-client-id': 'client-id',
            'x-client-secret': 'secret'
          })
        })
      );
    });

    it('should include authentication headers in status polling', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { deploymentId: 'test-123', status: 'completed' }
      });

      await deployer.pollDeploymentStatus(
        'test-123',
        'https://controller.example.com',
        'dev',
        'poll-client-id',
        'poll-secret',
        { interval: 10, maxAttempts: 1 }
      );

      const callArgs = mockedAxios.get.mock.calls[0];
      const requestConfig = callArgs[1];
      expect(requestConfig.headers['x-client-id']).toBe('poll-client-id');
      expect(requestConfig.headers['x-client-secret']).toBe('poll-secret');
    });

    it('should handle completed deployments', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          deploymentId: 'test-deploy-456',
          status: 'completed',
          progress: 100
        }
      });

      const result = await deployer.pollDeploymentStatus(
        'test-deploy-456',
        'https://controller.example.com',
        'dev',
        'test-client-id',
        'test-client-secret',
        { interval: 100, maxAttempts: 5 }
      );

      expect(result.status).toBe('completed');
    });

    it('should timeout when max attempts reached', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          deploymentId: 'never-complete',
          status: 'pending',
          progress: 25
        }
      });

      await expect(
        deployer.pollDeploymentStatus('never-complete', 'https://controller.example.com', 'dev', 'client-id', 'secret', {
          interval: 50,
          maxAttempts: 3
        })
      ).rejects.toThrow();
    });

    it('should handle 404 errors', async() => {
      mockedAxios.get.mockRejectedValue({
        response: { status: 404 },
        message: 'Not found'
      });

      await expect(
        deployer.pollDeploymentStatus('non-existent', 'https://controller.example.com', 'dev', 'client-id', 'secret')
      ).rejects.toThrow();
    });
  });

  describe('handleDeploymentError', () => {
    it('should mask sensitive data in error messages', () => {
      const error = new Error('password=secret123');
      const handled = deployer.handleDeploymentError(error);

      expect(handled.message).not.toContain('secret123');
      expect(handled.message).toContain('***');
    });

    it('should preserve error codes', () => {
      const error = new Error('Test error');
      error.code = 'ECONNREFUSED';

      const handled = deployer.handleDeploymentError(error);
      expect(handled.code).toBe('ECONNREFUSED');
      expect(handled.timeout).toBe(false);
    });

    it('should detect timeout errors', () => {
      const error = new Error('timeout');
      error.code = 'ECONNABORTED';

      const handled = deployer.handleDeploymentError(error);
      expect(handled.timeout).toBe(true);
    });
  });

  describe('deployToController', () => {
    it('should deploy successfully with valid manifest', async() => {
      const manifest = {
        key: 'test-app',
        displayName: 'Test App',
        image: 'test-app:latest',
        port: 3000,
        deploymentKey: 'abc123'
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          deploymentId: 'deploy-123',
          deploymentUrl: 'https://app.example.com/test-app'
        }
      });

      const result = await deployer.deployToController(
        manifest,
        'https://controller.example.com',
        'dev',
        'test-client-id',
        'test-client-secret',
        { poll: false }
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should use environment key in deployment endpoint', async() => {
      const manifest = {
        key: 'test-app',
        image: 'test-app:latest',
        port: 3000
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true, deploymentId: 'deploy-123' }
      });

      await deployer.deployToController(
        manifest,
        'https://controller.example.com',
        'tst',
        'client-id',
        'secret',
        { poll: false }
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://controller.example.com/api/pipeline/tst/deploy',
        manifest,
        expect.any(Object)
      );
    });

    it('should validate and normalize environment key', async() => {
      const manifest = {
        key: 'test-app',
        image: 'test-app:latest'
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true, deploymentId: 'deploy-123' }
      });

      await deployer.deployToController(
        manifest,
        'https://controller.example.com',
        'DEV',
        'client-id',
        'secret',
        { poll: false }
      );

      // Should normalize to lowercase
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://controller.example.com/api/pipeline/dev/deploy',
        manifest,
        expect.any(Object)
      );
    });

    it('should require environment key', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };

      await expect(
        deployer.deployToController(manifest, 'https://controller.example.com', '', 'client-id', 'secret')
      ).rejects.toThrow('Environment key is required');
    });

    it('should require client credentials', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };

      await expect(
        deployer.deployToController(manifest, 'https://controller.example.com', 'dev', '', '')
      ).rejects.toThrow('Client ID and Client Secret are required');
    });

    it('should reject HTTP URLs (except localhost)', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };

      await expect(
        deployer.deployToController(manifest, 'http://controller.example.com', 'dev', 'client-id', 'secret')
      ).rejects.toThrow('Controller URL must use HTTPS');
    });

    it('should reject invalid URLs', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };

      await expect(
        deployer.deployToController(manifest, 'not-a-url', 'dev', 'client-id', 'secret')
      ).rejects.toThrow();
    });

    it('should provide user-friendly error messages for authentication', async() => {
      const auditLogger = require('../../lib/audit-logger');
      jest.spyOn(auditLogger, 'logDeploymentFailure');

      mockedAxios.post.mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        data: { error: 'Unauthorized' }
      });

      const manifest = {
        key: 'test-app',
        image: 'test-app:latest',
        deploymentKey: 'abc123'
      };

      await expect(
        deployer.deployToController(manifest, 'https://controller.example.com', 'dev', 'client-id', 'secret', { maxRetries: 1 })
      ).rejects.toThrow();

      expect(auditLogger.logDeploymentFailure).toHaveBeenCalled();
    });

    it('should handle validation errors', async() => {
      mockedAxios.post.mockResolvedValue({
        status: 400,
        statusText: 'Bad Request',
        data: { error: 'Invalid manifest' }
      });

      const manifest = {
        key: 'test-app',
        image: 'test-app:latest',
        deploymentKey: 'abc123'
      };

      await expect(
        deployer.deployToController(manifest, 'https://controller.example.com', 'dev', 'client-id', 'secret', { maxRetries: 1 })
      ).rejects.toThrow();
    });

    it('should handle network errors gracefully', async() => {
      const auditLogger = require('../../lib/audit-logger');
      jest.spyOn(auditLogger, 'logDeploymentFailure');

      mockedAxios.post.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      });

      const manifest = {
        key: 'test-app',
        image: 'test-app:latest',
        deploymentKey: 'abc123'
      };

      await expect(
        deployer.deployToController(manifest, 'https://controller.example.com', 'dev', 'client-id', 'secret', { maxRetries: 1 })
      ).rejects.toThrow();

      expect(auditLogger.logDeploymentFailure).toHaveBeenCalled();
    });
  });
});
