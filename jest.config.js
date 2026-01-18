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
  // Also exclude local tests if they're causing Babel compilation crashes
  // These tests can be run individually if needed for local development
  testPathIgnorePatterns: (() => {
    const patterns = [
      '/node_modules/',
      '\\\\node_modules\\\\',
      '/tests/integration/',
      '\\\\tests\\\\integration\\\\'
    ];
    // Exclude local tests in CI environments or if SKIP_LOCAL_TESTS is set
    if (isCI || process.env.SKIP_LOCAL_TESTS === 'true') {
      patterns.push('/tests/local/');
      patterns.push('\\\\tests\\\\local\\\\');
    }
    return patterns;
  })(),
  // Coverage is disabled for normal tests - use test:coverage for coverage reports
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Normal test timeout (integration tests specify their own timeout)
  // Increase timeout slightly in CI environments where tests may run slower
  testTimeout: isCI ? 10000 : 5000, // 10 seconds in CI, 5 seconds locally
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  // Improve test isolation in CI by reducing parallelism
  // This helps prevent race conditions and state leakage between tests
  maxWorkers: isCI ? 2 : '50%'
};
