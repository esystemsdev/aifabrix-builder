/**
 * @fileoverview Tests for lib/api/protection.api.js (list + lookup by datasource).
 */

'use strict';

const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn()
};

const mockApiClient = jest.fn().mockImplementation((baseUrl, authConfig) => ({
  baseUrl,
  authConfig,
  get: mockClient.get,
  post: mockClient.post,
  delete: mockClient.delete
}));

jest.mock('../../../lib/api/index', () => ({
  ApiClient: mockApiClient,
  createDataplaneApiClient: mockApiClient
}));

const protectionApi = require('../../../lib/api/protection.api');

describe('protection API', () => {
  const dataplaneUrl = 'https://dataplane.example.com';
  const authConfig = { type: 'bearer', token: 'test-token' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listProtectionManifests', () => {
    it('GET /api/v1/protection with query params', async() => {
      mockClient.get.mockResolvedValue({
        success: true,
        data: { data: [], meta: { totalItems: 0, currentPage: 1, pageSize: 20 } }
      });

      await protectionApi.listProtectionManifests(dataplaneUrl, authConfig, {
        page: 2,
        pageSize: 10,
        filter: 'enabled:eq:true'
      });

      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/protection', {
        params: { page: 2, pageSize: 10, filter: 'enabled:eq:true' }
      });
    });

    it('returns items and meta from paginated data envelope', async() => {
      const row = {
        key: 'p1',
        datasourceKey: 'hubspot-companies',
        displayName: 'HubSpot',
        enabled: true,
        currentRevision: 2
      };
      const body = {
        data: [row],
        meta: { totalItems: 1, currentPage: 1, pageSize: 100 }
      };
      mockClient.get.mockResolvedValue({ success: true, data: body });

      const result = await protectionApi.listProtectionManifests(dataplaneUrl, authConfig);

      expect(result.items).toEqual([row]);
      expect(result.meta).toEqual(body.meta);
      expect(result.raw).toEqual(body);
    });

    it('extracts items from items[] when data[] is absent', async() => {
      const row = { key: 'p2', datasourceKey: 'sharepoint-sites' };
      mockClient.get.mockResolvedValue({
        success: true,
        data: { items: [row] }
      });

      const result = await protectionApi.listProtectionManifests(dataplaneUrl, authConfig);

      expect(result.items).toEqual([row]);
      expect(result.meta).toBeNull();
    });

    it('extracts items when body is a bare array', async() => {
      const row = { key: 'p3', datasourceKey: 'hubspot-deals' };
      mockClient.get.mockResolvedValue({ success: true, data: [row] });

      const result = await protectionApi.listProtectionManifests(dataplaneUrl, authConfig);

      expect(result.items).toEqual([row]);
    });

    it('returns empty items for missing or invalid body', async() => {
      mockClient.get.mockResolvedValue({ success: true, data: null });

      const result = await protectionApi.listProtectionManifests(dataplaneUrl, authConfig);

      expect(result.items).toEqual([]);
      expect(result.meta).toBeNull();
    });
  });

  describe('findProtectionKeyByDatasource', () => {
    it('returns protection key when datasourceKey matches', async() => {
      mockClient.get.mockResolvedValue({
        success: true,
        data: {
          data: [
            { key: 'other-prot', datasourceKey: 'other-ds' },
            { key: 'hubspot-prot', datasourceKey: 'hubspot-companies' }
          ],
          meta: { totalItems: 2, currentPage: 1, pageSize: 100 }
        }
      });

      const key = await protectionApi.findProtectionKeyByDatasource(
        dataplaneUrl,
        authConfig,
        'hubspot-companies'
      );

      expect(key).toBe('hubspot-prot');
      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/protection', {
        params: { page: 1, pageSize: 100 }
      });
    });

    it('returns null when no manifest matches datasource key', async() => {
      mockClient.get.mockResolvedValue({
        success: true,
        data: { data: [{ key: 'p1', datasourceKey: 'other-ds' }] }
      });

      const key = await protectionApi.findProtectionKeyByDatasource(
        dataplaneUrl,
        authConfig,
        'hubspot-companies'
      );

      expect(key).toBeNull();
    });
  });
});
