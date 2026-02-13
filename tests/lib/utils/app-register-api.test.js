/**
 * Tests for App Register API Module
 *
 * @fileoverview Unit tests for lib/utils/app-register-api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.red = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  return mockChalk;
});

// Mock logger
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

// Mock api-error-handler
jest.mock('../../../lib/utils/api-error-handler', () => ({
  formatApiError: jest.fn((response, url) => `Formatted error for ${url}`)
}));

// Mock applications.api
jest.mock('../../../lib/api/applications.api', () => ({
  registerApplication: jest.fn()
}));

const logger = require('../../../lib/utils/logger');
const { formatApiError } = require('../../../lib/utils/api-error-handler');
const { registerApplication } = require('../../../lib/api/applications.api');
const { callRegisterApi } = require('../../../lib/utils/app-register-api');

// Mock process.exit
const originalExit = process.exit;
beforeAll(() => {
  process.exit = jest.fn();
});

afterAll(() => {
  process.exit = originalExit;
});

describe('App Register API Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('callRegisterApi', () => {
    const apiUrl = 'https://controller.example.com';
    const token = 'test-token';
    const environment = 'dev';
    const registrationData = {
      appKey: 'test-app',
      displayName: 'Test App'
    };

    it('should successfully register application with direct format response', async() => {
      const apiResponse = {
        success: true,
        data: {
          application: {
            id: 'app-id',
            key: 'test-app'
          },
          credentials: {
            clientId: 'client-id',
            clientSecret: 'client-secret'
          }
        }
      };
      registerApplication.mockResolvedValue(apiResponse);

      const result = await callRegisterApi(apiUrl, token, environment, registrationData);

      expect(registerApplication).toHaveBeenCalledWith(
        apiUrl,
        environment,
        { type: 'bearer', token: token },
        registrationData
      );
      expect(result).toEqual(apiResponse.data);
      expect(logger.error).not.toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should successfully register application with wrapped format response', async() => {
      const apiResponse = {
        success: true,
        data: {
          data: {
            application: {
              id: 'app-id',
              key: 'test-app'
            },
            credentials: {
              clientId: 'client-id',
              clientSecret: 'client-secret'
            }
          }
        }
      };
      registerApplication.mockResolvedValue(apiResponse);

      const result = await callRegisterApi(apiUrl, token, environment, registrationData);

      expect(result).toEqual(apiResponse.data.data);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should handle registration failure with 400 status', async() => {
      const apiResponse = {
        success: false,
        status: 400,
        formattedError: 'Validation error'
      };
      registerApplication.mockResolvedValue(apiResponse);

      await callRegisterApi(apiUrl, token, environment, registrationData);

      expect(logger.error).toHaveBeenCalledWith('Validation error');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Controller URL:'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Request payload:'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Check your application.yaml'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle registration failure with 422 status', async() => {
      const apiResponse = {
        success: false,
        status: 422,
        formattedError: 'Unprocessable entity'
      };
      registerApplication.mockResolvedValue(apiResponse);

      await callRegisterApi(apiUrl, token, environment, registrationData);

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Request payload:'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle registration failure with other status codes', async() => {
      const apiResponse = {
        success: false,
        status: 500,
        formattedError: 'Server error'
      };
      registerApplication.mockResolvedValue(apiResponse);
      formatApiError.mockReturnValue('Formatted server error');

      await callRegisterApi(apiUrl, token, environment, registrationData);

      expect(logger.error).toHaveBeenCalledWith('Server error');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Controller URL:'));
      expect(logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Request payload:'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle API call errors', async() => {
      const error = new Error('Network error');
      registerApplication.mockRejectedValue(error);

      await expect(callRegisterApi(apiUrl, token, environment, registrationData))
        .rejects.toThrow('Network error');

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Registration API call failed'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Controller URL:'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error: Network error'));
    });

    it('should handle invalid response format (missing application)', async() => {
      const apiResponse = {
        success: true,
        data: {
          // Missing application field
          credentials: {
            clientId: 'client-id'
          }
        }
      };
      registerApplication.mockResolvedValue(apiResponse);

      await callRegisterApi(apiUrl, token, environment, registrationData);

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid response: missing application data'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Controller URL:'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Full response for debugging:'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should use formatApiError when formattedError is not provided', async() => {
      const apiResponse = {
        success: false,
        status: 500
      };
      registerApplication.mockResolvedValue(apiResponse);
      formatApiError.mockReturnValue('Formatted error message');

      await callRegisterApi(apiUrl, token, environment, registrationData);

      expect(formatApiError).toHaveBeenCalledWith(apiResponse, apiUrl);
      expect(logger.error).toHaveBeenCalledWith('Formatted error message');
    });
  });
});

