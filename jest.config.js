// Detect CI environment (GitHub Actions, CI simulation, etc.)
const isCI = process.env.CI === 'true' || process.env.CI_SIMULATION === 'true';

// Run in separate processes so they never share module cache with jest.fn() mocks
// (avoids Symbol.hasInstance stack overflow when loaded in same worker as other tests).
const sharedTransform = {
  '^.+\\.js$': ['babel-jest', {
    configFile: false,
    babelrc: false,
    presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    plugins: ['@babel/plugin-syntax-optional-chaining']
  }]
};

/**
 * Builds a Jest project config that runs a single test file in isolation (own process).
 * @param {string} displayName - Project display name
 * @param {string[]} testMatch - Glob patterns for test files
 * @returns {Object} Jest project configuration
 */
function makeIsolatedProject(displayName, testMatch) {
  return {
    displayName,
    testEnvironment: 'node',
    transform: sharedTransform,
    testMatch,
    testPathIgnorePatterns: ['/node_modules/', '\\\\node_modules\\\\'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: isCI ? 10000 : 5000,
    maxWorkers: 1
  };
}

module.exports = {
  projects: [
    {
      displayName: 'default',
      testEnvironment: 'node',
      transform: sharedTransform,
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
          '/tests/manual/',
          '\\\\tests\\\\manual\\\\',
          // Exclude isolated suites so they never run in default worker (avoids
          // Symbol.hasInstance stack overflow when logger is mocked with jest.fn() elsewhere).
          'lib/utils/cli-utils.test.js',
          'lib/utils/external-system-display.test.js',
          '/tests/lib/utils/cli-utils.test.js',
          '/tests/lib/utils/external-system-display.test.js',
          '/tests/lib/utils/dev-hosts-helper.test.js',
          '/tests/lib/utils/datasource-validation-watch.test.js',
          '\\\\tests\\\\lib\\\\utils\\\\cli-utils.test.js',
          '\\\\tests\\\\lib\\\\utils\\\\external-system-display.test.js',
          '\\\\tests\\\\lib\\\\utils\\\\dev-hosts-helper.test.js',
          '\\\\tests\\\\lib\\\\utils\\\\datasource-validation-watch.test.js',
          'lib/utils/dev-hosts-helper.test.js',
          'lib/utils/datasource-validation-watch.test.js',
          '/tests/lib/utils/datasource-test-run-schema-sync.test.js',
          '\\\\tests\\\\lib\\\\utils\\\\datasource-test-run-schema-sync.test.js',
          'lib/utils/datasource-test-run-schema-sync.test.js'
        ];
        if (process.env.INCLUDE_LOCAL_TESTS !== 'true') {
          patterns.push('/tests/local/');
          patterns.push('\\\\tests\\\\local\\\\');
        }
        return patterns;
      })(),
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: isCI ? 10000 : 5000,
      detectOpenHandles: true,
      maxWorkers: isCI ? 2 : '50%'
    },
    makeIsolatedProject('cli-utils', ['**/tests/lib/utils/cli-utils.test.js']),
    makeIsolatedProject('external-system-display', ['**/tests/lib/utils/external-system-display.test.js']),
    makeIsolatedProject('dev-hosts-helper', ['**/tests/lib/utils/dev-hosts-helper.test.js']),
    makeIsolatedProject('datasource-validation-watch', [
      '**/tests/lib/utils/datasource-validation-watch.test.js'
    ]),
    makeIsolatedProject('datasource-test-run-schema-sync', [
      '**/tests/lib/utils/datasource-test-run-schema-sync.test.js'
    ])
  ]
};
