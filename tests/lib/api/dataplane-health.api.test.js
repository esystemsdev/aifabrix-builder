/**
 * @fileoverview Tests for lib/api/dataplane-health.api.js (plan 142.0).
 */

'use strict';

jest.mock('../../../lib/api/index');
const { ApiClient } = require('../../../lib/api/index');
const {
  fetchDataplaneGeneralHealth,
  parseGeneralHealthResponse,
  PRIMARY_ENDPOINT,
  FALLBACK_ENDPOINT
} = require('../../../lib/api/dataplane-health.api');

describe('dataplane-health.api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseGeneralHealthResponse', () => {
    it('parses flat HealthResponse shape', () => {
      const snap = parseGeneralHealthResponse(
        {
          success: true,
          data: {
            status: 'healthy',
            service: 'dataplane',
            version: '1.9.5',
            minBuilderCliVersion: '2.45.0',
            message: 'pong'
          }
        },
        PRIMARY_ENDPOINT
      );
      expect(snap).toEqual({
        status: 'healthy',
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0',
        endpoint: PRIMARY_ENDPOINT
      });
    });

    it('parses nested data.data wrapper', () => {
      const snap = parseGeneralHealthResponse({
        success: true,
        data: {
          data: {
            status: 'healthy',
            version: '1.9.5'
          }
        }
      });
      expect(snap.status).toBe('healthy');
      expect(snap.version).toBe('1.9.5');
      expect(snap.minBuilderCliVersion).toBeUndefined();
      expect(snap.endpoint).toBeNull();
    });

    it('omits minBuilderCliVersion when blank or missing', () => {
      const snap = parseGeneralHealthResponse({
        success: true,
        data: { status: 'healthy', version: '1.9.5', minBuilderCliVersion: '   ' }
      });
      expect(snap.minBuilderCliVersion).toBeUndefined();
    });

    it('returns null when response.success is false', () => {
      expect(parseGeneralHealthResponse({ success: false, data: {} })).toBeNull();
    });

    it('returns null when data is null/undefined', () => {
      expect(parseGeneralHealthResponse({ success: true, data: null })).toBeNull();
      expect(parseGeneralHealthResponse(undefined)).toBeNull();
    });
  });

  describe('fetchDataplaneGeneralHealth', () => {
    it('returns snapshot from primary endpoint when available', async() => {
      const getMock = jest.fn().mockResolvedValue({
        success: true,
        data: { status: 'healthy', version: '1.9.5', minBuilderCliVersion: '2.45.0' }
      });
      ApiClient.mockImplementation(() => ({ get: getMock }));

      const snap = await fetchDataplaneGeneralHealth('http://localhost:3201');
      expect(snap).toEqual({
        status: 'healthy',
        version: '1.9.5',
        minBuilderCliVersion: '2.45.0',
        endpoint: PRIMARY_ENDPOINT
      });
      expect(getMock).toHaveBeenCalledWith(PRIMARY_ENDPOINT, {});
    });

    it('falls back to /health when /api/v1/health returns unusable response', async() => {
      const getMock = jest.fn()
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({
          success: true,
          data: { status: 'healthy', version: '1.9.4' }
        });
      ApiClient.mockImplementation(() => ({ get: getMock }));

      const snap = await fetchDataplaneGeneralHealth('http://localhost:3201');
      expect(snap.endpoint).toBe(FALLBACK_ENDPOINT);
      expect(snap.version).toBe('1.9.4');
      expect(getMock).toHaveBeenNthCalledWith(1, PRIMARY_ENDPOINT, {});
      expect(getMock).toHaveBeenNthCalledWith(2, FALLBACK_ENDPOINT, {});
    });

    it('returns null when both endpoints fail', async() => {
      const getMock = jest.fn().mockResolvedValue({ success: false });
      ApiClient.mockImplementation(() => ({ get: getMock }));

      const snap = await fetchDataplaneGeneralHealth('http://localhost:3201');
      expect(snap).toBeNull();
    });

    it('survives transport errors on the primary endpoint', async() => {
      const getMock = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({
          success: true,
          data: { status: 'healthy', version: '1.9.4' }
        });
      ApiClient.mockImplementation(() => ({ get: getMock }));

      const snap = await fetchDataplaneGeneralHealth('http://localhost:3201');
      expect(snap.endpoint).toBe(FALLBACK_ENDPOINT);
    });

    it('passes timeoutMs option through to ApiClient', async() => {
      const getMock = jest.fn().mockResolvedValue({
        success: true,
        data: { status: 'healthy', version: '1.9.5' }
      });
      ApiClient.mockImplementation(() => ({ get: getMock }));

      await fetchDataplaneGeneralHealth('http://localhost:3201', { timeoutMs: 1500 });
      expect(getMock).toHaveBeenCalledWith(PRIMARY_ENDPOINT, { timeoutMs: 1500 });
    });

    it('throws when dataplaneUrl is missing', async() => {
      await expect(fetchDataplaneGeneralHealth(null)).rejects.toThrow(
        /dataplaneUrl is required/
      );
    });
  });
});
