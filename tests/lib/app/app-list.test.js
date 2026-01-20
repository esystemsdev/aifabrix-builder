/**
 * Tests for lib/app-list.js
 *
 * @fileoverview Tests for application listing functionality
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/core/config');
jest.mock('../../../lib/utils/token-manager');
jest.mock('../../../lib/api/environments.api');
jest.mock('../../../lib/utils/api-error-handler');
jest.mock('../../../lib/utils/error-formatters/http-status-errors');
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = (text) => text;
  mockChalk.green = (text) => text;
  mockChalk.red = (text) => text;
  mockChalk.yellow = (text) => text;
  mockChalk.cyan = (text) => text;
  mockChalk.gray = (text) => text;
  mockChalk.bold = (text) => text;
  mockChalk.bold.yellow = (text) => text;
  return mockChalk;
});

const { getConfig, normalizeControllerUrl } = require('../../../lib/core/config');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const { listEnvironmentApplications } = require('../../../lib/api/environments.api');
const { formatApiError } = require('../../../lib/utils/api-error-handler');
const { formatAuthenticationError } = require('../../../lib/utils/error-formatters/http-status-errors');
const logger = require('../../../lib/utils/logger');
const { listApplications } = require('../../../lib/app/list');

// Access internal functions for testing via re-export or direct testing
// Since extractApplications and displayApplications are not exported, we'll test them indirectly
// through listApplications, but we can also test them by requiring the module differently if needed

describe('app-list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'exit').mockImplementation(() => {});
    // Default mock for normalizeControllerUrl - just return the input
    normalizeControllerUrl.mockImplementation((url) => url);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('extractApplications - response format handling', () => {
    // Test extractApplications indirectly through listApplications
    // by providing different response formats

    it('should extract applications from wrapped format', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      // Wrapped format: { success: true, data: { success: true, data: [...] } }
      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: {
          success: true,
          data: [
            { key: 'app1', displayName: 'App 1', status: 'active' },
            { key: 'app2', displayName: 'App 2', status: 'inactive' }
          ]
        }
      });

      await listApplications({ environment: 'dev' });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Applications in dev environment (http://localhost:3000)'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('app1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('app2'));
    });

    it('should extract applications from direct array format', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      // Direct array: { success: true, data: [...] }
      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: [
          { key: 'app1', displayName: 'App 1', status: 'active' }
        ]
      });

      await listApplications({ environment: 'dev' });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Applications in dev environment (http://localhost:3000)'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('app1'));
    });

    it('should extract applications from paginated format', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      // Paginated format: { success: true, data: { items: [...] } }
      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: {
          items: [
            { key: 'app1', displayName: 'App 1', status: 'active' },
            { key: 'app2', displayName: 'App 2', status: 'inactive' }
          ]
        }
      });

      await listApplications({ environment: 'dev' });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Applications in dev environment (http://localhost:3000)'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('app1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('app2'));
    });

    it('should extract applications from wrapped paginated format', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      // Wrapped paginated: { success: true, data: { success: true, data: { items: [...] } } }
      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: {
          success: true,
          data: {
            items: [
              { key: 'app1', displayName: 'App 1', status: 'active' }
            ]
          }
        }
      });

      await listApplications({ environment: 'dev' });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Applications in dev environment (http://localhost:3000)'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('app1'));
    });

    it('should handle invalid response format', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      // Invalid format
      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: {
          invalid: 'format'
        }
      });

      await listApplications({ environment: 'dev' });

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid response: expected data array or items array'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('displayApplications', () => {
    it('should display empty applications list', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: []
      });

      await listApplications({ environment: 'dev' });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Applications in dev environment (http://localhost:3000)'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No applications found'));
    });

    it('should display applications with pipeline configuration', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: [
          {
            key: 'app1',
            displayName: 'App 1',
            status: 'active',
            configuration: {
              pipeline: {
                isActive: true
              }
            }
          },
          {
            key: 'app2',
            displayName: 'App 2',
            status: 'inactive',
            configuration: {
              pipeline: {
                isActive: false
              }
            }
          }
        ]
      });

      await listApplications({ environment: 'dev' });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✓ app1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✗ app2'));
    });

    it('should display applications without pipeline configuration', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: [
          {
            key: 'app1',
            displayName: 'App 1',
            status: 'active'
          }
        ]
      });

      await listApplications({ environment: 'dev' });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('✗ app1'));
    });

    it('should use default environment name when not provided', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: []
      });

      await listApplications({ environment: null });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Applications in miso environment (http://localhost:3000)'));
    });

    it('should handle applications without status', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: [
          {
            key: 'app1',
            displayName: 'App 1'
          }
        ]
      });

      await listApplications({ environment: 'dev' });

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('app1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('unknown'));
    });
  });

  describe('listApplications - authentication flows', () => {
    it('should use controller URL from options when provided', async() => {
      getConfig.mockResolvedValue({
        device: {}
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: []
      });

      await listApplications({
        environment: 'dev',
        controller: 'http://localhost:3000'
      });

      expect(normalizeControllerUrl).toHaveBeenCalledWith('http://localhost:3000');
      expect(getOrRefreshDeviceToken).toHaveBeenCalledWith('http://localhost:3000');
      expect(listEnvironmentApplications).toHaveBeenCalledWith(
        'http://localhost:3000',
        'dev',
        expect.objectContaining({ type: 'bearer', token: 'test-token' })
      );
    });

    it('should error when controller URL provided but no token exists', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3110');
      getOrRefreshDeviceToken.mockResolvedValue(null); // No token for provided URL

      await listApplications({
        environment: 'dev',
        controller: 'http://localhost:3110'
      });

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No authentication token found for controller: http://localhost:3110'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Please login to this controller using: aifabrix login'));
      expect(process.exit).toHaveBeenCalledWith(1);
      // Should NOT try to use other controllers
      expect(listEnvironmentApplications).not.toHaveBeenCalled();
    });

    it('should use device token from config when no controller URL provided', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: []
      });

      await listApplications({ environment: 'dev' });

      expect(getOrRefreshDeviceToken).toHaveBeenCalledWith('http://localhost:3000');
    });

    it('should try multiple device tokens when first fails', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {},
          'http://localhost:3001': {
            token: 'test-token'
          }
        }
      });
      // normalizeControllerUrl should return the input as is for each URL
      normalizeControllerUrl.mockImplementation((url) => url);
      getOrRefreshDeviceToken
        .mockResolvedValueOnce(null) // First URL fails
        .mockResolvedValueOnce({
          token: 'test-token',
          controller: 'http://localhost:3001'
        });

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: []
      });

      await listApplications({ environment: 'dev' });

      expect(getOrRefreshDeviceToken).toHaveBeenCalledTimes(2);
    });

    it('should handle controller URL authentication failure', async() => {
      getConfig.mockResolvedValue({
        device: {}
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      // When getOrRefreshDeviceToken throws, the error propagates up
      getOrRefreshDeviceToken.mockRejectedValue(new Error('Authentication failed'));

      await expect(listApplications({
        environment: 'dev',
        controller: 'http://localhost:3000'
      })).rejects.toThrow('Authentication failed');
    });

    it('should handle no authentication available', async() => {
      getConfig.mockResolvedValue({
        device: {}
      });
      formatAuthenticationError.mockReturnValue('No valid authentication found');

      await listApplications({ environment: 'dev' });

      expect(formatAuthenticationError).toHaveBeenCalledWith({
        controllerUrl: undefined,
        message: 'No valid authentication found'
      });
      expect(logger.error).toHaveBeenCalledWith('No valid authentication found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('listApplications - error paths', () => {
    it('should handle API call failure', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      listEnvironmentApplications.mockResolvedValue({
        success: false,
        error: 'API error'
      });
      formatApiError.mockReturnValue('API error occurred');

      await listApplications({ environment: 'dev' });

      expect(formatApiError).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('API error occurred');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle API response without data', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: null
      });
      formatApiError.mockReturnValue('No data in response');

      await listApplications({ environment: 'dev' });

      expect(formatApiError).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('No data in response');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle exception during API call', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      listEnvironmentApplications.mockRejectedValue(new Error('Network error'));

      await listApplications({ environment: 'dev' });

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to list applications from controller'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error: Network error'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle exception during extractApplications', async() => {
      getConfig.mockResolvedValue({
        device: {
          'http://localhost:3000': {
            token: 'test-token'
          }
        }
      });
      normalizeControllerUrl.mockReturnValue('http://localhost:3000');
      getOrRefreshDeviceToken.mockResolvedValue({
        token: 'test-token',
        controller: 'http://localhost:3000'
      });

      // Invalid response format that will cause extractApplications to throw
      listEnvironmentApplications.mockResolvedValue({
        success: true,
        data: {
          invalid: 'format'
        }
      });

      await listApplications({ environment: 'dev' });

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid response: expected data array or items array'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});

