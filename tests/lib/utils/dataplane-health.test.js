/**
 * Tests for Dataplane Health Check
 *
 * @fileoverview Tests for dataplane-health.js
 * @author AI Fabrix Team
 * @version 2.0.0
 */

// Mock global fetch
global.fetch = jest.fn();

const {
  checkDataplaneHealth,
  validateDataplaneHealth,
  testEndpoint
} = require('../../../lib/utils/dataplane-health');

describe('Dataplane Health Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure no per-test mock implementations leak between tests
    global.fetch.mockReset();
  });

  describe('testEndpoint', () => {
    it('should return true for successful response', async() => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      const result = await testEndpoint('https://dataplane.example.com/health', 5000);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://dataplane.example.com/health',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
      );
    });

    it('should return true for 404 response (service is reachable)', async() => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await testEndpoint('https://dataplane.example.com/health', 5000);

      expect(result).toBe(true);
    });

    it('should return true for 401 response (service is reachable)', async() => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await testEndpoint('https://dataplane.example.com/health', 5000);

      expect(result).toBe(true);
    });

    it('should return false for timeout', async() => {
      jest.useFakeTimers();

      // Mock fetch to delay longer than timeout
      global.fetch.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 200); // Longer than 50ms timeout
        });
      });

      const pending = testEndpoint('https://dataplane.example.com/health', 50);
      jest.advanceTimersByTime(60);
      const result = await pending;

      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalled();

      // Flush any remaining timers and restore real timers
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }, 1000); // Increase test timeout

    it('should return false for network error', async() => {
      // Mock fetch to reject immediately
      global.fetch.mockImplementationOnce(() => {
        return Promise.reject(new Error('Network error'));
      });

      const result = await testEndpoint('https://dataplane.example.com/health', 5000);

      // Network errors are caught and return false
      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('checkDataplaneHealth', () => {
    it('should return true if any endpoint is reachable', async() => {
      global.fetch
        .mockResolvedValueOnce({ ok: false, status: 404 }) // /health fails
        .mockResolvedValueOnce({ ok: true }); // /api/v1/health succeeds

      const result = await checkDataplaneHealth('https://dataplane.example.com', 5000);

      expect(result).toBe(true);
    });

    it('should return false if no endpoints are reachable', async() => {
      // Mock fetch to reject for all endpoints
      global.fetch.mockImplementation(() => Promise.reject(new Error('Network error')));

      const result = await checkDataplaneHealth('https://dataplane.example.com', 100);

      // All endpoints failed, should return false
      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalled();
    }, 5000); // Increase timeout for this test

    it('should return false for null URL', async() => {
      const result = await checkDataplaneHealth(null, 5000);

      expect(result).toBe(false);
    });

    it('should try multiple endpoints', async() => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      await checkDataplaneHealth('https://dataplane.example.com', 5000);

      expect(global.fetch).toHaveBeenCalledTimes(4); // /health, /api/v1/health, /api/health, ''
    });
  });

  describe('validateDataplaneHealth', () => {
    it('should return null if dataplane is healthy', async() => {
      global.fetch.mockResolvedValue({ ok: true });

      const result = await validateDataplaneHealth('https://dataplane.example.com');

      expect(result).toBeNull();
    });

    it('should return error if dataplane is unhealthy', async() => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await validateDataplaneHealth('https://dataplane.example.com');

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain('Dataplane is not reachable');
    });

    it('should return error with helpful message', async() => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await validateDataplaneHealth('https://dataplane.example.com');

      expect(result.message).toContain('https://dataplane.example.com');
      expect(result.message).toContain('curl');
    });
  });
});
