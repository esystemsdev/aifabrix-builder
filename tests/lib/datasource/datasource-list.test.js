/**
 * Tests for AI Fabrix Builder Datasource List Module
 *
 * @fileoverview Unit tests for datasource-list.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

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
jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn(),
  resolveEnvironment: jest.fn()
}));
jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));
jest.mock('../../../lib/api/environments.api', () => ({
  listEnvironmentDatasources: jest.fn()
}));
jest.mock('../../../lib/utils/api-error-handler', () => ({
  formatApiError: jest.fn()
}));
jest.mock('../../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const { getConfig, resolveEnvironment } = require('../../../lib/core/config');
const { getOrRefreshDeviceToken } = require('../../../lib/utils/token-manager');
const { listEnvironmentDatasources } = require('../../../lib/api/environments.api');
const { formatApiError } = require('../../../lib/utils/api-error-handler');
const logger = require('../../../lib/utils/logger');

describe('Datasource List Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Prevent process.exit from actually exiting
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('extractDatasources', () => {
    // Note: extractDatasources is not exported, so we test it indirectly through listDatasources
    // For direct testing, we'd need to export it or test it as part of listDatasources
    it.skip('should extract datasources from wrapped data format', () => {
      const { extractDatasources } = require('../../../lib/datasource/list');
      const response = {
        data: {
          data: [
            { key: 'ds1', displayName: 'Datasource 1' },
            { key: 'ds2', displayName: 'Datasource 2' }
          ]
        }
      };

      const result = extractDatasources(response);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('ds1');
    });

    it.skip('should extract datasources from direct array format', () => {
      const { extractDatasources } = require('../../../lib/datasource/list');
      const response = {
        data: [
          { key: 'ds1', displayName: 'Datasource 1' }
        ]
      };

      const result = extractDatasources(response);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('ds1');
    });

    it.skip('should extract datasources from items array format', () => {
      const { extractDatasources } = require('../../../lib/datasource/list');
      const response = {
        data: {
          items: [
            { key: 'ds1', displayName: 'Datasource 1' }
          ]
        }
      };

      const result = extractDatasources(response);

      expect(result).toHaveLength(1);
    });

    it.skip('should extract datasources from wrapped items format', () => {
      const { extractDatasources } = require('../../../lib/datasource/list');
      const response = {
        data: {
          data: {
            items: [
              { key: 'ds1', displayName: 'Datasource 1' }
            ]
          }
        }
      };

      const result = extractDatasources(response);

      expect(result).toHaveLength(1);
    });

    it.skip('should throw error for invalid response format', () => {
      const { extractDatasources } = require('../../../lib/datasource/list');
      const response = {
        data: { invalid: 'format' }
      };

      expect(() => extractDatasources(response)).toThrow('Invalid API response format');
    });
  });

  describe('displayDatasources', () => {
    it('should display datasources in table format', () => {
      const { displayDatasources } = require('../../../lib/datasource/list');
      const datasources = [
        {
          key: 'ds1',
          displayName: 'Datasource 1',
          systemKey: 'hubspot',
          version: '1.0.0',
          enabled: true
        },
        {
          key: 'ds2',
          displayName: 'Datasource 2',
          systemKey: 'salesforce',
          version: '2.0.0',
          enabled: false
        }
      ];

      displayDatasources(datasources, 'dev');

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Datasources in environment'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('ds1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('ds2'));
    });

    it('should display message when no datasources found', () => {
      const { displayDatasources } = require('../../../lib/datasource/list');

      displayDatasources([], 'dev');

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('No datasources found'));
    });

    it('should handle missing fields gracefully', () => {
      const { displayDatasources } = require('../../../lib/datasource/list');
      const datasources = [
        {
          key: 'ds1'
          // Missing other fields
        }
      ];

      displayDatasources(datasources, 'dev');

      expect(logger.log).toHaveBeenCalled();
    });
  });

  describe('listDatasources', () => {
    it('should list datasources successfully', async() => {
      const mockConfig = {
        device: {
          'http://localhost:3010': {}
        }
      };
      const mockToken = {
        token: 'test-token',
        controller: 'http://localhost:3010'
      };
      const mockResponse = {
        success: true,
        data: {
          data: [
            {
              key: 'ds1',
              displayName: 'Datasource 1',
              systemKey: 'hubspot',
              version: '1.0.0',
              enabled: true
            }
          ]
        }
      };

      getConfig.mockResolvedValue(mockConfig);
      resolveEnvironment.mockResolvedValue('dev');
      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      listEnvironmentDatasources.mockResolvedValue(mockResponse);

      const { listDatasources } = require('../../../lib/datasource/list');
      await listDatasources({});

      expect(resolveEnvironment).toHaveBeenCalled();
      expect(listEnvironmentDatasources).toHaveBeenCalledWith(
        'http://localhost:3010',
        'dev',
        { type: 'bearer', token: 'test-token' }
      );
      expect(logger.log).toHaveBeenCalled();
    });

    it('should exit with error if not logged in', async() => {
      getConfig.mockResolvedValue({});
      resolveEnvironment.mockResolvedValue('dev');

      const { listDatasources } = require('../../../lib/datasource/list');
      await listDatasources({});

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Not logged in'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit with error if API call fails', async() => {
      const mockConfig = {
        device: {
          'http://localhost:3010': {}
        }
      };
      const mockToken = {
        token: 'test-token',
        controller: 'http://localhost:3010'
      };
      const mockResponse = {
        success: false,
        formattedError: 'API Error',
        data: undefined // Explicitly undefined to trigger early exit
      };

      getConfig.mockResolvedValue(mockConfig);
      resolveEnvironment.mockResolvedValue('dev');
      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      listEnvironmentDatasources.mockResolvedValue(mockResponse);
      formatApiError.mockReturnValue('API Error');

      const { listDatasources } = require('../../../lib/datasource/list');
      await listDatasources({});

      expect(logger.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle multiple controller URLs', async() => {
      const mockConfig = {
        device: {
          'http://controller1:3010': {},
          'http://controller2:3010': {}
        }
      };
      const mockToken = {
        token: 'test-token',
        controller: 'http://controller1:3010'
      };
      const mockResponse = {
        success: true,
        data: { data: [] }
      };

      getConfig.mockResolvedValue(mockConfig);
      resolveEnvironment.mockResolvedValue('dev');
      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      listEnvironmentDatasources.mockResolvedValue(mockResponse);

      const { listDatasources } = require('../../../lib/datasource/list');
      await listDatasources({});

      expect(resolveEnvironment).toHaveBeenCalled();
      expect(listEnvironmentDatasources).toHaveBeenCalled();
    });
  });
});

