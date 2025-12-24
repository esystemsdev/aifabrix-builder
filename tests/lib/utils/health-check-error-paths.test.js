/**
 * Tests for Health Check Error Paths
 *
 * @fileoverview Unit tests for health-check.js error handling paths
 * @author AI Fabrix Team
 * @version 2.0.0
 */

jest.mock('child_process');
jest.mock('../../../lib/utils/logger');
jest.mock('chalk', () => {
  const createMockFn = (text) => text;
  const mockChalk = createMockFn;
  ['blue', 'green', 'red', 'yellow', 'gray'].forEach(prop => {
    mockChalk[prop] = createMockFn;
  });
  return mockChalk;
});

const healthCheck = require('../../../lib/utils/health-check');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

describe('Health Check Error Paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('checkHealthEndpoint', () => {
    it('should handle network errors', async() => {
      const http = require('http');
      const mockReq = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Network error')), 10);
          }
        }),
        destroy: jest.fn(),
        end: jest.fn()
      };

      jest.spyOn(http, 'request').mockImplementation((options, callback) => {
        return mockReq;
      });

      const promise = healthCheck.checkHealthEndpoint('http://localhost:3000/health');
      jest.advanceTimersByTime(20);
      const result = await promise;
      expect(result).toBe(false);
    });

    it('should handle timeout scenarios', async() => {
      const http = require('http');
      const mockReq = {
        on: jest.fn(),
        destroy: jest.fn(),
        end: jest.fn()
      };

      jest.spyOn(http, 'request').mockImplementation((options, callback) => {
        // Don't call callback, simulate timeout
        return mockReq;
      });

      // Use fake timers to trigger timeout
      const promise = healthCheck.checkHealthEndpoint('http://localhost:3000/health');
      jest.advanceTimersByTime(6000);
      const result = await promise;
      expect(result).toBe(false);
      expect(mockReq.destroy).toHaveBeenCalled();
    });
  });
});

