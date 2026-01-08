// Detect CI environment (GitHub Actions, CI simulation, etc.)
const isCI = process.env.CI === 'true' || process.env.CI_SIMULATION === 'true';

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  // Exclude integration tests from normal test runs
  // Exclude local tests when running in CI (they're brittle and meant for local development only)
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\\\node_modules\\\\',
    '/tests/integration/',
    '\\\\tests\\\\integration\\\\',
    // Exclude local tests in CI environments
    ...(isCI ? [
      '/tests/local/',
      '\\\\tests\\\\local\\\\'
    ] : [])
  ],
  // Coverage is disabled for normal tests - use test:coverage for coverage reports
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Normal test timeout (integration tests specify their own timeout)
  testTimeout: 5000, // 5 seconds for unit tests (should be < 0.5s with proper mocking)
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};
