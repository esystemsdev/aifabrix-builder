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
jest.mock('../../lib/api/pipeline.api');
jest.mock('../../lib/utils/token-manager');
jest.mock('../../lib/utils/deployment-validation');

const mockedAxios = axios;
const { deployPipeline, getPipelineDeployment, validatePipeline } = require('../../lib/api/pipeline.api');
const tokenManager = require('../../lib/utils/token-manager');
const { validateEnvironmentKey, validateControllerUrl } = require('../../lib/utils/deployment-validation');

describe('deployer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Use fake timers for retry tests
    jest.useFakeTimers();
    // Mock validateEnvironmentKey by default (will be restored in specific test suites)
    validateEnvironmentKey.mockImplementation((key) => key);
    // Mock validateControllerUrl by default (will be restored in specific test suites)
    validateControllerUrl.mockReturnValue('https://controller.example.com');
    tokenManager.extractClientCredentials.mockResolvedValue({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret'
    });
  });

  afterEach(() => {
    jest.useRealTimers();
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
    beforeEach(() => {
      // Use real implementation for these tests
      const realValidation = jest.requireActual('../../lib/utils/deployment-validation');
      validateEnvironmentKey.mockImplementation(realValidation.validateEnvironmentKey);
    });

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
    beforeEach(() => {
      // Use real implementation for these tests
      const realValidation = jest.requireActual('../../lib/utils/deployment-validation');
      validateControllerUrl.mockImplementation(realValidation.validateControllerUrl);
    });

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

      deployPipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            deploymentId: 'deploy-123'
          }
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
      expect(result.deploymentId).toBe('deploy-123');
      expect(deployPipeline).toHaveBeenCalled();
    });

    it('should send deployment request successfully with client credentials', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'credentials', clientId: 'test-id', clientSecret: 'test-secret' };

      deployPipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            deploymentId: 'deploy-123'
          }
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
      expect(result.deploymentId).toBe('deploy-123');
      expect(deployPipeline).toHaveBeenCalled();
    });

    it('should use environment-aware endpoint', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'test-token-456', clientId: 'test-id', clientSecret: 'test-secret' };

      deployPipeline.mockResolvedValue({
        success: true,
        data: { data: { deploymentId: 'deploy-123' } }
      });

      await deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'tst',
        validateToken,
        authConfig
      );

      expect(deployPipeline).toHaveBeenCalledWith(
        'https://controller.example.com',
        'tst',
        expect.objectContaining({
          type: 'client-credentials',
          clientId: 'test-id',
          clientSecret: 'test-secret'
        }),
        { validateToken: validateToken, imageTag: 'latest' }
      );
    });

    it('should include bearer token authentication headers in request', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'my-bearer-token', clientId: 'my-client-id', clientSecret: 'my-client-secret' };

      deployPipeline.mockResolvedValue({
        success: true,
        data: { data: { deploymentId: 'deploy-123' } }
      });

      await deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'dev',
        validateToken,
        authConfig
      );

      expect(deployPipeline).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        expect.objectContaining({
          type: 'client-credentials',
          clientId: 'my-client-id',
          clientSecret: 'my-client-secret'
        }),
        expect.any(Object)
      );
    });

    it('should include client credentials authentication headers in request', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'credentials', clientId: 'my-client-id', clientSecret: 'my-client-secret' };

      deployPipeline.mockResolvedValue({
        success: true,
        data: { data: { deploymentId: 'deploy-123' } }
      });

      await deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'dev',
        validateToken,
        authConfig
      );

      expect(deployPipeline).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        expect.objectContaining({
          type: 'client-credentials',
          clientId: 'my-client-id',
          clientSecret: 'my-client-secret'
        }),
        expect.any(Object)
      );
    });

    it('should validate environment key before sending request', async() => {
      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      // Use real implementation for this test
      const realValidation = jest.requireActual('../../lib/utils/deployment-validation');
      validateEnvironmentKey.mockImplementation(realValidation.validateEnvironmentKey);

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

      const error1 = new Error('Network error');
      error1.status = 500;
      const error2 = new Error('Network error');
      error2.status = 500;

      deployPipeline
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValueOnce({
          success: true,
          data: { data: { deploymentId: 'deploy-123' } }
        });

      const resultPromise = deployer.sendDeploymentRequest(
        'https://controller.example.com',
        'dev',
        validateToken,
        authConfig,
        { timeout: 10000, maxRetries: 5 }
      );

      // Advance timers to skip retry delays
      await jest.runAllTimersAsync();
      await Promise.resolve();

      const result = await resultPromise;

      expect(result.deploymentId).toBe('deploy-123');
      expect(deployPipeline).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async() => {
      const error = new Error('Always fails');
      error.status = 500;
      deployPipeline.mockRejectedValue(error);

      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      // Start the promise but don't await it yet
      const resultPromise = deployer.sendDeploymentRequest('https://controller.example.com', 'dev', validateToken, authConfig, {
        timeout: 100,
        maxRetries: 2
      });

      // Let API call execute (first attempt fails)
      await Promise.resolve();

      // Advance timer for first retry delay (1000ms)
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      // Let second API call execute (second attempt fails)
      await Promise.resolve();

      // Advance timer for second retry delay (2000ms)
      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      // Let final error be thrown
      await Promise.resolve();

      await expect(resultPromise).rejects.toThrow();
    });

    it('should handle 400 errors', async() => {
      deployPipeline.mockResolvedValue({
        success: false,
        status: 400,
        formattedError: 'Invalid manifest',
        error: 'Bad Request',
        data: { error: 'Invalid manifest' }
      });

      const validateToken = 'validate-token-123';
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      const resultPromise = deployer.sendDeploymentRequest('https://controller.example.com', 'dev', validateToken, authConfig, {
        timeout: 100,
        maxRetries: 1
      });

      // Let API call complete
      await Promise.resolve();

      // 400 errors don't retry, so no need to advance timers
      await expect(resultPromise).rejects.toThrow();
    });
  });

  describe('pollDeploymentStatus', () => {
    it('should poll deployment status successfully', async() => {
      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
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
      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
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

      expect(getPipelineDeployment).toHaveBeenCalledWith(
        'https://controller.example.com',
        'pro',
        'test-123',
        expect.objectContaining({
          type: 'bearer',
          token: 'test-token-456'
        })
      );
    });

    it('should include authentication headers in status polling', async() => {
      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
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

      expect(getPipelineDeployment).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        'test-123',
        expect.objectContaining({
          type: 'bearer',
          token: 'poll-bearer-token'
        })
      );
    });

    it('should support client credentials in status polling', async() => {
      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
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

      expect(getPipelineDeployment).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        'test-123',
        expect.objectContaining({
          type: 'client-credentials',
          clientId: 'test-id',
          clientSecret: 'test-secret'
        })
      );
    });

    it('should handle completed deployments', async() => {
      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
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
      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
          data: {
            id: 'never-complete',
            status: 'pending',
            progress: 25
          },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const authConfig = { type: 'bearer', token: 'test-token' };
      // Start the promise but don't await it yet
      const resultPromise = deployer.pollDeploymentStatus('never-complete', 'https://controller.example.com', 'dev', authConfig, {
        interval: 50,
        maxAttempts: 3
      });

      // First poll (attempt 0)
      await Promise.resolve();

      // Advance timer for first interval (50ms)
      jest.advanceTimersByTime(50);
      await Promise.resolve();

      // Second poll (attempt 1)
      await Promise.resolve();

      // Advance timer for second interval (50ms)
      jest.advanceTimersByTime(50);
      await Promise.resolve();

      // Third poll (attempt 2) - last attempt before timeout
      await Promise.resolve();

      // After 3 attempts, it should throw timeout error
      await Promise.resolve();

      await expect(resultPromise).rejects.toThrow('Deployment timeout: Maximum polling attempts reached');
    });

    it('should handle 404 errors', async() => {
      getPipelineDeployment.mockResolvedValue({
        success: false,
        status: 404,
        formattedError: 'Deployment non-existent not found',
        error: 'Not found'
      });

      const authConfig = { type: 'bearer', token: 'test-token' };
      await expect(
        deployer.pollDeploymentStatus('non-existent', 'https://controller.example.com', 'dev', authConfig)
      ).rejects.toThrow('Deployment non-existent not found');
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
      validatePipeline.mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'validate-token-123',
            draftDeploymentId: 'draft-123'
          }
        }
      });

      // Mock deploy endpoint
      deployPipeline.mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            deploymentId: 'deploy-123',
            deploymentUrl: 'https://app.example.com/test-app'
          }
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
      expect(result.deploymentId).toBe('deploy-123');
      expect(validatePipeline).toHaveBeenCalled();
      expect(deployPipeline).toHaveBeenCalled();
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
      validatePipeline.mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'validate-token-123',
            draftDeploymentId: 'draft-123'
          }
        }
      });

      // Mock deploy endpoint
      deployPipeline.mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            deploymentId: 'deploy-123',
            deploymentUrl: 'https://app.example.com/test-app'
          }
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
      expect(result.deploymentId).toBe('deploy-123');
      expect(validatePipeline).toHaveBeenCalled();
      expect(deployPipeline).toHaveBeenCalled();
    });

    it('should use environment key in deployment endpoint', async() => {
      const manifest = {
        key: 'test-app',
        image: 'test-app:latest',
        port: 3000
      };
      const authConfig = { type: 'bearer', token: 'test-token-456', clientId: 'test-id', clientSecret: 'test-secret' };

      // Mock validate endpoint
      validatePipeline.mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'validate-token-123'
          }
        }
      });

      // Mock deploy endpoint
      deployPipeline.mockResolvedValueOnce({
        success: true,
        data: {
          data: { deploymentId: 'deploy-123' }
        }
      });

      await deployer.deployToController(
        manifest,
        'https://controller.example.com',
        'tst',
        authConfig,
        { poll: false }
      );

      // Check that validate was called with correct environment
      expect(validatePipeline).toHaveBeenCalledWith(
        'https://controller.example.com',
        'tst',
        expect.any(Object),
        expect.objectContaining({
          applicationConfig: manifest
        })
      );

      // Check that deploy was called with validateToken
      expect(deployPipeline).toHaveBeenCalledWith(
        'https://controller.example.com',
        'tst',
        expect.any(Object),
        expect.objectContaining({
          validateToken: 'validate-token-123',
          imageTag: 'latest'
        })
      );
    });

    it('should validate and normalize environment key', async() => {
      // Use real implementation for this test to ensure normalization
      const realValidation = jest.requireActual('../../lib/utils/deployment-validation');
      validateEnvironmentKey.mockImplementation(realValidation.validateEnvironmentKey);

      const manifest = {
        key: 'test-app',
        image: 'test-app:latest'
      };
      const authConfig = { type: 'bearer', token: 'test-token-789', clientId: 'test-id', clientSecret: 'test-secret' };

      // Mock validate endpoint
      validatePipeline.mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'validate-token-123'
          }
        }
      });

      // Mock deploy endpoint
      deployPipeline.mockResolvedValueOnce({
        success: true,
        data: {
          data: { deploymentId: 'deploy-123' }
        }
      });

      await deployer.deployToController(
        manifest,
        'https://controller.example.com',
        'DEV',
        authConfig,
        { poll: false }
      );

      // Should normalize to lowercase - check validate endpoint was called with 'dev'
      expect(validatePipeline).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
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
      // Restore real implementation for this test
      const realValidation = jest.requireActual('../../lib/utils/deployment-validation');
      validateControllerUrl.mockImplementation(realValidation.validateControllerUrl);

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

  describe('validateDeployment', () => {
    it('should validate deployment successfully', async() => {
      const manifest = {
        key: 'test-app',
        displayName: 'Test App',
        image: 'test-app:latest',
        port: 3000
      };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      validatePipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'validate-token-123',
            draftDeploymentId: 'draft-123',
            imageServer: 'myacr.azurecr.io',
            imageUsername: 'user',
            imagePassword: 'pass',
            expiresAt: '2024-12-31T23:59:59Z'
          }
        }
      });

      const result = await deployer.validateDeployment(
        'https://controller.example.com',
        'dev',
        manifest,
        authConfig
      );

      expect(result.success).toBe(true);
      expect(result.validateToken).toBe('validate-token-123');
      expect(result.draftDeploymentId).toBe('draft-123');
      expect(validatePipeline).toHaveBeenCalled();
    });

    it('should handle validation response with nested data structure', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      validatePipeline.mockResolvedValue({
        success: true,
        data: {
          valid: true,
          validateToken: 'token-456'
        }
      });

      const result = await deployer.validateDeployment(
        'https://controller.example.com',
        'dev',
        manifest,
        authConfig
      );

      expect(result.success).toBe(true);
      expect(result.validateToken).toBe('token-456');
    });

    it('should use custom repository URL when provided', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      validatePipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'token-789'
          }
        }
      });

      await deployer.validateDeployment(
        'https://controller.example.com',
        'dev',
        manifest,
        authConfig,
        { repositoryUrl: 'https://github.com/custom/repo' }
      );

      expect(validatePipeline).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        expect.any(Object),
        expect.objectContaining({
          repositoryUrl: 'https://github.com/custom/repo'
        })
      );
    });

    it('should use default repository URL when not provided', async() => {
      const manifest = { key: 'my-app', image: 'my-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      validatePipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'token-default'
          }
        }
      });

      await deployer.validateDeployment(
        'https://controller.example.com',
        'dev',
        manifest,
        authConfig
      );

      expect(validatePipeline).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        expect.any(Object),
        expect.objectContaining({
          repositoryUrl: 'https://github.com/aifabrix/my-app'
        })
      );
    });

    it('should retry on 500 errors', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      const error500 = new Error('Server error');
      error500.status = 500;

      validatePipeline
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce({
          success: true,
          data: {
            data: {
              valid: true,
              validateToken: 'token-retry'
            }
          }
        });

      const resultPromise = deployer.validateDeployment(
        'https://controller.example.com',
        'dev',
        manifest,
        authConfig,
        { maxRetries: 3 }
      );

      // Run all pending timers and wait for promises to resolve
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.validateToken).toBe('token-retry');
      expect(validatePipeline).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 errors', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      validatePipeline.mockResolvedValue({
        success: false,
        status: 400,
        formattedError: 'Invalid manifest',
        error: 'Bad Request',
        data: { error: 'Invalid manifest' }
      });

      await expect(
        deployer.validateDeployment(
          'https://controller.example.com',
          'dev',
          manifest,
          authConfig,
          { maxRetries: 3 }
        )
      ).rejects.toThrow('Validation request failed');

      expect(validatePipeline).toHaveBeenCalledTimes(1);
    });

    it('should throw error when validation fails after max retries', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      const error500 = new Error('Server error');
      error500.status = 500;
      validatePipeline.mockRejectedValue(error500);

      const resultPromise = deployer.validateDeployment(
        'https://controller.example.com',
        'dev',
        manifest,
        authConfig,
        { maxRetries: 2 }
      );

      await Promise.resolve();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      await expect(resultPromise).rejects.toThrow('Server error');
      expect(validatePipeline).toHaveBeenCalledTimes(2);
    });

    it('should throw error when valid is false', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      validatePipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            valid: false,
            errors: ['Invalid configuration']
          }
        }
      });

      await expect(
        deployer.validateDeployment(
          'https://controller.example.com',
          'dev',
          manifest,
          authConfig,
          { maxRetries: 1 }
        )
      ).rejects.toThrow();
    });
  });

  describe('pollDeploymentStatus - terminal status handling', () => {
    it('should return immediately for completed status', async() => {
      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
          data: {
            id: 'deploy-123',
            status: 'completed',
            progress: 100
          },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const authConfig = { type: 'bearer', token: 'test-token' };
      const result = await deployer.pollDeploymentStatus(
        'deploy-123',
        'https://controller.example.com',
        'dev',
        authConfig,
        { interval: 100, maxAttempts: 10 }
      );

      expect(result.status).toBe('completed');
      expect(getPipelineDeployment).toHaveBeenCalledTimes(1);
    });

    it('should return immediately for failed status', async() => {
      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
          data: {
            id: 'deploy-123',
            status: 'failed',
            progress: 0
          },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const authConfig = { type: 'bearer', token: 'test-token' };
      const result = await deployer.pollDeploymentStatus(
        'deploy-123',
        'https://controller.example.com',
        'dev',
        authConfig,
        { interval: 100, maxAttempts: 10 }
      );

      expect(result.status).toBe('failed');
      expect(getPipelineDeployment).toHaveBeenCalledTimes(1);
    });

    it('should return immediately for cancelled status', async() => {
      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
          data: {
            id: 'deploy-123',
            status: 'cancelled',
            progress: 50
          },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const authConfig = { type: 'bearer', token: 'test-token' };
      const result = await deployer.pollDeploymentStatus(
        'deploy-123',
        'https://controller.example.com',
        'dev',
        authConfig,
        { interval: 100, maxAttempts: 10 }
      );

      expect(result.status).toBe('cancelled');
      expect(getPipelineDeployment).toHaveBeenCalledTimes(1);
    });

    it('should continue polling for non-terminal statuses', async() => {
      getPipelineDeployment
        .mockResolvedValueOnce({
          success: true,
          data: {
            data: {
              id: 'deploy-123',
              status: 'pending',
              progress: 25
            },
            timestamp: '2024-01-01T12:00:00Z'
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            data: {
              id: 'deploy-123',
              status: 'completed',
              progress: 100
            },
            timestamp: '2024-01-01T12:00:01Z'
          }
        });

      const authConfig = { type: 'bearer', token: 'test-token' };
      const resultPromise = deployer.pollDeploymentStatus(
        'deploy-123',
        'https://controller.example.com',
        'dev',
        authConfig,
        { interval: 50, maxAttempts: 10 }
      );

      await Promise.resolve();
      jest.advanceTimersByTime(50);
      await Promise.resolve();

      const result = await resultPromise;

      expect(result.status).toBe('completed');
      expect(getPipelineDeployment).toHaveBeenCalledTimes(2);
    });
  });

  describe('deployToController - integration with sendDeployment and pollDeployment', () => {
    it('should skip polling when poll option is false', async() => {
      const manifest = {
        key: 'test-app',
        displayName: 'Test App',
        image: 'test-app:latest',
        port: 3000
      };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      validatePipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'validate-token-123',
            draftDeploymentId: 'draft-123'
          }
        }
      });

      deployPipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            deploymentId: 'deploy-123',
            deploymentUrl: 'https://app.example.com'
          }
        }
      });

      const auditLogger = require('../../lib/audit-logger');
      jest.spyOn(auditLogger, 'logDeploymentSuccess').mockResolvedValue();

      const result = await deployer.deployToController(
        manifest,
        'https://controller.example.com',
        'dev',
        authConfig,
        { poll: false }
      );

      expect(result.deploymentId).toBe('deploy-123');
      expect(getPipelineDeployment).not.toHaveBeenCalled();
      expect(auditLogger.logDeploymentSuccess).toHaveBeenCalled();
    });

    it('should poll deployment status when poll option is true', async() => {
      const manifest = {
        key: 'test-app',
        displayName: 'Test App',
        image: 'test-app:latest',
        port: 3000
      };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      validatePipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'validate-token-123'
          }
        }
      });

      deployPipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            deploymentId: 'deploy-123'
          }
        }
      });

      getPipelineDeployment.mockResolvedValue({
        success: true,
        data: {
          data: {
            id: 'deploy-123',
            status: 'completed',
            progress: 100
          },
          timestamp: '2024-01-01T12:00:00Z'
        }
      });

      const resultPromise = deployer.deployToController(
        manifest,
        'https://controller.example.com',
        'dev',
        authConfig,
        {
          poll: true,
          pollInterval: 50,
          pollMaxAttempts: 10
        }
      );

      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(50);
      await Promise.resolve();

      const result = await resultPromise;

      expect(result.deploymentId).toBe('deploy-123');
      expect(result.status.status).toBe('completed');
      expect(getPipelineDeployment).toHaveBeenCalled();
    });

    it('should throw error when validation returns invalid result', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      validatePipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            valid: false,
            errors: ['Invalid configuration']
          }
        }
      });

      await expect(
        deployer.deployToController(
          manifest,
          'https://controller.example.com',
          'dev',
          authConfig,
          { maxRetries: 1, poll: false }
        )
      ).rejects.toThrow();
    });

    it('should use custom repository URL when provided', async() => {
      const manifest = { key: 'test-app', image: 'test-app:latest' };
      const authConfig = { type: 'bearer', token: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' };

      validatePipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            valid: true,
            validateToken: 'token-123'
          }
        }
      });

      deployPipeline.mockResolvedValue({
        success: true,
        data: {
          data: {
            deploymentId: 'deploy-123'
          }
        }
      });

      await deployer.deployToController(
        manifest,
        'https://controller.example.com',
        'dev',
        authConfig,
        {
          repositoryUrl: 'https://github.com/custom/repo',
          poll: false
        }
      );

      expect(validatePipeline).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        expect.any(Object),
        expect.objectContaining({
          repositoryUrl: 'https://github.com/custom/repo'
        })
      );
    });
  });
});
