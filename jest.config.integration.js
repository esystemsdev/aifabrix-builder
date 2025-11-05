/**
 * Jest Configuration for Integration Tests
 * Ensures tests run in correct order with proper error handling
 *
 * @fileoverview Jest config specifically for integration tests
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  // Override testPathIgnorePatterns for integration tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\\\node_modules\\\\'
  ],
  // Use custom test sequencer for correct order
  testSequencer: '<rootDir>/tests/integration/test-sequencer.js',
  // Longer timeout for integration tests
  testTimeout: 300000, // 5 minutes
  // Run tests sequentially
  maxWorkers: 1,
  // Don't ignore integration tests
  testMatch: [
    '**/tests/integration/**/*.test.js'
  ]
};

