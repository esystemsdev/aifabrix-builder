/**
 * Jest configuration for integration tests under tests/integration/ only.
 *
 * IMPORTANT: Do not spread ./jest.config.js here — that config sets `projects` (default +
 * isolated suites). Spreading it caused `test:integration` to run the entire multi-project
 * suite in one process, leaking mocks/module state between projects and producing flaky
 * failures. This file defines a single project matching docs/plans for npm run test:integration.
 *
 * @fileoverview Full integration Jest config: HubSpot fixtures, workflow shim, and
 *   tests/integration/steps/* (real Docker: create, build, run, health).
 *   For fixture-only tests without Docker, use jest.config.integration.fixtures.js
 *   (npm run test:integration:fixtures).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { sharedTransform } = require('./jest.projects');

module.exports = {
  displayName: 'integration',
  testEnvironment: 'node',
  transform: sharedTransform,
  testMatch: ['**/tests/integration/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '\\\\node_modules\\\\'],
  testSequencer: '<rootDir>/tests/integration/test-sequencer.js',
  testTimeout: 300000,
  maxWorkers: 1,
  setupFiles: ['<rootDir>/tests/capture-real-fs.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
