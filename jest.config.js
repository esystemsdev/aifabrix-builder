// Detect CI environment (GitHub Actions, CI simulation, etc.)
const isCI = process.env.CI === 'true' || process.env.CI_SIMULATION === 'true';

module.exports = {
  projects: [
    // Run schema-validation in isolation first (avoids fs mock interference from other tests)
    {
      displayName: 'schema-validation',
      testMatch: ['**/tests/lib/schema/schema-validation.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: isCI ? 10000 : 5000,
      verbose: true
    },
    // All other tests
    {
      displayName: 'default',
      testEnvironment: 'node',
      testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
      ],
      testPathIgnorePatterns: (() => {
        const patterns = [
          '/node_modules/',
          '\\\\node_modules\\\\',
          '/tests/integration/',
          '\\\\tests\\\\integration\\\\',
          '/tests/lib/schema/schema-validation.test.js', // Handled by schema-validation project
          '\\\\tests\\\\lib\\\\schema\\\\schema-validation.test.js'
        ];
        if (process.env.INCLUDE_LOCAL_TESTS !== 'true') {
          patterns.push('/tests/local/');
          patterns.push('\\\\tests\\\\local\\\\');
        }
        return patterns;
      })(),
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: isCI ? 10000 : 5000,
      verbose: true,
      forceExit: true,
      detectOpenHandles: true,
      maxWorkers: isCI ? 2 : '50%'
    }
  ]
};
