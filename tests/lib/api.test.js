/**
 * Tests for API Utilities Module
 *
 * @fileoverview Tests for utils/api.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { makeApiCall, authenticatedApiCall } = require('../../lib/utils/api');

// Mock global fetch
global.fetch = jest.fn();

describe('API Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('makeApiCall', () => {
    it('should make successful API call and return JSON', async() => {
      const mockData = { id: 1, name: 'Test' };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue(mockData)
      });

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', {});
    });

    it('should make successful API call and return text', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'text/plain'
        },
        text: jest.fn().mockResolvedValue('Success')
      });

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(true);
      expect(result.data).toBe('Success');
      expect(result.status).toBe(200);
    });

    it('should handle 400 error with JSON error response', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Invalid request' }))
      });

      const degradation = await makeApiCall('https://api.example.com/test');

      expect(degradation.success).toBe(false);
      expect(degradation.error).toBe('Invalid request');
      expect(degradation.status).toBe(400);
    });

    it('should handle 404 error with text error response', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Not Found')
      });

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not Found');
      expect(result.status).toBe(404);
    });

    it('should handle 401 error with error JSON', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue(JSON.stringify({ message: 'Authentication failed' }))
      });

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
      expect(result.status).toBe(401);
    });

    it('should handle network errors', async() => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await makeApiCall('https://api.example.com/test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.network).toBe(true);
    });

    it('should pass options to fetch', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({})
      });

      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      };

      await makeApiCall('https://api.example.com/test', options);

      expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/test', options);
    });
  });

  describe('authenticatedApiCall', () => {
    it('should add Authorization header with bearer token', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({ success: true })
      });

      await authenticatedApiCall('https://api.example.com/test', {}, 'test-token-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should work without token', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({ success: true })
      });

      await authenticatedApiCall('https://api.example.com/test', {});

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should merge existing headers', async() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({ success: true })
      });

      await authenticatedApiCall(
        'https://api.example.com/test',
        { headers: { 'X-Custom': 'value' } },
        'token'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token',
            'Content-Type': 'application/json',
            'X-Custom': 'value'
          })
        })
      );
    });

    it('should propagate errors from makeApiCall', async() => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Access denied' }))
      });

      const result = await authenticatedApiCall('https://api.example.com/test', {}, 'token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
      expect(result.status).toBe(403);
    });
  });
});

