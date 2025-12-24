/**
 * Tests for API Client
 *
 * @fileoverview Tests for lib/api/index.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/api', () => ({
  makeApiCall: jest.fn(),
  authenticatedApiCall: jest.fn()
}));

const { ApiClient } = require('../../../lib/api/index');
const { makeApiCall, authenticatedApiCall } = require('../../../lib/utils/api');

describe('ApiClient', () => {
  const baseUrl = 'https://api.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    makeApiCall.mockResolvedValue({ success: true, data: {} });
    authenticatedApiCall.mockResolvedValue({ success: true, data: {} });
  });

  describe('constructor', () => {
    it('should create client with base URL', () => {
      const client = new ApiClient(baseUrl);
      expect(client.baseUrl).toBe(baseUrl);
      expect(client.authConfig).toEqual({});
    });

    it('should remove trailing slash from base URL', () => {
      const client = new ApiClient(`${baseUrl}/`);
      expect(client.baseUrl).toBe(baseUrl);
    });

    it('should store auth config', () => {
      const authConfig = { type: 'bearer', token: 'test-token' };
      const client = new ApiClient(baseUrl, authConfig);
      expect(client.authConfig).toEqual(authConfig);
    });

    it('should throw error if baseUrl is missing', () => {
      expect(() => {
        new ApiClient();
      }).toThrow('baseUrl is required and must be a string');
    });

    it('should throw error if baseUrl is not a string', () => {
      expect(() => {
        new ApiClient(123);
      }).toThrow('baseUrl is required and must be a string');

      expect(() => {
        new ApiClient(null);
      }).toThrow('baseUrl is required and must be a string');

      expect(() => {
        new ApiClient(undefined);
      }).toThrow('baseUrl is required and must be a string');
    });
  });

  describe('_buildUrl', () => {
    it('should build URL with leading slash', () => {
      const client = new ApiClient(baseUrl);
      const url = client._buildUrl('/api/v1/test');
      expect(url).toBe(`${baseUrl}/api/v1/test`);
    });

    it('should add leading slash if missing', () => {
      const client = new ApiClient(baseUrl);
      const url = client._buildUrl('api/v1/test');
      expect(url).toBe(`${baseUrl}/api/v1/test`);
    });
  });

  describe('_buildHeaders', () => {
    it('should include Content-Type header', () => {
      const client = new ApiClient(baseUrl);
      const headers = client._buildHeaders();
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should include additional headers', () => {
      const client = new ApiClient(baseUrl);
      const headers = client._buildHeaders({ 'X-Custom': 'value' });
      expect(headers['X-Custom']).toBe('value');
    });

    it('should add Authorization header for bearer token', () => {
      const client = new ApiClient(baseUrl, { type: 'bearer', token: 'test-token' });
      const headers = client._buildHeaders();
      expect(headers['Authorization']).toBe('Bearer test-token');
    });

    it('should add client credentials headers', () => {
      const client = new ApiClient(baseUrl, {
        type: 'client-credentials',
        clientId: 'client-id',
        clientSecret: 'client-secret'
      });
      const headers = client._buildHeaders();
      expect(headers['x-client-id']).toBe('client-id');
      expect(headers['x-client-secret']).toBe('client-secret');
    });

    it('should add Authorization header for client-token', () => {
      const client = new ApiClient(baseUrl, { type: 'client-token', token: 'client-token' });
      const headers = client._buildHeaders();
      expect(headers['Authorization']).toBe('Bearer client-token');
    });

    it('should not add Authorization header if bearer type but no token', () => {
      const client = new ApiClient(baseUrl, { type: 'bearer' });
      const headers = client._buildHeaders();
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should not add Authorization header if client-token type but no token', () => {
      const client = new ApiClient(baseUrl, { type: 'client-token' });
      const headers = client._buildHeaders();
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should add only clientId if clientSecret is missing', () => {
      const client = new ApiClient(baseUrl, {
        type: 'client-credentials',
        clientId: 'client-id'
      });
      const headers = client._buildHeaders();
      expect(headers['x-client-id']).toBe('client-id');
      expect(headers['x-client-secret']).toBeUndefined();
    });

    it('should add only clientSecret if clientId is missing', () => {
      const client = new ApiClient(baseUrl, {
        type: 'client-credentials',
        clientSecret: 'client-secret'
      });
      const headers = client._buildHeaders();
      expect(headers['x-client-id']).toBeUndefined();
      expect(headers['x-client-secret']).toBe('client-secret');
    });
  });

  describe('get', () => {
    it('should make GET request', async() => {
      const client = new ApiClient(baseUrl);
      await client.get('/api/v1/test');

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should add query parameters', async() => {
      const client = new ApiClient(baseUrl);
      await client.get('/api/v1/test', {
        params: { page: 1, size: 10 }
      });

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test?page=1&size=10`,
        expect.any(Object)
      );
    });

    it('should use authenticatedApiCall for bearer token', async() => {
      const client = new ApiClient(baseUrl, { type: 'bearer', token: 'test-token' });
      await client.get('/api/v1/test');

      expect(authenticatedApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({ method: 'GET' }),
        'test-token'
      );
    });

    it('should filter out undefined/null query params', async() => {
      const client = new ApiClient(baseUrl);
      await client.get('/api/v1/test', {
        params: { page: 1, filter: undefined, search: null }
      });

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test?page=1`,
        expect.any(Object)
      );
    });

    it('should not add query string if all params are null/undefined', async() => {
      const client = new ApiClient(baseUrl);
      await client.get('/api/v1/test', {
        params: { filter: null, search: undefined }
      });

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.any(Object)
      );
    });
  });

  describe('post', () => {
    it('should make POST request with body', async() => {
      const client = new ApiClient(baseUrl);
      const body = { key: 'value' };
      await client.post('/api/v1/test', { body });

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body)
        })
      );
    });

    it('should make POST request without body', async() => {
      const client = new ApiClient(baseUrl);
      await client.post('/api/v1/test');

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should use authenticatedApiCall for bearer token', async() => {
      const client = new ApiClient(baseUrl, { type: 'bearer', token: 'test-token' });
      await client.post('/api/v1/test', { body: { test: 'data' } });

      expect(authenticatedApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({ method: 'POST' }),
        'test-token'
      );
    });
  });

  describe('patch', () => {
    it('should make PATCH request', async() => {
      const client = new ApiClient(baseUrl);
      await client.patch('/api/v1/test', { body: { update: 'data' } });

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ update: 'data' })
        })
      );
    });

    it('should use authenticatedApiCall for bearer token', async() => {
      const client = new ApiClient(baseUrl, { type: 'bearer', token: 'test-token' });
      await client.patch('/api/v1/test', { body: { update: 'data' } });

      expect(authenticatedApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({ method: 'PATCH' }),
        'test-token'
      );
    });

    it('should use authenticatedApiCall for client-token', async() => {
      const client = new ApiClient(baseUrl, { type: 'client-token', token: 'client-token' });
      await client.patch('/api/v1/test', { body: { update: 'data' } });

      expect(authenticatedApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({ method: 'PATCH' }),
        'client-token'
      );
    });

    it('should make PATCH request without body', async() => {
      const client = new ApiClient(baseUrl);
      await client.patch('/api/v1/test');

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({
          method: 'PATCH'
        })
      );
      expect(makeApiCall.mock.calls[0][1].body).toBeUndefined();
    });
  });

  describe('put', () => {
    it('should make PUT request', async() => {
      const client = new ApiClient(baseUrl);
      await client.put('/api/v1/test', { body: { data: 'value' } });

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ data: 'value' })
        })
      );
    });
  });

  describe('delete', () => {
    it('should make DELETE request', async() => {
      const client = new ApiClient(baseUrl);
      await client.delete('/api/v1/test');

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}/api/v1/test`,
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });
});

