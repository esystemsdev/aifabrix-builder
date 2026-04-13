/**
 * Shared Jest project definitions (default + isolated). Split configs run in separate processes
 * so `jest.mock('fs')` in the default suite cannot leak into isolated workers.
 * @fileoverview
 */

// Detect CI environment (GitHub Actions, CI simulation, etc.)
const isCI = process.env.CI === 'true' || process.env.CI_SIMULATION === 'true';

const sharedTransform = {
  '^.+\\.js$': ['babel-jest', {
    configFile: false,
    babelrc: false,
    presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    plugins: ['@babel/plugin-syntax-optional-chaining']
  }]
};

/**
 * Single-file Jest project (fresh module graph when run in a separate process).
 * @param {string} displayName - Jest project display name
 * @param {string[]} testMatch - Glob patterns for test files
 * @returns {object} Jest project configuration object
 */
function makeIsolatedProject(displayName, testMatch) {
  return {
    displayName,
    testEnvironment: 'node',
    transform: sharedTransform,
    testMatch,
    testPathIgnorePatterns: ['/node_modules/', '\\\\node_modules\\\\'],
    setupFiles: ['<rootDir>/tests/capture-real-fs.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: isCI ? 10000 : 5000,
    maxWorkers: 1
  };
}

const defaultProject = {
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
      'lib/utils/cli-utils.test.js',
      'lib/utils/external-system-display.test.js',
      '/tests/lib/utils/cli-utils.test.js',
      '/tests/lib/utils/external-system-display.test.js',
      '/tests/lib/utils/dev-hosts-helper.test.js',
      '/tests/lib/utils/declarative-url-matrix-d-reload.test.js',
      '/tests/lib/utils/datasource-validation-watch.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\cli-utils.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\external-system-display.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\dev-hosts-helper.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\declarative-url-matrix-d-reload.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\datasource-validation-watch.test.js',
      'lib/utils/dev-hosts-helper.test.js',
      'lib/utils/declarative-url-matrix-d-reload.test.js',
      'lib/utils/datasource-validation-watch.test.js',
      'dev-hosts-helper\\.test\\.js',
      'declarative-url-matrix-d-reload\\.test\\.js',
      '/tests/lib/commands/parameters-validate.test.js',
      '\\\\tests\\\\lib\\\\commands\\\\parameters-validate.test.js',
      'lib/commands/parameters-validate.test.js',
      'parameters-validate\\.test\\.js',
      '/tests/lib/utils/datasource-test-run-schema-sync.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\datasource-test-run-schema-sync.test.js',
      'lib/utils/datasource-test-run-schema-sync.test.js',
      '/tests/lib/parameters/infra-platform-contract.test.js',
      '\\\\tests\\\\lib\\\\parameters\\\\infra-platform-contract.test.js',
      'lib/parameters/infra-platform-contract.test.js',
      '/tests/lib/parameters/database-secret-values.test.js',
      '\\\\tests\\\\lib\\\\parameters\\\\database-secret-values.test.js',
      'lib/parameters/database-secret-values.test.js',
      'database-secret-values\\.test\\.js',
      '/tests/lib/parameters/infra-parameter-validate.test.js',
      '\\\\tests\\\\lib\\\\parameters\\\\infra-parameter-validate.test.js',
      'lib/parameters/infra-parameter-validate.test.js',
      'infra-parameter-validate\\.test\\.js',
      '/tests/lib/parameters/infra-parameter-catalog.test.js',
      '\\\\tests\\\\lib\\\\parameters\\\\infra-parameter-catalog.test.js',
      'lib/parameters/infra-parameter-catalog.test.js',
      'infra-parameter-catalog\\.test\\.js',
      '/tests/lib/utils/urls-local-registry.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\urls-local-registry.test.js',
      'lib/utils/urls-local-registry.test.js',
      'urls-local-registry\\.test\\.js',
      '/tests/lib/utils/aifabrix-runtime-config-dir.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\aifabrix-runtime-config-dir.test.js',
      'lib/utils/aifabrix-runtime-config-dir.test.js',
      'aifabrix-runtime-config-dir\\.test\\.js',
      '/tests/lib/parameters/platform-env-template-kv-catalog.test.js',
      '\\\\tests\\\\lib\\\\parameters\\\\platform-env-template-kv-catalog.test.js',
      'lib/parameters/platform-env-template-kv-catalog.test.js',
      'platform-env-template-kv-catalog\\.test\\.js',
      '/tests/lib/infrastructure/resolve-infra-state-paths.test.js',
      '\\\\tests\\\\lib\\\\infrastructure\\\\resolve-infra-state-paths.test.js',
      'lib/infrastructure/resolve-infra-state-paths.test.js',
      'resolve-infra-state-paths\\.test\\.js',
      '/tests/lib/utils/dev-ssh-config-helper.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\dev-ssh-config-helper.test.js',
      'lib/utils/dev-ssh-config-helper.test.js',
      'dev-ssh-config-helper\\.test\\.js',
      '/tests/lib/utils/ssh-key-helper.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\ssh-key-helper.test.js',
      'lib/utils/ssh-key-helper.test.js',
      'ssh-key-helper\\.test\\.js',
      '/tests/lib/core/secrets-ensure-catalog-fallback.test.js',
      '\\\\tests\\\\lib\\\\core\\\\secrets-ensure-catalog-fallback.test.js',
      'lib/core/secrets-ensure-catalog-fallback.test.js',
      'secrets-ensure-catalog-fallback\\.test\\.js'
    ];
    if (process.env.INCLUDE_LOCAL_TESTS !== 'true') {
      patterns.push('/tests/local/');
      patterns.push('\\\\tests\\\\local\\\\');
    }
    return patterns;
  })(),
  setupFiles: ['<rootDir>/tests/capture-real-fs.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: isCI ? 10000 : 5000,
  detectOpenHandles: true,
  maxWorkers: 1
};

const isolatedProjects = [
  makeIsolatedProject('cli-utils', ['**/tests/lib/utils/cli-utils.test.js']),
  makeIsolatedProject('external-system-display', ['**/tests/lib/utils/external-system-display.test.js']),
  makeIsolatedProject('dev-hosts-helper', ['**/tests/lib/utils/dev-hosts-helper.test.js']),
  makeIsolatedProject('declarative-url-matrix-d-reload', [
    '**/tests/lib/utils/declarative-url-matrix-d-reload.test.js'
  ]),
  makeIsolatedProject('parameters-validate', ['**/tests/lib/commands/parameters-validate.test.js']),
  makeIsolatedProject('datasource-validation-watch', [
    '**/tests/lib/utils/datasource-validation-watch.test.js'
  ]),
  makeIsolatedProject('datasource-test-run-schema-sync', [
    '**/tests/lib/utils/datasource-test-run-schema-sync.test.js'
  ]),
  makeIsolatedProject('infra-platform-contract', [
    '**/tests/lib/parameters/infra-platform-contract.test.js'
  ]),
  makeIsolatedProject('database-secret-values', [
    '**/tests/lib/parameters/database-secret-values.test.js'
  ]),
  makeIsolatedProject('infra-parameter-validate', [
    '**/tests/lib/parameters/infra-parameter-validate.test.js'
  ]),
  makeIsolatedProject('infra-parameter-catalog', [
    '**/tests/lib/parameters/infra-parameter-catalog.test.js'
  ]),
  makeIsolatedProject('urls-local-registry', ['**/tests/lib/utils/urls-local-registry.test.js']),
  makeIsolatedProject('aifabrix-runtime-config-dir', [
    '**/tests/lib/utils/aifabrix-runtime-config-dir.test.js'
  ]),
  makeIsolatedProject('platform-env-template-kv-catalog', [
    '**/tests/lib/parameters/platform-env-template-kv-catalog.test.js'
  ]),
  makeIsolatedProject('resolve-infra-state-paths', [
    '**/tests/lib/infrastructure/resolve-infra-state-paths.test.js'
  ]),
  makeIsolatedProject('dev-ssh-config-helper', [
    '**/tests/lib/utils/dev-ssh-config-helper.test.js'
  ]),
  makeIsolatedProject('ssh-key-helper', ['**/tests/lib/utils/ssh-key-helper.test.js']),
  makeIsolatedProject('secrets-ensure-catalog-fallback', [
    '**/tests/lib/core/secrets-ensure-catalog-fallback.test.js'
  ])
];

const allProjects = [defaultProject, ...isolatedProjects];

module.exports = {
  isCI,
  sharedTransform,
  makeIsolatedProject,
  defaultProject,
  isolatedProjects,
  allProjects
};
