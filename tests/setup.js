/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console output during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock global fetch to prevent real HTTP calls
// Default implementation returns a successful JSON response
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: {
    get: jest.fn().mockReturnValue('application/json')
  },
  json: jest.fn().mockResolvedValue({ success: true }),
  text: jest.fn().mockResolvedValue('OK')
});

// Mock axios to prevent real HTTP calls
// Default implementation returns a successful response
jest.mock('axios', () => {
  const axios = jest.requireActual('axios');
  return {
    ...axios,
    default: {
      ...axios.default,
      get: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      post: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      put: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      delete: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      patch: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      request: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' })
    },
    get: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
    post: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
    put: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
    delete: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
    patch: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
    request: jest.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' })
  };
});

// Global test utilities
global.testUtils = {
  // Helper to create temporary test files
  createTempFile: (content) => {
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = path.join(tempDir, `test-${Date.now()}.tmp`);
    fs.writeFileSync(tempFile, content);
    return tempFile;
  },

  // Helper to clean up temporary files
  cleanupTempFiles: () => {
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
};

// Reset mocks before each test to ensure clean state
// NOTE: We do NOT call jest.resetModules() here because:
// 1. It can cause real modules to load if they're required after resetModules()
// 2. jest.mock() calls are hoisted and persist anyway
// 3. Most tests don't need module cache reset - they just need mock state reset
beforeEach(() => {
  // Reset fetch mock to default implementation
  if (global.fetch && typeof global.fetch.mockClear === 'function') {
    global.fetch.mockClear();
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: jest.fn().mockReturnValue('application/json')
      },
      json: jest.fn().mockResolvedValue({ success: true }),
      text: jest.fn().mockResolvedValue('OK')
    });
  }

  // Clear all mocks to ensure clean state between tests
  // This resets mock call history but keeps the mock implementations
  jest.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  global.testUtils.cleanupTempFiles();
});

// Cleanup after all tests
afterAll(() => {
  global.testUtils.cleanupTempFiles();
});
