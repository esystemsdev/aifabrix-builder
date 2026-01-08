/**
 * Tests for AI Fabrix Builder Health Check Utilities
 *
 * @fileoverview Unit tests for health-check.js module
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

// Mock chalk before requiring modules that use it
jest.mock('chalk', () => {
  const mockChalk = (text) => text;
  mockChalk.blue = jest.fn((text) => text);
  mockChalk.green = jest.fn((text) => text);
  mockChalk.red = jest.fn((text) => text);
  mockChalk.yellow = jest.fn((text) => text);
  mockChalk.cyan = jest.fn((text) => text);
  mockChalk.magenta = jest.fn((text) => text);
  mockChalk.white = jest.fn((text) => text);
  mockChalk.gray = jest.fn((text) => text);
  mockChalk.bold = jest.fn((text) => text);
  mockChalk.dim = jest.fn((text) => text);
  mockChalk.italic = jest.fn((text) => text);
  mockChalk.underline = jest.fn((text) => text);
  mockChalk.strikethrough = jest.fn((text) => text);
  mockChalk.reset = jest.fn((text) => text);
  mockChalk.inverse = jest.fn((text) => text);
  mockChalk.black = jest.fn((text) => text);
  mockChalk.redBright = jest.fn((text) => text);
  mockChalk.greenBright = jest.fn((text) => text);
  mockChalk.yellowBright = jest.fn((text) => text);
  mockChalk.blueBright = jest.fn((text) => text);
  mockChalk.magentaBright = jest.fn((text) => text);
  mockChalk.cyanBright = jest.fn((text) => text);
  mockChalk.whiteBright = jest.fn((text) => text);
  mockChalk.bgBlack = jest.fn((text) => text);
  mockChalk.bgRed = jest.fn((text) => text);
  mockChalk.bgGreen = jest.fn((text) => text);
  mockChalk.bgYellow = jest.fn((text) => text);
  mockChalk.bgBlue = jest.fn((text) => text);
  mockChalk.bgMagenta = jest.fn((text) => text);
  mockChalk.bgCyan = jest.fn((text) => text);
  mockChalk.bgWhite = jest.fn((text) => text);
  mockChalk.bgBlackBright = jest.fn((text) => text);
  mockChalk.bgRedBright = jest.fn((text) => text);
  mockChalk.bgGreenBright = jest.fn((text) => text);
  mockChalk.bgYellowBright = jest.fn((text) => text);
  mockChalk.bgBlueBright = jest.fn((text) => text);
  mockChalk.bgMagentaBright = jest.fn((text) => text);
  mockChalk.bgCyanBright = jest.fn((text) => text);
  mockChalk.bgWhiteBright = jest.fn((text) => text);
  return mockChalk;
});

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn)
}));

jest.mock('../../lib/utils/logger', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

jest.mock('http');

const healthCheck = require('../../lib/utils/health-check');

describe('Health Check Utilities', () => {
  let execAsync;
  let logger;
  let mockHttpRequest;
  let mockResponseHandlers;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    execAsync = promisify(exec);
    logger = require('../../lib/utils/logger');

    // Setup default mock for execAsync
    execAsync.mockResolvedValue({ stdout: '', stderr: '' });

    // Setup mock for http.request with proper request/response handling
    mockResponseHandlers = {
      data: [],
      end: null,
      error: null,
      timeout: null
    };

    mockHttpRequest = {
      on: jest.fn((event, handler) => {
        if (event === 'error') {
          mockResponseHandlers.error = handler;
        } else if (event === 'timeout') {
          mockResponseHandlers.timeout = handler;
        }
      }),
      destroy: jest.fn(),
      end: jest.fn()
    };

    http.request.mockImplementation((options, callback) => {
      // Call the callback with a mock response object
      const mockResponse = {
        statusCode: 200,
        headers: {},
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            mockResponseHandlers.data.push(handler);
          } else if (event === 'end') {
            mockResponseHandlers.end = handler;
          }
        })
      };

      // Call the callback synchronously for testing with fake timers
      if (callback) {
        callback(mockResponse);
      }

      return mockHttpRequest;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    // Reset handlers
    mockResponseHandlers = {
      data: [],
      end: null,
      error: null,
      timeout: null
    };
  });

  describe('waitForHealthCheck', () => {
    describe('db-init container handling', () => {
      it('should check db-init container exists and is already completed', async() => {
        execAsync.mockImplementation((cmd) => {
          if (cmd.includes('docker ps -a')) {
            return Promise.resolve({ stdout: 'aifabrix-test-app-db-init\n', stderr: '' });
          }
          if (cmd.includes('docker inspect') && cmd.includes('State.Status')) {
            return Promise.resolve({ stdout: 'exited\n', stderr: '' });
          }
          if (cmd.includes('docker inspect') && cmd.includes('State.ExitCode')) {
            return Promise.resolve({ stdout: '0\n', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

        // Mock successful HTTP health check
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Database initialization already completed'));
      });

      it('should log warning when db-init exits with non-zero code', async() => {
        execAsync.mockImplementation((cmd) => {
          if (cmd.includes('docker ps -a')) {
            return Promise.resolve({ stdout: 'aifabrix-test-app-db-init\n', stderr: '' });
          }
          if (cmd.includes('docker inspect') && cmd.includes('State.Status')) {
            return Promise.resolve({ stdout: 'exited\n', stderr: '' });
          }
          if (cmd.includes('docker inspect') && cmd.includes('State.ExitCode')) {
            return Promise.resolve({ stdout: '1\n', stderr: '' });
          }
          if (cmd.includes('docker inspect') && cmd.includes('NetworkSettings.Ports')) {
            return Promise.resolve({ stdout: '3000/tcp\n', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

        // Mock successful HTTP health check
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Database initialization exited with code'));
      });

      it('should wait for db-init container to complete', async() => {
        let inspectCallCount = 0;
        execAsync.mockImplementation((cmd) => {
          if (cmd.includes('docker ps -a')) {
            return Promise.resolve({ stdout: 'aifabrix-test-app-db-init\n', stderr: '' });
          }
          if (cmd.includes('docker inspect') && cmd.includes('State.Status')) {
            inspectCallCount++;
            if (inspectCallCount === 1) {
              return Promise.resolve({ stdout: 'running\n', stderr: '' });
            }
            return Promise.resolve({ stdout: 'exited\n', stderr: '' });
          }
          if (cmd.includes('docker inspect') && cmd.includes('State.ExitCode')) {
            return Promise.resolve({ stdout: '0\n', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

        // Mock successful HTTP health check
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 10, 3000);

        // Fast-forward timers to simulate waiting
        jest.advanceTimersByTime(1000);

        await expect(promise).resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Waiting for database initialization'));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Database initialization completed'));
      });

      it('should handle db-init container exiting with non-zero code during wait', async() => {
        let inspectCallCount = 0;
        execAsync.mockImplementation((cmd) => {
          if (cmd.includes('docker ps -a')) {
            return Promise.resolve({ stdout: 'aifabrix-test-app-db-init\n', stderr: '' });
          }
          if (cmd.includes('docker inspect') && cmd.includes('State.Status')) {
            inspectCallCount++;
            if (inspectCallCount === 1) {
              return Promise.resolve({ stdout: 'running\n', stderr: '' });
            }
            return Promise.resolve({ stdout: 'exited\n', stderr: '' });
          }
          if (cmd.includes('docker inspect') && cmd.includes('State.ExitCode')) {
            return Promise.resolve({ stdout: '1\n', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

        // Mock successful HTTP health check
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 10, 3000);

        // Fast-forward timers to simulate waiting
        jest.advanceTimersByTime(1000);

        await expect(promise).resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Waiting for database initialization'));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Database initialization exited with code'));
      });

      it('should handle db-init container not existing', async() => {
        execAsync.mockImplementation((cmd) => {
          if (cmd.includes('docker ps -a')) {
            return Promise.resolve({ stdout: '', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

        // Mock successful HTTP health check
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();
      });

      it('should handle db-init container error gracefully', async() => {
        execAsync.mockImplementation((cmd) => {
          if (cmd.includes('docker ps -a')) {
            return Promise.reject(new Error('Docker error'));
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

        // Mock successful HTTP health check
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();
      });
    });

    describe('port detection', () => {
      it('should auto-detect port from container', async() => {
        execAsync.mockImplementation((cmd) => {
          if (cmd.includes('docker inspect') && cmd.includes('NetworkSettings.Ports')) {
            return Promise.resolve({ stdout: '3000\n', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

        // Mock successful HTTP health check
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, null))
          .resolves.not.toThrow();

        expect(http.request).toHaveBeenCalledWith(
          expect.objectContaining({
            hostname: 'localhost',
            port: '3000',
            path: '/health'
          }),
          expect.any(Function)
        );
      });

      it('should use default port when container port detection fails', async() => {
        execAsync.mockImplementation((cmd) => {
          if (cmd.includes('docker inspect') && cmd.includes('NetworkSettings.Ports')) {
            return Promise.reject(new Error('Docker error'));
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

        // Mock successful HTTP health check
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, null))
          .resolves.not.toThrow();

        expect(http.request).toHaveBeenCalledWith(
          expect.objectContaining({
            hostname: 'localhost',
            port: '3000',
            path: '/health'
          }),
          expect.any(Function)
        );
      });

      it('should use default port when no ports found', async() => {
        // Use real timers for this test to avoid timing issues with fake timers
        jest.useRealTimers();

        const { exec } = require('child_process');
        exec.mockImplementation((command, options, callback) => {
          const cb = typeof options === 'function' ? options : callback;
          // Mock db-init container check - return immediately (already completed)
          if (command.includes('docker ps -a')) {
            if (cb) setImmediate(() => cb(null, { stdout: 'aifabrix-test-app-db-init\n', stderr: '' }));
          } else if (command.includes('docker inspect') && command.includes('State.Status')) {
            if (cb) setImmediate(() => cb(null, { stdout: 'exited\n', stderr: '' }));
          } else if (command.includes('docker inspect') && command.includes('State.ExitCode')) {
            if (cb) setImmediate(() => cb(null, { stdout: '0\n', stderr: '' }));
          } else if (command.includes('docker inspect') && command.includes('NetworkSettings.Ports')) {
            // Mock port detection returning empty (newline only)
            if (cb) setImmediate(() => cb(null, { stdout: '\n', stderr: '' }));
          } else if (command.includes('docker ps --filter')) {
            // Mock docker ps fallback returning empty
            if (cb) setImmediate(() => cb(null, { stdout: '', stderr: '' }));
          } else {
            if (cb) setImmediate(() => cb(null, { stdout: '', stderr: '' }));
          }
        });

        // Mock successful HTTP health check - use setImmediate for real timers
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              // Use setImmediate for real timers to ensure handlers are called asynchronously
              if (event === 'data') {
                setImmediate(() => handler(Buffer.from(JSON.stringify({ status: 'ok' }))));
              }
              if (event === 'end') {
                setImmediate(() => handler());
              }
            })
          };
          // Call callback asynchronously for real timers
          if (callback) {
            setImmediate(() => callback(mockResponse));
          }
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, null))
          .resolves.not.toThrow();

        expect(http.request).toHaveBeenCalledWith(
          expect.objectContaining({
            hostname: 'localhost',
            port: '3000',
            path: '/health'
          }),
          expect.any(Function)
        );

        // Restore fake timers for other tests
        jest.useFakeTimers();
      });
    });

    describe('health check path configuration', () => {
      it('should use custom health check path from config', async() => {
        const config = {
          healthCheck: {
            path: '/api/health'
          }
        };

        // Mock successful HTTP health check
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000, config))
          .resolves.not.toThrow();

        expect(http.request).toHaveBeenCalledWith(
          expect.objectContaining({
            path: '/api/health'
          }),
          expect.any(Function)
        );
      });

      it('should use default /health path when not configured', async() => {
        // Mock successful HTTP health check
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();

        expect(http.request).toHaveBeenCalledWith(
          expect.objectContaining({
            path: '/health'
          }),
          expect.any(Function)
        );
      });
    });

    describe('health check response formats', () => {
      it('should handle Keycloak format with status UP', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'UP', checks: [] })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application is healthy'));
      });

      it('should handle standard format with status ok and database connected', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok', database: 'connected' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application is healthy'));
      });

      it('should handle standard format with status ok and no database field', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application is healthy'));
      });

      it('should handle alternative format with status healthy', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'healthy', service: 'dataplane' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application is healthy'));
      });

      it('should handle success-based format with success true', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ success: true, message: 'Service is running' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application is healthy'));
      });

      it('should reject when status ok but database not connected', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok', database: 'disconnected' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 4, 3000);

        // Fast-forward timers to simulate retries and timeout
        jest.runAllTimersAsync();

        await expect(promise).rejects.toThrow('Health check timeout');
      });

      it('should handle non-JSON response with status 200', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from('OK'));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application is healthy'));
      });

      it('should reject non-JSON response with non-200 status', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 500,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from('Error'));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 4, 3000);

        // Fast-forward timers to simulate retries and timeout
        jest.runAllTimersAsync();

        await expect(promise).rejects.toThrow('Health check timeout');
      });

      it('should handle invalid JSON response', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from('invalid json'));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000))
          .resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application is healthy'));
      });

      it('should reject when health status is neither UP nor ok', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'down' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 4, 3000);

        // Fast-forward timers to simulate retries and timeout
        jest.runAllTimersAsync();

        await expect(promise).rejects.toThrow('Health check timeout');
      });
    });

    describe('debug mode', () => {
      it('should log debug information when debug is enabled', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        execAsync.mockImplementation((cmd) => {
          if (cmd.includes('docker inspect') && cmd.includes('NetworkSettings.Ports')) {
            return Promise.resolve({ stdout: '3000\n', stderr: '' });
          }
          return Promise.resolve({ stdout: '', stderr: '' });
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, null, null, true))
          .resolves.not.toThrow();

        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Health check URL'));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Health check result'));
      });

      it('should not log debug information when debug is disabled', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 200,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from(JSON.stringify({ status: 'ok' })));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        await expect(healthCheck.waitForHealthCheck('test-app', 10, 3000, null, false))
          .resolves.not.toThrow();

        const debugLogs = logger.log.mock.calls.filter(call => call[0].includes('[DEBUG]'));
        expect(debugLogs.length).toBe(0);
      });
    });

    describe('error handling', () => {
      it('should handle HTTP request errors', async() => {
        http.request.mockImplementation((options, callback) => {
          const req = {
            on: jest.fn((event, handler) => {
              if (event === 'error') {
                // Call handler synchronously
                handler(new Error('Network error'));
              }
            }),
            destroy: jest.fn(),
            end: jest.fn()
          };
          return req;
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 4, 3000);

        // Fast-forward timers to simulate retries and timeout
        jest.runAllTimersAsync();

        await expect(promise).rejects.toThrow('Health check timeout');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Waiting for health check'));
      });

      it('should handle HTTP request timeout', async() => {
        http.request.mockImplementation((options, callback) => {
          const req = {
            on: jest.fn((event, handler) => {
              if (event === 'timeout') {
                // Call handler synchronously
                handler();
              }
            }),
            destroy: jest.fn(),
            end: jest.fn()
          };
          return req;
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 4, 3000);

        // Fast-forward timers to simulate retries and timeout
        jest.runAllTimersAsync();

        await expect(promise).rejects.toThrow('Health check timeout');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Waiting for health check'));
      });

      it('should retry health check on failure', async() => {
        let callCount = 0;
        http.request.mockImplementation((options, callback) => {
          callCount++;
          const mockResponse = {
            statusCode: callCount === 2 ? 200 : 500,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                if (callCount === 2) {
                  handler(Buffer.from(JSON.stringify({ status: 'ok' })));
                } else {
                  handler(Buffer.from('Error'));
                }
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 10, 3000);

        // Fast-forward all timers to allow retry
        await jest.runAllTimersAsync();

        await expect(promise).resolves.not.toThrow();

        expect(http.request).toHaveBeenCalledTimes(2);
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Waiting for health check'));
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Application is healthy'));
      });

      it('should handle exceptions during health check', async() => {
        http.request.mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 4, 3000);

        // Fast-forward timers to simulate retries and timeout
        jest.runAllTimersAsync();

        await expect(promise).rejects.toThrow('Health check timeout');
        expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Waiting for health check'));
      });
    });

    describe('timeout handling', () => {
      it('should throw error after timeout', async() => {
        http.request.mockImplementation((options, callback) => {
          const mockResponse = {
            statusCode: 500,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from('Error'));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 4, 3000);

        // Fast-forward timers to exceed timeout
        jest.runAllTimersAsync();

        await expect(promise).rejects.toThrow('Health check timeout after 4 seconds');
      });

      it('should not log waiting message on final attempt', async() => {
        let attemptCount = 0;
        http.request.mockImplementation((options, callback) => {
          attemptCount++;
          const mockResponse = {
            statusCode: 500,
            headers: {},
            on: jest.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from('Error'));
              }
              if (event === 'end') {
                handler();
              }
            })
          };
          // Call callback synchronously for testing with fake timers
          if (callback) callback(mockResponse);
          return mockHttpRequest;
        });

        const promise = healthCheck.waitForHealthCheck('test-app', 4, 3000);

        // Fast-forward timers to exceed timeout
        jest.runAllTimersAsync();

        await expect(promise).rejects.toThrow('Health check timeout');

        // Verify that waiting messages were logged but not on the final attempt
        const waitingLogs = logger.log.mock.calls.filter(call =>
          call[0].includes('Waiting for health check')
        );
        expect(waitingLogs.length).toBeGreaterThan(0);
        expect(waitingLogs.length).toBeLessThan(3); // Max attempts = timeout/2 = 4/2 = 2
      });
    });
  });

  describe('checkHealthEndpoint', () => {
    it('should return true for healthy response with status UP', async() => {
      http.request.mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          headers: {},
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from(JSON.stringify({ status: 'UP' })));
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        if (callback) callback(mockResponse);
        return mockHttpRequest;
      });

      const result = await healthCheck.checkHealthEndpoint('http://localhost:3000/health');
      expect(result).toBe(true);
    });

    it('should return true for healthy response with status healthy', async() => {
      http.request.mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          headers: {},
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from(JSON.stringify({ status: 'healthy' })));
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        if (callback) callback(mockResponse);
        return mockHttpRequest;
      });

      const result = await healthCheck.checkHealthEndpoint('http://localhost:3000/health');
      expect(result).toBe(true);
    });

    it('should return true for healthy response with success true', async() => {
      http.request.mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          headers: {},
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from(JSON.stringify({ success: true })));
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        if (callback) callback(mockResponse);
        return mockHttpRequest;
      });

      const result = await healthCheck.checkHealthEndpoint('http://localhost:3000/health');
      expect(result).toBe(true);
    });

    it('should return false for unhealthy response', async() => {
      http.request.mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          headers: {},
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from(JSON.stringify({ status: 'down' })));
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        if (callback) callback(mockResponse);
        return mockHttpRequest;
      });

      const result = await healthCheck.checkHealthEndpoint('http://localhost:3000/health');
      expect(result).toBe(false);
    });

    it('should return false on HTTP error', async() => {
      http.request.mockImplementation((options, callback) => {
        const req = {
          on: jest.fn((event, handler) => {
            if (event === 'error') {
              handler(new Error('Connection error'));
            }
          }),
          destroy: jest.fn(),
          end: jest.fn()
        };
        return req;
      });

      const result = await healthCheck.checkHealthEndpoint('http://localhost:3000/health');
      expect(result).toBe(false);
    });

    it('should return false on timeout', async() => {
      // Mock http.request to return a request that never responds
      http.request.mockImplementation((options, callback) => {
        const req = {
          on: jest.fn(),
          destroy: jest.fn(),
          end: jest.fn()
        };
        // Don't call callback or trigger any events - simulate timeout
        return req;
      });

      const promise = healthCheck.checkHealthEndpoint('http://localhost:3000/health');

      // Advance timers to trigger timeout (5 seconds = 5000ms)
      jest.advanceTimersByTime(5000);

      const result = await promise;
      expect(result).toBe(false);
      expect(http.request).toHaveBeenCalled();
    });

    it('should log debug information when debug is enabled', async() => {
      http.request.mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from(JSON.stringify({ status: 'ok' })));
            }
            if (event === 'end') {
              handler();
            }
          })
        };
        if (callback) callback(mockResponse);
        return mockHttpRequest;
      });

      await healthCheck.checkHealthEndpoint('http://localhost:3000/health', true);

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Health check request'));
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Response status code'));
    });

    it('should throw error on invalid URL', async() => {
      await expect(healthCheck.checkHealthEndpoint('invalid-url'))
        .rejects.toThrow();
    });
  });
});

