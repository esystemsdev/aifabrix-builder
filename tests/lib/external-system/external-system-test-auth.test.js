/**
 * Tests for External System Test Authentication Module
 *
 * @fileoverview Unit tests for lib/external-system/test-auth.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getDeploymentAuth } = require('../../../lib/utils/token-manager');
const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');

// Mock dependencies
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeploymentAuth: jest.fn()
}));

jest.mock('../../../lib/utils/dataplane-resolver', () => ({
  resolveDataplaneUrl: jest.fn()
}));

// Mock controller-url to return consistent default URL
jest.mock('../../../lib/utils/controller-url', () => ({
  getDefaultControllerUrl: jest.fn().mockResolvedValue('http://localhost:3000'),
  resolveControllerUrl: jest.fn().mockResolvedValue('http://localhost:3000')
}));

jest.mock('../../../lib/core/config', () => ({
  resolveEnvironment: jest.fn().mockResolvedValue('dev')
}));

const { setupIntegrationTestAuth } = require('../../../lib/external-system/test-auth');

describe('External System Test Authentication Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setupIntegrationTestAuth', () => {
    it('should setup authentication and return authConfig and dataplaneUrl', async() => {
      const appName = 'hubspot';
      const options = {
        environment: 'dev',
        controller: 'https://controller.example.com'
      };
      const config = {
        deployment: {
          controllerUrl: 'https://controller.example.com'
        }
      };

      const mockAuthConfig = {
        token: 'test-token',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      resolveDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('https://controller.example.com');

      const result = await setupIntegrationTestAuth(appName, options, config);

      expect(resolveControllerUrl).toHaveBeenCalledWith();
      expect(resolveEnvironment).not.toHaveBeenCalled();
      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        'hubspot'
      );
      expect(resolveDataplaneUrl).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        mockAuthConfig
      );
      expect(result).toEqual({
        authConfig: mockAuthConfig,
        dataplaneUrl: mockDataplaneUrl
      });
    });

    it('should use default environment when not provided', async() => {
      const appName = 'hubspot';
      const options = {
        controller: 'https://controller.example.com'
      };
      const config = {
        deployment: {
          controllerUrl: 'https://controller.example.com'
        }
      };

      const mockAuthConfig = {
        token: 'test-token'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      resolveDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      resolveControllerUrl.mockResolvedValueOnce('https://controller.example.com');

      await setupIntegrationTestAuth(appName, options, config);

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        'hubspot'
      );
    });

    it('should use controller and environment from config', async() => {
      const appName = 'hubspot';
      const options = {};
      const config = {};

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('https://custom-controller.example.com');
      resolveEnvironment.mockResolvedValueOnce('tst');

      const mockAuthConfig = {
        token: 'test-token'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      resolveDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      await setupIntegrationTestAuth(appName, options, config);

      expect(resolveControllerUrl).toHaveBeenCalledWith();
      expect(resolveEnvironment).toHaveBeenCalledWith();
      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'https://custom-controller.example.com',
        'tst',
        'hubspot'
      );
      expect(resolveDataplaneUrl).toHaveBeenCalledWith(
        'https://custom-controller.example.com',
        'tst',
        mockAuthConfig
      );
    });

    it('should use controller and environment from config (pro)', async() => {
      const appName = 'hubspot';
      const options = {};
      const config = {};

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('https://config-controller.example.com');
      resolveEnvironment.mockResolvedValueOnce('pro');

      const mockAuthConfig = {
        token: 'test-token'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      resolveDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      await setupIntegrationTestAuth(appName, options, config);

      expect(resolveControllerUrl).toHaveBeenCalledWith();
      expect(resolveEnvironment).toHaveBeenCalledWith();
      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'https://config-controller.example.com',
        'pro',
        'hubspot'
      );
      expect(resolveDataplaneUrl).toHaveBeenCalledWith(
        'https://config-controller.example.com',
        'pro',
        mockAuthConfig
      );
    });

    it('should use default controller URL when not provided', async() => {
      const appName = 'hubspot';
      const options = {};
      const config = {};

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('http://localhost:3000');
      resolveEnvironment.mockResolvedValueOnce('dev');

      const mockAuthConfig = {
        token: 'test-token'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      resolveDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      await setupIntegrationTestAuth(appName, options, config);

      expect(resolveControllerUrl).toHaveBeenCalledWith();
      expect(resolveEnvironment).toHaveBeenCalledWith();

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'http://localhost:3000',
        'dev',
        'hubspot'
      );
      expect(resolveDataplaneUrl).toHaveBeenCalledWith(
        'http://localhost:3000',
        'dev',
        mockAuthConfig
      );
    });

    it('should throw error when authentication is missing', async() => {
      const appName = 'hubspot';
      const options = {};
      const config = {};

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('https://controller.example.com');
      resolveEnvironment.mockResolvedValueOnce('dev');

      const mockAuthConfig = {};

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);

      await expect(
        setupIntegrationTestAuth(appName, options, config)
      ).rejects.toThrow('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
    });

    it('should accept authConfig with clientId instead of token', async() => {
      const appName = 'hubspot';
      const options = {};
      const config = {};

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('https://controller.example.com');
      resolveEnvironment.mockResolvedValueOnce('dev');

      const mockAuthConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      resolveDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      const result = await setupIntegrationTestAuth(appName, options, config);

      expect(result).toEqual({
        authConfig: mockAuthConfig,
        dataplaneUrl: mockDataplaneUrl
      });
    });

    it('should pass authConfig to resolveDataplaneUrl', async() => {
      const appName = 'hubspot';
      const options = {};
      const config = {};

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('https://controller.example.com');
      resolveEnvironment.mockResolvedValueOnce('dev');

      const mockAuthConfig = {
        token: 'test-token',
        additional: 'data'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      resolveDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      await setupIntegrationTestAuth(appName, options, config);

      expect(resolveDataplaneUrl).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        mockAuthConfig
      );
    });

    it('should handle different environments', async() => {
      const appName = 'hubspot';
      const environments = ['dev', 'tst', 'pro'];

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValue('https://controller.example.com');

      for (const environment of environments) {
        const options = {};
        const config = {};
        resolveEnvironment.mockResolvedValueOnce(environment);

        const mockAuthConfig = {
          token: 'test-token'
        };
        const mockDataplaneUrl = 'https://dataplane.example.com';

        getDeploymentAuth.mockResolvedValue(mockAuthConfig);
        resolveDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

        await setupIntegrationTestAuth(appName, options, config);

        expect(getDeploymentAuth).toHaveBeenCalledWith(
          'https://controller.example.com',
          environment,
          'hubspot'
        );
      }
    });

    it('should handle getDeploymentAuth errors', async() => {
      const appName = 'hubspot';
      const options = {};
      const config = {};

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('https://controller.example.com');
      resolveEnvironment.mockResolvedValueOnce('dev');

      const error = new Error('Authentication failed');
      getDeploymentAuth.mockRejectedValue(error);

      await expect(
        setupIntegrationTestAuth(appName, options, config)
      ).rejects.toThrow('Authentication failed');
    });

    it('should handle resolveDataplaneUrl errors', async() => {
      const appName = 'hubspot';
      const options = {};
      const config = {};

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('https://controller.example.com');
      resolveEnvironment.mockResolvedValueOnce('dev');

      const mockAuthConfig = {
        token: 'test-token'
      };
      const error = new Error('Dataplane URL not found');
      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      resolveDataplaneUrl.mockRejectedValue(error);

      await expect(
        setupIntegrationTestAuth(appName, options, config)
      ).rejects.toThrow('Dataplane URL not found');
    });

    it('should use options.dataplane when provided (no discovery)', async() => {
      const appName = 'hubspot-test-v1';
      const options = { dataplane: 'http://127.0.0.1:3611' };
      const config = {};

      const { resolveControllerUrl } = require('../../../lib/utils/controller-url');
      const { resolveEnvironment } = require('../../../lib/core/config');
      resolveControllerUrl.mockResolvedValueOnce('http://localhost:3610');
      resolveEnvironment.mockResolvedValueOnce('dev');

      const mockAuthConfig = { token: 'test-token' };
      getDeploymentAuth.mockResolvedValue(mockAuthConfig);

      const result = await setupIntegrationTestAuth(appName, options, config);

      expect(result.authConfig).toEqual(mockAuthConfig);
      expect(result.dataplaneUrl).toBe('http://127.0.0.1:3611');
      expect(resolveDataplaneUrl).not.toHaveBeenCalled();
    });
  });
});

