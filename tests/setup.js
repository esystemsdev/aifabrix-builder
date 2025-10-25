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

// Cleanup after each test
afterEach(() => {
  global.testUtils.cleanupTempFiles();
});

// Cleanup after all tests
afterAll(() => {
  global.testUtils.cleanupTempFiles();
});
