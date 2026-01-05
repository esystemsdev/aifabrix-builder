module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  // Exclude integration tests from normal test runs
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\\\node_modules\\\\',
    '/tests/integration/',
    '\\\\tests\\\\integration\\\\'
  ],
  // Coverage is disabled for normal tests - use test:coverage for coverage reports
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Normal test timeout (integration tests specify their own timeout)
  testTimeout: 30000, // 30 seconds for unit tests
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};
