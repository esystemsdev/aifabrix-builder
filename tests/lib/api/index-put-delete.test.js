/**
 * Tests for API Client PUT and DELETE Methods
 *
 * @fileoverview Unit tests for PUT and DELETE methods in lib/api/index.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('../../../lib/utils/api', () => ({
  makeApiCall: jest.fn(),
  authenticatedApiCall: jest.fn()
}));

const { ApiClient } = require('../../../lib/api/index');
const { makeApiCall, authenticatedApiCall } = require('../../../lib/utils/api');

describe('ApiClient PUT and DELETE Methods', () => {
  const baseUrl = 'https://api.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    makeApiCall.mockResolvedValue({ success: true, data: {} });
    authenticatedApiCall.mockResolvedValue({ success: true, data: {} });
  });

  describe('put method', () => {
    it('should make PUT request without authentication', async() => {
      const client = new ApiClient(baseUrl);
      const endpoint = '/api/v1/test';
      const options = { body: { key: 'value' } };

      await client.put(endpoint, options);

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}${endpoint}`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(options.body)
        })
      );
      expect(authenticatedApiCall).not.toHaveBeenCalled();
    });

    it('should make PUT request with bearer token authentication', async() => {
      const token = 'bearer-token-123';
      const client = new ApiClient(baseUrl, { type: 'bearer', token });
      const endpoint = '/api/v1/test';
      const options = { body: { key: 'value' } };

      await client.put(endpoint, options);

      expect(authenticatedApiCall).toHaveBeenCalledWith(
        `${baseUrl}${endpoint}`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(options.body)
        }),
        expect.objectContaining({ type: 'bearer', token })
      );
      expect(makeApiCall).not.toHaveBeenCalled();
    });

    it('should make PUT request with client-token authentication', async() => {
      const token = 'client-token-456';
      const client = new ApiClient(baseUrl, { type: 'client-token', token });
      const endpoint = '/api/v1/test';
      const options = { body: { key: 'value' } };

      await client.put(endpoint, options);

      expect(authenticatedApiCall).toHaveBeenCalledWith(
        `${baseUrl}${endpoint}`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(options.body)
        }),
        expect.objectContaining({ type: 'client-token', token })
      );
      expect(makeApiCall).not.toHaveBeenCalled();
    });

    it('should make PUT request without body', async() => {
      const client = new ApiClient(baseUrl);
      const endpoint = '/api/v1/test';

      await client.put(endpoint);

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}${endpoint}`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(makeApiCall.mock.calls[0][1]).not.toHaveProperty('body');
    });

    it('should include custom headers in PUT request', async() => {
      const client = new ApiClient(baseUrl);
      const endpoint = '/api/v1/test';
      const options = {
        body: { key: 'value' },
        headers: { 'X-Custom': 'custom-value' }
      };

      await client.put(endpoint, options);

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}${endpoint}`,
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'custom-value'
          })
        })
      );
    });
  });

  describe('delete method', () => {
    it('should make DELETE request without authentication', async() => {
      const client = new ApiClient(baseUrl);
      const endpoint = '/api/v1/test';

      await client.delete(endpoint);

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}${endpoint}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(authenticatedApiCall).not.toHaveBeenCalled();
    });

    it('should make DELETE request with bearer token authentication', async() => {
      const token = 'bearer-token-123';
      const client = new ApiClient(baseUrl, { type: 'bearer', token });
      const endpoint = '/api/v1/test';

      await client.delete(endpoint);

      expect(authenticatedApiCall).toHaveBeenCalledWith(
        `${baseUrl}${endpoint}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        }),
        expect.objectContaining({ type: 'bearer', token })
      );
      expect(makeApiCall).not.toHaveBeenCalled();
    });

    it('should make DELETE request with client-token authentication', async() => {
      const token = 'client-token-456';
      const client = new ApiClient(baseUrl, { type: 'client-token', token });
      const endpoint = '/api/v1/test';

      await client.delete(endpoint);

      expect(authenticatedApiCall).toHaveBeenCalledWith(
        `${baseUrl}${endpoint}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        }),
        expect.objectContaining({ type: 'client-token', token })
      );
      expect(makeApiCall).not.toHaveBeenCalled();
    });

    it('should include custom headers in DELETE request', async() => {
      const client = new ApiClient(baseUrl);
      const endpoint = '/api/v1/test';
      const options = {
        headers: { 'X-Custom': 'custom-value' }
      };

      await client.delete(endpoint, options);

      expect(makeApiCall).toHaveBeenCalledWith(
        `${baseUrl}${endpoint}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'custom-value'
          })
        })
      );
    });

    it('should handle DELETE request errors', async() => {
      const client = new ApiClient(baseUrl);
      const endpoint = '/api/v1/test';
      const error = new Error('DELETE request failed');
      makeApiCall.mockRejectedValue(error);

      await expect(client.delete(endpoint)).rejects.toThrow('DELETE request failed');
    });

    it('should handle PUT request errors', async() => {
      const client = new ApiClient(baseUrl);
      const endpoint = '/api/v1/test';
      const error = new Error('PUT request failed');
      makeApiCall.mockRejectedValue(error);

      await expect(client.put(endpoint)).rejects.toThrow('PUT request failed');
    });

    it('should handle authenticated DELETE request errors', async() => {
      const token = 'bearer-token-123';
      const client = new ApiClient(baseUrl, { type: 'bearer', token });
      const endpoint = '/api/v1/test';
      const error = new Error('Authenticated DELETE failed');
      authenticatedApiCall.mockRejectedValue(error);

      await expect(client.delete(endpoint)).rejects.toThrow('Authenticated DELETE failed');
    });

    it('should handle authenticated PUT request errors', async() => {
      const token = 'bearer-token-123';
      const client = new ApiClient(baseUrl, { type: 'bearer', token });
      const endpoint = '/api/v1/test';
      const options = { body: { key: 'value' } };
      const error = new Error('Authenticated PUT failed');
      authenticatedApiCall.mockRejectedValue(error);

      await expect(client.put(endpoint, options)).rejects.toThrow('Authenticated PUT failed');
    });
  });
});

