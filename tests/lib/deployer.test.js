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
const authHeaders = require('../../lib/utils/auth-headers');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('deployer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBearerTokenHeaders', () => {
    it('should create headers with bearer token', () => {
      const headers = authHeaders.createBearerTokenHeaders('test-token-123');
      expect(headers['Authorization']).toBe('Bearer test-token-123');
    });

    it('should throw error when token is missing', () => {
      expect(() => {
        authHeaders.createBearerTokenHeaders('');
      }).toThrow('Authentication token is required');
    });

    it('should throw error when token is null', () => {
      expect(() => {
        authHeaders.createBearerTokenHeaders(null);
      }).toThrow('Authentication token is required');
    });
  });

  describe('createClientCredentialsHeaders', () => {
    it('should create headers with client ID and secret', () => {
      const headers = authHeaders.createClientCredentialsHeaders('test-client-id', 'test-secret');
      expect(headers['x-client-id']).toBe('test-client-id');
      expect(headers['x-client-secret']).toBe('test-secret');
    });

    it('should throw error when client ID is missing', () => {
      expect(() => {
        authHeaders.createClientCredentialsHeaders('', 'secret');
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when client secret is missing', () => {
      expect(() => {
        authHeaders.createClientCredentialsHeaders('client-id', '');
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error when both credentials are missing', () => {
      expect(() => {
        authHeaders.createClientCredentialsHeaders(null, null);
      }).toThrow('Client ID and Client Secret are required');
    });
  });

  describe('createAuthHeaders', () => {
    it('should create bearer token headers when type is bearer', () => {
      const authConfig = { type: 'bearer', token: 'test-token-123' };
      const headers = authHeaders.createAuthHeaders(authConfig);
      expect(headers['Authorization']).toBe('Bearer test-token-123');
    });

    it('should create client credentials headers when type is credentials', () => {
      const authConfig = { type: 'credentials', clientId: 'test-id', clientSecret: 'test-secret' };
      const headers = authHeaders.createAuthHeaders(authConfig);
      expect(headers['x-client-id']).toBe('test-id');
      expect(headers['x-client-secret']).toBe('test-secret');
    });

    it('should throw error when auth config is missing', () => {
      expect(() => {
        authHeaders.createAuthHeaders(null);
      }).toThrow('Authentication configuration is required');
    });

    it('should throw error when auth type is missing', () => {
      expect(() => {
        authHeaders.createAuthHeaders({});
      }).toThrow('Authentication configuration is required');
    });

    it('should throw error when bearer token is missing', () => {
      expect(() => {
        authHeaders.createAuthHeaders({ type: 'bearer' });
      }).toThrow('Bearer token is required for bearer authentication');
    });

    it('should throw error when client credentials are missing', () => {
      expect(() => {
        authHeaders.createAuthHeaders({ type: 'credentials' });
      }).toThrow('Client ID and Client Secret are required');
    });

    it('should throw error for invalid auth type', () => {
      expect(() => {
        authHeaders.createAuthHeaders({ type: 'invalid' });
      }).toThrow('Invalid authentication type');
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
    it('should send deployment request successfully with bearer token', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'test-token-123', clientId: 'test-id', clientSecret: 'test-secret' };

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
        validateToken,
        authConfig,
        { timeout: 5000 }
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should send deployment request successfully with client credentials', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'credentials', clientId: 'test-id', clientSecret: 'test-secret' };

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
        validateToken,
        authConfig,
        { timeout: 5000 }
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should use environment-aware endpoint', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'test-token-456', clientId: 'test-id', clientSecret: 'test-secret' };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true, deploymentId: 'deploy-123' }
      });

      await deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'tst',
        validateToken,
        authConfig
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://controller.example.com/api/v1/pipeline/tst/deploy',
        { validateToken: validateToken, imageTag: 'latest' },
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-client-id': 'test-id',
            'x-client-secret': 'test-secret'
          })
        })
      );
    });

    it('should include bearer token authentication headers in request', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'my-bearer-token', clientId: 'my-client-id', clientSecret: 'my-client-secret' };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true, deploymentId: 'deploy-123' }
      });

      await deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'dev',
        validateToken,
        authConfig
      );

      const callArgs = mockedAxios.post.mock.calls[0];
      const requestConfig = callArgs[2];
      expect(requestConfig.headers['x-client-id']).toBe('my-client-id');
      expect(requestConfig.headers['x-client-secret']).toBe('my-client-secret');
      expect(requestConfig.headers['Content-Type']).toBe('application/json');
      expect(requestConfig.headers['User-Agent']).toBe('aifabrix-builder/2.0.0');
    });

    it('should include client credentials authentication headers in request', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'credentials', clientId: 'my-client-id', clientSecret: 'my-client-secret' };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true, deploymentId: 'deploy-123' }
      });

      await deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'dev',
        validateToken,
        authConfig
      );

      const callArgs = mockedAxios.post.mock.calls[0];
      const requestConfig = callArgs[2];
      expect(requestConfig.headers['x-client-id']).toBe('my-client-id');
      expect(requestConfig.headers['x-client-secret']).toBe('my-client-secret');
      expect(requestConfig.headers['Content-Type']).toBe('application/json');
      expect(requestConfig.headers['User-Agent']).toBe('aifabrix-builder/2.0.0');
    });

    it('should validate environment key before sending request', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      await expect(
        deployer.sendDeploymentRequest(
          'https://controller.example.com',
          'invalid-env',
          validateToken,
          authConfig
        )
      ).rejects.toThrow('Invalid environment key');
    });

    it('should retry on transient failures', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'test-token-123', clientId: 'test-id', clientSecret: 'test-secret' };

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
        validateToken,
        authConfig,
        { timeout: 10000, maxRetries: 5 }
      );

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async() => {
      mockedAxios.post.mockRejectedValue(new Error('Always fails'));

      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      await expect(
        deployer.sendDeploymentRequest('https://controller.example.com', 'dev', validateToken, authConfig, {
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

      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      await expect(
        deployer.sendDeploymentRequest('https://controller.example.com', 'dev', validateToken, authConfig)
      ).rejects.toThrow();
    });
  });

  describe('pollDeploymentStatus', () => {
    it('should poll deployment status successfully', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          data: {
            id: 'test-deploy-123',
            status: 'completed',
            progress: 100
          },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const authConfig = { type: 'bearer', token: 'test-token-123' };
      const result = await deployer.pollDeploymentStatus(
        'test-deploy-123',
        'https://controller.example.com',
        'dev',
        authConfig,
        { interval: 100, maxAttempts: 10 }
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('test-deploy-123');
      expect(result.status).toBe('completed');
    });

    it('should use environment-aware status endpoint', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          data: { id: 'test-123', status: 'completed' },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const authConfig = { type: 'bearer', token: 'test-token-456' };
      await deployer.pollDeploymentStatus(
        'test-123',
        'https://controller.example.com',
        'pro',
        authConfig
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://controller.example.com/api/v1/pipeline/pro/deployments/test-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-456'
          })
        })
      );
    });

    it('should include authentication headers in status polling', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          data: { id: 'test-123', status: 'completed' },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const authConfig = { type: 'bearer', token: 'poll-bearer-token' };
      await deployer.pollDeploymentStatus(
        'test-123',
        'https://controller.example.com',
        'dev',
        authConfig,
        { interval: 10, maxAttempts: 1 }
      );

      const callArgs = mockedAxios.get.mock.calls[0];
      const requestConfig = callArgs[1];
      expect(requestConfig.headers['Authorization']).toBe('Bearer poll-bearer-token');
    });

    it('should support client credentials in status polling', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          data: { id: 'test-123', status: 'completed' },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const authConfig = { type: 'credentials', clientId: 'test-id', clientSecret: 'test-secret' };
      await deployer.pollDeploymentStatus(
        'test-123',
        'https://controller.example.com',
        'dev',
        authConfig,
        { interval: 10, maxAttempts: 1 }
      );

      const callArgs = mockedAxios.get.mock.calls[0];
      const requestConfig = callArgs[1];
      expect(requestConfig.headers['x-client-id']).toBe('test-id');
      expect(requestConfig.headers['x-client-secret']).toBe('test-secret');
    });

    it('should handle completed deployments', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          data: {
            id: 'test-deploy-456',
            status: 'completed',
            progress: 100
          },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const authConfig = { type: 'bearer', token: 'test-token-789' };
      const result = await deployer.pollDeploymentStatus(
        'test-deploy-456',
        'https://controller.example.com',
        'dev',
        authConfig,
        { interval: 100, maxAttempts: 5 }
      );

      expect(result.status).toBe('completed');
    });

    it('should timeout when max attempts reached', async() => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          data: {
            id: 'never-complete',
            status: 'pending',
            progress: 25
          },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const authConfig = { type: 'bearer', token: 'test-token' };
      await expect(
        deployer.pollDeploymentStatus('never-complete', 'https://controller.example.com', 'dev', authConfig, {
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

      const authConfig = { type: 'bearer', token: 'test-token' };
      await expect(
        deployer.pollDeploymentStatus('non-existent', 'https://controller.example.com', 'dev', authConfig)
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
    it('should deploy successfully with valid manifest using bearer token', async() => {
      const manifest = {
        key: 'test-app',
        displayName: 'Test App',
        image: 'test-app:latest',
        port: 3000,
        deploymentKey: 'abc123'
      };
      const authConfig = { type: 'bearer', token: 'test-token-123', clientId: 'test-id', clientSecret: 'test-secret' };

      // Mock validate endpoint
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          valid: true,
          validateToken: 'validate-token-123',
          draftDeploymentId: 'draft-123'
        }
      });

      // Mock deploy endpoint
      mockedAxios.post.mockResolvedValueOnce({
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
        authConfig,
        { poll: false }
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should deploy successfully with valid manifest using client credentials', async() => {
      const manifest = {
        key: 'test-app',
        displayName: 'Test App',
        image: 'test-app:latest',
        port: 3000,
        deploymentKey: 'abc123'
      };
      const authConfig = { type: 'credentials', clientId: 'test-id', clientSecret: 'test-secret' };

      // Mock validate endpoint
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          valid: true,
          validateToken: 'validate-token-123',
          draftDeploymentId: 'draft-123'
        }
      });

      // Mock deploy endpoint
      mockedAxios.post.mockResolvedValueOnce({
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
        authConfig,
        { poll: false }
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should use environment key in deployment endpoint', async() => {
      const manifest = {
        key: 'test-app',
        image: 'test-app:latest',
        port: 3000
      };
      const authConfig = { type: 'bearer', token: 'test-token-456', clientId: 'test-id', clientSecret: 'test-secret' };

      // Mock validate endpoint
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          valid: true,
          validateToken: 'validate-token-123'
        }
      });

      // Mock deploy endpoint
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true, deploymentId: 'deploy-123' }
      });

      await deployer.deployToController(
        manifest,
        'https://controller.example.com',
        'tst',
        authConfig,
        { poll: false }
      );

      // Check that validate was called with correct endpoint
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://controller.example.com/api/v1/pipeline/tst/validate',
        expect.objectContaining({
          applicationConfig: manifest
        }),
        expect.any(Object)
      );

      // Check that deploy was called with validateToken
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://controller.example.com/api/v1/pipeline/tst/deploy',
        expect.objectContaining({
          validateToken: 'validate-token-123',
          imageTag: 'latest'
        }),
        expect.any(Object)
      );
    });

    it('should validate and normalize environment key', async() => {
      const manifest = {
        key: 'test-app',
        image: 'test-app:latest'
      };
      const authConfig = { type: 'bearer', token: 'test-token-789', clientId: 'test-id', clientSecret: 'test-secret' };

      // Mock validate endpoint
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          valid: true,
          validateToken: 'validate-token-123'
        }
      });

      // Mock deploy endpoint
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true, deploymentId: 'deploy-123' }
      });

      await deployer.deployToController(
        manifest,
        'https://controller.example.com',
        'DEV',
        authConfig,
        { poll: false }
      );

      // Should normalize to lowercase - check validate endpoint
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://controller.example.com/api/v1/pipeline/dev/validate',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should require environment key', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token' };

      await expect(
        deployer.deployToController(manifest, 'https://controller.example.com', '', authConfig)
      ).rejects.toThrow('Environment key is required');
    });

    it('should require authentication configuration', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };

      await expect(
        deployer.deployToController(manifest, 'https://controller.example.com', 'dev', null)
      ).rejects.toThrow('Authentication configuration is required');
    });

    it('should reject HTTP URLs (except localhost)', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token' };

      await expect(
        deployer.deployToController(manifest, 'http://controller.example.com', 'dev', authConfig)
      ).rejects.toThrow('Controller URL must use HTTPS');
    });

    it('should reject invalid URLs', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token' };

      await expect(
        deployer.deployToController(manifest, 'not-a-url', 'dev', authConfig)
      ).rejects.toThrow();
    });

    it('should provide user-friendly error messages for authentication', async() => {
      const auditLogger = require('../../lib/audit-logger');
      jest.spyOn(auditLogger, 'logDeploymentFailure');

      // Mock validate endpoint returning authentication error
      mockedAxios.post.mockResolvedValueOnce({
        status: 401,
        statusText: 'Unauthorized',
        data: { error: 'Unauthorized' }
      });

      const manifest = {
        key: 'test-app',
        image: 'test-app:latest',
        deploymentKey: 'abc123'
      };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      await expect(
        deployer.deployToController(manifest, 'https://controller.example.com', 'dev', authConfig, { maxRetries: 1 })
      ).rejects.toThrow();

      expect(auditLogger.logDeploymentFailure).toHaveBeenCalled();
    });

    it('should handle validation errors', async() => {
      // Mock validate endpoint returning validation error
      mockedAxios.post.mockResolvedValueOnce({
        status: 400,
        statusText: 'Bad Request',
        data: {
          type: '/Errors/BadRequest',
          title: 'Bad Request',
          status: 400,
          detail: 'Pipeline validation failed',
          errors: [
            { field: 'validation', message: 'INVALID_APPLICATION_SCHEMA' }
          ]
        }
      });

      const manifest = {
        key: 'test-app',
        image: 'test-app:latest',
        deploymentKey: 'abc123'
      };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      await expect(
        deployer.deployToController(manifest, 'https://controller.example.com', 'dev', authConfig, { maxRetries: 1 })
      ).rejects.toThrow();
    });

    it('should handle network errors gracefully', async() => {
      const auditLogger = require('../../lib/audit-logger');
      jest.spyOn(auditLogger, 'logDeploymentFailure');

      // Mock validate endpoint failing with network error
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      });

      const manifest = {
        key: 'test-app',
        image: 'test-app:latest',
        deploymentKey: 'abc123'
      };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      await expect(
        deployer.deployToController(manifest, 'https://controller.example.com', 'dev', authConfig, { maxRetries: 1 })
      ).rejects.toThrow();

      expect(auditLogger.logDeploymentFailure).toHaveBeenCalled();
    });
  });
});
