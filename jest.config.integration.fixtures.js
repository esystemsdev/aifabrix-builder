/**
 * Integration tests that do not build images or talk to Docker.
 * Use: npm run test:integration:fixtures
 *
 * Full Docker lifecycle tests: npm run test:integration (includes steps/ + workflow).
 *
 * @fileoverview Fixture-only integration Jest config
 */

const { sharedTransform } = require('./jest.projects');

module.exports = {
  displayName: 'integration-fixtures',
  testEnvironment: 'node',
  transform: sharedTransform,
  testMatch: ['**/tests/integration/hubspot/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '\\\\node_modules\\\\'],
  maxWorkers: 1,
  setupFiles: ['<rootDir>/tests/capture-real-fs.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 60000
};
