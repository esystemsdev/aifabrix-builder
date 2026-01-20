// Detect CI environment (GitHub Actions, CI simulation, etc.)
const isCI = process.env.CI === 'true' || process.env.CI_SIMULATION === 'true';

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  // Exclude integration tests from normal test runs
  // Exclude local tests by default (they're meant for isolated local development)
  // Local tests can be run with: INCLUDE_LOCAL_TESTS=true npm test
  // Or individually: npx jest tests/local/lib/filename.test.js --testPathIgnorePatterns='[]'
  testPathIgnorePatterns: (() => {
    const patterns = [
      '/node_modules/',
      '\\\\node_modules\\\\',
      '/tests/integration/',
      '\\\\tests\\\\integration\\\\'
    ];
    // Include local tests only if explicitly enabled with INCLUDE_LOCAL_TESTS=true
    // Local tests are flaky when run with other tests due to fs mock isolation issues
    // They work when run individually but have conflicts with global Jest setup
    if (process.env.INCLUDE_LOCAL_TESTS !== 'true') {
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
