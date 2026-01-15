/**
 * Tests for External System Test Execution Module
 *
 * @fileoverview Unit tests for lib/external-system/test-execution.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../../../lib/utils/logger');
const testHelpers = require('../../../lib/utils/external-system-test-helpers');

// Mock dependencies
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  return mockChalk;
});

jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../../lib/utils/external-system-test-helpers', () => ({
  testSingleDatasource: jest.fn(),
  determinePayloadTemplate: jest.fn()
}));

const {
  executeDatasourceTest,
  testSingleDatasourceIntegration
} = require('../../../lib/external-system/test-execution');

describe('External System Test Execution Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeDatasourceTest', () => {
    it('should execute datasource test successfully', async() => {
      const systemKey = 'hubspot';
      const datasourceKey = 'hubspot-companies-get';
      const payloadTemplate = { test: 'payload' };
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const options = { timeout: '30000' };

      const mockResult = {
        key: datasourceKey,
        success: true,
        response: { data: 'test' }
      };

      testHelpers.testSingleDatasource.mockResolvedValue(mockResult);

      const result = await executeDatasourceTest(
        systemKey,
        datasourceKey,
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        options
      );

      expect(testHelpers.testSingleDatasource).toHaveBeenCalledWith({
        systemKey,
        datasourceKey,
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        timeout: 30000
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle test execution errors', async() => {
      const systemKey = 'hubspot';
      const datasourceKey = 'hubspot-companies-get';
      const payloadTemplate = { test: 'payload' };
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const options = { timeout: '30000' };

      const error = new Error('Test execution failed');
      testHelpers.testSingleDatasource.mockRejectedValue(error);

      const result = await executeDatasourceTest(
        systemKey,
        datasourceKey,
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        options
      );

      expect(result).toEqual({
        key: datasourceKey,
        skipped: false,
        success: false,
        error: 'Test execution failed'
      });
    });

    it('should use default timeout when not provided', async() => {
      const systemKey = 'hubspot';
      const datasourceKey = 'hubspot-companies-get';
      const payloadTemplate = { test: 'payload' };
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const options = {};

      const mockResult = {
        key: datasourceKey,
        success: true
      };

      testHelpers.testSingleDatasource.mockResolvedValue(mockResult);

      await executeDatasourceTest(
        systemKey,
        datasourceKey,
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        options
      );

      expect(testHelpers.testSingleDatasource).toHaveBeenCalledWith({
        systemKey,
        datasourceKey,
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        timeout: 30000
      });
    });

    it('should parse timeout as integer', async() => {
      const systemKey = 'hubspot';
      const datasourceKey = 'hubspot-companies-get';
      const payloadTemplate = { test: 'payload' };
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const options = { timeout: '60000' };

      const mockResult = {
        key: datasourceKey,
        success: true
      };

      testHelpers.testSingleDatasource.mockResolvedValue(mockResult);

      await executeDatasourceTest(
        systemKey,
        datasourceKey,
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        options
      );

      expect(testHelpers.testSingleDatasource).toHaveBeenCalledWith({
        systemKey,
        datasourceKey,
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        timeout: 60000
      });
    });

    it('should handle non-string timeout values', async() => {
      const systemKey = 'hubspot';
      const datasourceKey = 'hubspot-companies-get';
      const payloadTemplate = { test: 'payload' };
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const options = { timeout: 45000 };

      const mockResult = {
        key: datasourceKey,
        success: true
      };

      testHelpers.testSingleDatasource.mockResolvedValue(mockResult);

      await executeDatasourceTest(
        systemKey,
        datasourceKey,
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        options
      );

      expect(testHelpers.testSingleDatasource).toHaveBeenCalledWith({
        systemKey,
        datasourceKey,
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        timeout: 45000
      });
    });
  });

  describe('testSingleDatasourceIntegration', () => {
    it('should test single datasource integration successfully', async() => {
      const datasourceFile = {
        path: '/path/to/datasource.json',
        data: {
          key: 'hubspot-companies-get',
          displayName: 'Get Companies'
        }
      };
      const systemKey = 'hubspot';
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const customPayload = null;
      const options = { timeout: '30000' };

      const payloadTemplate = { test: 'payload' };
      const mockResult = {
        key: 'hubspot-companies-get',
        success: true,
        response: { data: 'test' }
      };

      testHelpers.determinePayloadTemplate.mockReturnValue(payloadTemplate);
      testHelpers.testSingleDatasource.mockResolvedValue(mockResult);

      const result = await testSingleDatasourceIntegration(
        datasourceFile,
        systemKey,
        dataplaneUrl,
        authConfig,
        customPayload,
        options
      );

      expect(logger.log).toHaveBeenCalledWith(chalk.blue('\n📡 Testing datasource: hubspot-companies-get'));
      expect(testHelpers.determinePayloadTemplate).toHaveBeenCalledWith(
        datasourceFile.data,
        'hubspot-companies-get',
        null
      );
      expect(testHelpers.testSingleDatasource).toHaveBeenCalledWith({
        systemKey,
        datasourceKey: 'hubspot-companies-get',
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        timeout: 30000
      });
      expect(result).toEqual(mockResult);
    });

    it('should skip datasource when no payload template is found', async() => {
      const datasourceFile = {
        path: '/path/to/datasource.json',
        data: {
          key: 'hubspot-companies-get',
          displayName: 'Get Companies'
        }
      };
      const systemKey = 'hubspot';
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const customPayload = null;
      const options = { timeout: '30000' };

      testHelpers.determinePayloadTemplate.mockReturnValue(null);

      const result = await testSingleDatasourceIntegration(
        datasourceFile,
        systemKey,
        dataplaneUrl,
        authConfig,
        customPayload,
        options
      );

      expect(logger.log).toHaveBeenCalledWith(chalk.blue('\n📡 Testing datasource: hubspot-companies-get'));
      expect(logger.log).toHaveBeenCalledWith(chalk.yellow('  ⚠ No test payload found for hubspot-companies-get, skipping...'));
      expect(testHelpers.testSingleDatasource).not.toHaveBeenCalled();
      expect(result).toEqual({
        key: 'hubspot-companies-get',
        skipped: true,
        reason: 'No test payload available'
      });
    });

    it('should use custom payload when provided', async() => {
      const datasourceFile = {
        path: '/path/to/datasource.json',
        data: {
          key: 'hubspot-companies-get',
          displayName: 'Get Companies'
        }
      };
      const systemKey = 'hubspot';
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const customPayload = { custom: 'payload' };
      const options = { timeout: '30000' };

      const payloadTemplate = { test: 'payload' };
      const mockResult = {
        key: 'hubspot-companies-get',
        success: true
      };

      testHelpers.determinePayloadTemplate.mockReturnValue(payloadTemplate);
      testHelpers.testSingleDatasource.mockResolvedValue(mockResult);

      await testSingleDatasourceIntegration(
        datasourceFile,
        systemKey,
        dataplaneUrl,
        authConfig,
        customPayload,
        options
      );

      expect(testHelpers.determinePayloadTemplate).toHaveBeenCalledWith(
        datasourceFile.data,
        'hubspot-companies-get',
        customPayload
      );
    });

    it('should handle test execution errors', async() => {
      const datasourceFile = {
        path: '/path/to/datasource.json',
        data: {
          key: 'hubspot-companies-get',
          displayName: 'Get Companies'
        }
      };
      const systemKey = 'hubspot';
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const customPayload = null;
      const options = { timeout: '30000' };

      const payloadTemplate = { test: 'payload' };
      const error = new Error('Test execution failed');

      testHelpers.determinePayloadTemplate.mockReturnValue(payloadTemplate);
      testHelpers.testSingleDatasource.mockRejectedValue(error);

      const result = await testSingleDatasourceIntegration(
        datasourceFile,
        systemKey,
        dataplaneUrl,
        authConfig,
        customPayload,
        options
      );

      expect(result).toEqual({
        key: 'hubspot-companies-get',
        skipped: false,
        success: false,
        error: 'Test execution failed'
      });
    });

    it('should extract datasource key from datasource file data', async() => {
      const datasourceFile = {
        path: '/path/to/datasource.json',
        data: {
          key: 'custom-datasource-key',
          displayName: 'Custom Datasource'
        }
      };
      const systemKey = 'hubspot';
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const customPayload = null;
      const options = { timeout: '30000' };

      const payloadTemplate = { test: 'payload' };
      const mockResult = {
        key: 'custom-datasource-key',
        success: true
      };

      testHelpers.determinePayloadTemplate.mockReturnValue(payloadTemplate);
      testHelpers.testSingleDatasource.mockResolvedValue(mockResult);

      await testSingleDatasourceIntegration(
        datasourceFile,
        systemKey,
        dataplaneUrl,
        authConfig,
        customPayload,
        options
      );

      expect(logger.log).toHaveBeenCalledWith(chalk.blue('\n📡 Testing datasource: custom-datasource-key'));
      expect(testHelpers.determinePayloadTemplate).toHaveBeenCalledWith(
        datasourceFile.data,
        'custom-datasource-key',
        null
      );
    });

    it('should pass options to executeDatasourceTest', async() => {
      const datasourceFile = {
        path: '/path/to/datasource.json',
        data: {
          key: 'hubspot-companies-get',
          displayName: 'Get Companies'
        }
      };
      const systemKey = 'hubspot';
      const dataplaneUrl = 'https://dataplane.example.com';
      const authConfig = { token: 'test-token' };
      const customPayload = null;
      const options = { timeout: '60000', verbose: true };

      const payloadTemplate = { test: 'payload' };
      const mockResult = {
        key: 'hubspot-companies-get',
        success: true
      };

      testHelpers.determinePayloadTemplate.mockReturnValue(payloadTemplate);
      testHelpers.testSingleDatasource.mockResolvedValue(mockResult);

      await testSingleDatasourceIntegration(
        datasourceFile,
        systemKey,
        dataplaneUrl,
        authConfig,
        customPayload,
        options
      );

      expect(testHelpers.testSingleDatasource).toHaveBeenCalledWith({
        systemKey,
        datasourceKey: 'hubspot-companies-get',
        payloadTemplate,
        dataplaneUrl,
        authConfig,
        timeout: 60000
      });
    });
  });
});

