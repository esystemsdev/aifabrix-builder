/**
 * Jest Configuration for Coverage Reports
 * Extends base config with coverage settings
 */

const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  collectCoverageFrom: [
    'lib/**/*.js',
    'bin/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!lib/infra.js',
    '!bin/aifabrix.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  // Memory management for coverage runs
  maxWorkers: 2,
  workerIdleMemoryLimit: '500MB'
};

