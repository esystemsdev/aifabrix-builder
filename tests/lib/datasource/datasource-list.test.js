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
  mockChalk.bold = jest.fn((text) => text);
  return mockChalk;
});
jest.mock('../../../lib/core/config', () => ({
  getConfig: jest.fn(),
  resolveEnvironment: jest.fn()
}));
jest.mock('../../../lib/utils/token-manager', () => ({
  getOrRefreshDeviceToken: jest.fn()
}));
jest.mock('../../../lib/api/datasources.api', () => ({
  listDatasources: jest.fn()
}));
jest.mock('../../../lib/utils/dataplane-resolver', () => ({
  resolveDataplaneUrl: jest.fn()
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
const { listDatasources: listDatasourcesFromDataplane } = require('../../../lib/api/datasources.api');
const { resolveDataplaneUrl } = require('../../../lib/utils/dataplane-resolver');
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

  describe('filterDatasourcesByKeyPrefix', () => {
    it('should keep only keys that start with the prefix', () => {
      const { filterDatasourcesByKeyPrefix } = require('../../../lib/datasource/list');
      const ds = [
        { key: 'test-a', displayName: 'A' },
        { key: 'prod-b', displayName: 'B' },
        { key: 'testing-c', displayName: 'C' }
      ];
      expect(filterDatasourcesByKeyPrefix(ds, 'test')).toEqual([
        { key: 'test-a', displayName: 'A' },
        { key: 'testing-c', displayName: 'C' }
      ]);
    });

    it('should return all when prefix empty or whitespace', () => {
      const { filterDatasourcesByKeyPrefix } = require('../../../lib/datasource/list');
      const ds = [{ key: 'a' }];
      expect(filterDatasourcesByKeyPrefix(ds, '')).toEqual(ds);
      expect(filterDatasourcesByKeyPrefix(ds, '   ')).toEqual(ds);
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

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Datasources in dev environment'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('ds1'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('ds2'));
    });

    it('should note key prefix in header when filtering', () => {
      const { displayDatasources } = require('../../../lib/datasource/list');
      displayDatasources(
        [{ key: 'test-x', displayName: 'X', systemKey: 's', version: '1', enabled: true }],
        'dev',
        'http://dp',
        'test'
      );
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('datasource keys starting with "test"')
      );
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
    it('should list datasources successfully from dataplane', async() => {
      const mockConfig = {
        device: {
          'http://localhost:3010': {}
        }
      };
      const mockToken = {
        token: 'test-token',
        controller: 'http://localhost:3010'
      };
      const mockDataplaneUrl = 'http://localhost:3111';
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
      resolveDataplaneUrl.mockResolvedValue(mockDataplaneUrl);
      listDatasourcesFromDataplane.mockResolvedValue(mockResponse);

      const { listDatasources } = require('../../../lib/datasource/list');
      await listDatasources({});

      expect(resolveEnvironment).toHaveBeenCalled();
      expect(resolveDataplaneUrl).toHaveBeenCalledWith(
        'http://localhost:3010',
        'dev',
        expect.objectContaining({
          type: 'bearer',
          token: 'test-token',
          controller: 'http://localhost:3010'
        })
      );
      expect(listDatasourcesFromDataplane).toHaveBeenCalledWith(
        mockDataplaneUrl,
        expect.objectContaining({
          type: 'bearer',
          token: 'test-token',
          controller: 'http://localhost:3010'
        }),
        { page: 1, pageSize: 100 }
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

    it('should exit when dataplane URL resolution fails', async() => {
      const mockConfig = {
        device: {
          'http://localhost:3010': {}
        }
      };
      const mockToken = {
        token: 'test-token',
        controller: 'http://localhost:3010'
      };

      getConfig.mockResolvedValue(mockConfig);
      resolveEnvironment.mockResolvedValue('dev');
      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      resolveDataplaneUrl.mockRejectedValue(new Error('Dataplane URL not found'));

      const { listDatasources } = require('../../../lib/datasource/list');
      await expect(listDatasources({})).rejects.toThrow('Dataplane URL not found');

      expect(resolveDataplaneUrl).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve dataplane URL'),
        'Dataplane URL not found'
      );
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
        data: undefined
      };

      getConfig.mockResolvedValue(mockConfig);
      resolveEnvironment.mockResolvedValue('dev');
      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      resolveDataplaneUrl.mockResolvedValue('http://localhost:3111');
      listDatasourcesFromDataplane.mockResolvedValue(mockResponse);
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
      const mockDataplaneUrl = 'http://localhost:3111';

      getConfig.mockResolvedValue(mockConfig);
      resolveEnvironment.mockResolvedValue('dev');
      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      resolveDataplaneUrl.mockResolvedValue(mockDataplaneUrl);
      listDatasourcesFromDataplane.mockResolvedValue(mockResponse);

      const { listDatasources } = require('../../../lib/datasource/list');
      await listDatasources({});

      expect(resolveEnvironment).toHaveBeenCalled();
      expect(resolveDataplaneUrl).toHaveBeenCalledWith(
        'http://controller1:3010',
        'dev',
        expect.any(Object)
      );
      expect(listDatasourcesFromDataplane).toHaveBeenCalledWith(
        mockDataplaneUrl,
        expect.any(Object),
        { page: 1, pageSize: 100 }
      );
    });

    it('should pass key prefix filter to the dataplane API', async() => {
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
          data: [{ key: 'hub-x', displayName: 'X', systemKey: 's', version: '1', enabled: true }],
          meta: { totalPages: 1, totalItems: 1 }
        }
      };

      getConfig.mockResolvedValue(mockConfig);
      resolveEnvironment.mockResolvedValue('dev');
      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      resolveDataplaneUrl.mockResolvedValue('http://localhost:3111');
      listDatasourcesFromDataplane.mockResolvedValue(mockResponse);

      const { listDatasources } = require('../../../lib/datasource/list');
      await listDatasources({ keyPrefix: 'hub' });

      expect(listDatasourcesFromDataplane).toHaveBeenCalledWith(
        'http://localhost:3111',
        expect.any(Object),
        { page: 1, pageSize: 100, filter: 'key:like:hub%' }
      );
    });

    it('should fetch subsequent pages until the last page', async() => {
      const mockConfig = {
        device: {
          'http://localhost:3010': {}
        }
      };
      const mockToken = {
        token: 'test-token',
        controller: 'http://localhost:3010'
      };
      const page1 = {
        success: true,
        data: {
          data: Array.from({ length: 100 }, (_, i) => ({
            key: `ds-${i}`,
            displayName: 'D',
            systemKey: 's',
            version: '1',
            enabled: true
          })),
          meta: { totalPages: 2, totalItems: 150, currentPage: 1, pageSize: 100 }
        }
      };
      const page2 = {
        success: true,
        data: {
          data: Array.from({ length: 50 }, (_, i) => ({
            key: `extra-${i}`,
            displayName: 'E',
            systemKey: 's',
            version: '1',
            enabled: true
          })),
          meta: { totalPages: 2, totalItems: 150, currentPage: 2, pageSize: 100 }
        }
      };

      getConfig.mockResolvedValue(mockConfig);
      resolveEnvironment.mockResolvedValue('dev');
      getOrRefreshDeviceToken.mockResolvedValue(mockToken);
      resolveDataplaneUrl.mockResolvedValue('http://localhost:3111');
      listDatasourcesFromDataplane
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);

      const { listDatasources } = require('../../../lib/datasource/list');
      await listDatasources({});

      expect(listDatasourcesFromDataplane).toHaveBeenCalledTimes(2);
      expect(listDatasourcesFromDataplane).toHaveBeenNthCalledWith(
        1,
        'http://localhost:3111',
        expect.any(Object),
        { page: 1, pageSize: 100 }
      );
      expect(listDatasourcesFromDataplane).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3111',
        expect.any(Object),
        { page: 2, pageSize: 100 }
      );
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('extra-0'));
    });

    it('should exit with error if controller URL is empty after trimming', async() => {
      const mockConfig = {
        device: {
          'http://localhost:3010': {}
        }
      };
      const mockToken = {
        token: 'test-token',
        controller: '   ' // Whitespace only
      };

      getConfig.mockResolvedValue(mockConfig);
      resolveEnvironment.mockResolvedValue('dev');
      getOrRefreshDeviceToken.mockResolvedValue(mockToken);

      const { listDatasources } = require('../../../lib/datasource/list');
      await listDatasources({});

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Controller URL is empty'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});

