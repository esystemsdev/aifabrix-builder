/**
 * Tests for External System Test Authentication Module
 *
 * @fileoverview Unit tests for lib/external-system/test-auth.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getDeploymentAuth } = require('../../../lib/utils/token-manager');
const { getDataplaneUrl } = require('../../../lib/datasource/deploy');

// Mock dependencies
jest.mock('../../../lib/utils/token-manager', () => ({
  getDeploymentAuth: jest.fn()
}));

jest.mock('../../../lib/datasource/deploy', () => ({
  getDataplaneUrl: jest.fn()
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
      getDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      const result = await setupIntegrationTestAuth(appName, options, config);

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        'hubspot'
      );
      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'https://controller.example.com',
        'hubspot',
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
      getDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      await setupIntegrationTestAuth(appName, options, config);

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'https://controller.example.com',
        'dev',
        'hubspot'
      );
    });

    it('should use controller from options when provided', async() => {
      const appName = 'hubspot';
      const options = {
        environment: 'tst',
        controller: 'https://custom-controller.example.com'
      };
      const config = {
        deployment: {
          controllerUrl: 'https://default-controller.example.com'
        }
      };

      const mockAuthConfig = {
        token: 'test-token'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      getDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      await setupIntegrationTestAuth(appName, options, config);

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'https://custom-controller.example.com',
        'tst',
        'hubspot'
      );
      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'https://custom-controller.example.com',
        'hubspot',
        'tst',
        mockAuthConfig
      );
    });

    it('should use controller from config when not in options', async() => {
      const appName = 'hubspot';
      const options = {
        environment: 'pro'
      };
      const config = {
        deployment: {
          controllerUrl: 'https://config-controller.example.com'
        }
      };

      const mockAuthConfig = {
        token: 'test-token'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      getDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      await setupIntegrationTestAuth(appName, options, config);

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'https://config-controller.example.com',
        'pro',
        'hubspot'
      );
      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'https://config-controller.example.com',
        'hubspot',
        'pro',
        mockAuthConfig
      );
    });

    it('should use default controller URL when not provided', async() => {
      const appName = 'hubspot';
      const options = {
        environment: 'dev'
      };
      const config = {};

      const mockAuthConfig = {
        token: 'test-token'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      getDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      await setupIntegrationTestAuth(appName, options, config);

      expect(getDeploymentAuth).toHaveBeenCalledWith(
        'http://localhost:3000',
        'dev',
        'hubspot'
      );
      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'http://localhost:3000',
        'hubspot',
        'dev',
        mockAuthConfig
      );
    });

    it('should throw error when authentication is missing', async() => {
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

      const mockAuthConfig = {};

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);

      await expect(
        setupIntegrationTestAuth(appName, options, config)
      ).rejects.toThrow('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
    });

    it('should accept authConfig with clientId instead of token', async() => {
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
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      getDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      const result = await setupIntegrationTestAuth(appName, options, config);

      expect(result).toEqual({
        authConfig: mockAuthConfig,
        dataplaneUrl: mockDataplaneUrl
      });
    });

    it('should pass authConfig to getDataplaneUrl', async() => {
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
        additional: 'data'
      };
      const mockDataplaneUrl = 'https://dataplane.example.com';

      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      getDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

      await setupIntegrationTestAuth(appName, options, config);

      expect(getDataplaneUrl).toHaveBeenCalledWith(
        'https://controller.example.com',
        'hubspot',
        'dev',
        mockAuthConfig
      );
    });

    it('should handle different environments', async() => {
      const appName = 'hubspot';
      const environments = ['dev', 'tst', 'pro'];

      for (const environment of environments) {
        const options = {
          environment,
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
        getDataplaneUrl.mockResolvedValue(mockDataplaneUrl);

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
      const options = {
        environment: 'dev',
        controller: 'https://controller.example.com'
      };
      const config = {
        deployment: {
          controllerUrl: 'https://controller.example.com'
        }
      };

      const error = new Error('Authentication failed');
      getDeploymentAuth.mockRejectedValue(error);

      await expect(
        setupIntegrationTestAuth(appName, options, config)
      ).rejects.toThrow('Authentication failed');
    });

    it('should handle getDataplaneUrl errors', async() => {
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
        token: 'test-token'
      };
      const error = new Error('Dataplane URL not found');
      getDeploymentAuth.mockResolvedValue(mockAuthConfig);
      getDataplaneUrl.mockRejectedValue(error);

      await expect(
        setupIntegrationTestAuth(appName, options, config)
      ).rejects.toThrow('Dataplane URL not found');
    });
  });
});

