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
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Normal test timeout (integration tests specify their own timeout)
  testTimeout: 30000, // 30 seconds for unit tests
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};
