// Detect CI environment (GitHub Actions, CI simulation, etc.)
const isCI = process.env.CI === 'true' || process.env.CI_SIMULATION === 'true';

module.exports = {
  projects: [
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
          '\\\\tests\\\\integration\\\\'
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
