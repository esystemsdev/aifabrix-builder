/**
 * Shared Jest project definitions (default + isolated). Split configs run in separate processes
 * so `jest.mock('fs')` in the default suite cannot leak into isolated workers.
 * @fileoverview
 */

const {
  globalLiveFabrixHooks,
  createSetupCiLiveFabrixGuardProject
} = require('./jest.global-live-fabrix-hooks');

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
    testTimeout: isCI ? 15000 : 8000,
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
      '/tests/lib/utils/register-aifabrix-shell-env.test.js',
      '/tests/lib/utils/datasource-validation-watch.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\cli-utils.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\external-system-display.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\dev-hosts-helper.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\register-aifabrix-shell-env.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\datasource-validation-watch.test.js',
      'lib/utils/dev-hosts-helper.test.js',
      'lib/utils/register-aifabrix-shell-env.test.js',
      'lib/utils/datasource-validation-watch.test.js',
      'dev-hosts-helper\\.test\\.js',
      'register-aifabrix-shell-env\\.test\\.js',
      '/tests/lib/datasource/log-viewer.test.js',
      '\\\\tests\\\\lib\\\\datasource\\\\log-viewer.test.js',
      'lib/datasource/log-viewer.test.js',
      '/tests/lib/datasource/log-viewer-structural.test.js',
      '/tests/lib/datasource/log-viewer-run.test.js',
      '\\\\tests\\\\lib\\\\datasource\\\\log-viewer-structural.test.js',
      '\\\\tests\\\\lib\\\\datasource\\\\log-viewer-run.test.js',
      'lib/datasource/log-viewer-structural.test.js',
      'lib/datasource/log-viewer-run.test.js',
      'log-viewer-run\\.test\\.js',
      '/tests/lib/commands/parameters-validate.test.js',
      '\\\\tests\\\\lib\\\\commands\\\\parameters-validate.test.js',
      'lib/commands/parameters-validate.test.js',
      'parameters-validate\\.test\\.js',
      '/tests/lib/commands/repair-openapi-sync.test.js',
      '\\\\tests\\\\lib\\\\commands\\\\repair-openapi-sync.test.js',
      'lib/commands/repair-openapi-sync.test.js',
      'repair-openapi-sync\\.test\\.js',
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
      'secrets-ensure-catalog-fallback\\.test\\.js',
      '/tests/lib/core/secrets-ensure.test.js',
      '\\\\tests\\\\lib\\\\core\\\\secrets-ensure.test.js',
      'lib/core/secrets-ensure.test.js',
      'secrets-ensure\\.test\\.js',
      '/tests/lib/utils/url-declarative-vdir-inactive-env.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\url-declarative-vdir-inactive-env.test.js',
      'lib/utils/url-declarative-vdir-inactive-env.test.js',
      'url-declarative-vdir-inactive-env\\.test\\.js',
      '/tests/lib/utils/url-declarative-user-cfg-per-app-proxy.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\url-declarative-user-cfg-per-app-proxy.test.js',
      'lib/utils/url-declarative-user-cfg-per-app-proxy.test.js',
      'url-declarative-user-cfg-per-app-proxy\\.test\\.js',
      '/tests/lib/utils/url-declarative-expand-traefik-off-no-usercfg.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\url-declarative-expand-traefik-off-no-usercfg.test.js',
      'lib/utils/url-declarative-expand-traefik-off-no-usercfg.test.js',
      'url-declarative-expand-traefik-off-no-usercfg\\.test\\.js',
      '/tests/lib/core/secrets-env-declarative-show-urls.test.js',
      '\\\\tests\\\\lib\\\\core\\\\secrets-env-declarative-show-urls.test.js',
      'lib/core/secrets-env-declarative-show-urls.test.js',
      'secrets-env-declarative-show-urls\\.test\\.js',
      '/tests/lib/utils/url-declarative-registry-internal-docker-origin.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\url-declarative-registry-internal-docker-origin.test.js',
      'lib/utils/url-declarative-registry-internal-docker-origin.test.js',
      'url-declarative-registry-internal-docker-origin\\.test\\.js',
      '/tests/lib/commands/platform-urls-registry.validation.test.js',
      '\\\\tests\\\\lib\\\\commands\\\\platform-urls-registry.validation.test.js',
      'lib/commands/platform-urls-registry.validation.test.js',
      'platform-urls-registry\\.validation\\.test\\.js',
      '/tests/lib/utils/env-copy-resolve-output.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\env-copy-resolve-output.test.js',
      'lib/utils/env-copy-resolve-output.test.js',
      'env-copy-resolve-output\\.test\\.js',
      '/tests/lib/utils/write-env-output-reload.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\write-env-output-reload.test.js',
      'lib/utils/write-env-output-reload.test.js',
      'write-env-output-reload\\.test\\.js',
      '/tests/lib/utils/app-service-env-from-builder.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\app-service-env-from-builder.test.js',
      'lib/utils/app-service-env-from-builder.test.js',
      'app-service-env-from-builder\\.test\\.js',
      '/tests/lib/parameters/infra-kv-discovery.test.js',
      '\\\\tests\\\\lib\\\\parameters\\\\infra-kv-discovery.test.js',
      'lib/parameters/infra-kv-discovery.test.js',
      'infra-kv-discovery\\.test\\.js',
      '/tests/lib/utils/infra-env-defaults.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\infra-env-defaults.test.js',
      'lib/utils/infra-env-defaults.test.js',
      'infra-env-defaults\\.test\\.js',
      '/tests/lib/infrastructure/compose-traefik-template.test.js',
      '\\\\tests\\\\lib\\\\infrastructure\\\\compose-traefik-template.test.js',
      'lib/infrastructure/compose-traefik-template.test.js',
      'compose-traefik-template\\.test\\.js',
      '/tests/lib/utils/paths-app-listing.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\paths-app-listing.test.js',
      'lib/utils/paths-app-listing.test.js',
      'paths-app-listing\\.test\\.js',
      '/tests/lib/utils/paths-system-builder-resolution.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\paths-system-builder-resolution.test.js',
      'lib/utils/paths-system-builder-resolution.test.js',
      'paths-system-builder-resolution\\.test\\.js',
      '/tests/lib/utils/manifest-location.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\manifest-location.test.js',
      'lib/utils/manifest-location.test.js',
      'manifest-location\\.test\\.js',
      '/tests/lib/utils/installation-log.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\installation-log.test.js',
      'lib/utils/installation-log.test.js',
      'installation-log\\.test\\.js',
      '/tests/lib/utils/manifest-source-emit.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\manifest-source-emit.test.js',
      'lib/utils/manifest-source-emit.test.js',
      'manifest-source-emit\\.test\\.js',
      '/tests/lib/utils/secrets-ancestor-paths.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\secrets-ancestor-paths.test.js',
      'lib/utils/secrets-ancestor-paths.test.js',
      'secrets-ancestor-paths\\.test\\.js',
      '/tests/lib/generator/generator-external-rbac.test.js',
      '\\\\tests\\\\lib\\\\generator\\\\generator-external-rbac.test.js',
      'lib/generator/generator-external-rbac.test.js',
      'generator-external-rbac\\.test\\.js',
      '/tests/lib/infrastructure/helpers-ensure-admin-secrets.test.js',
      '\\\\tests\\\\lib\\\\infrastructure\\\\helpers-ensure-admin-secrets.test.js',
      'lib/infrastructure/helpers-ensure-admin-secrets.test.js',
      'helpers-ensure-admin-secrets\\.test\\.js',
      '/tests/lib/utils/secrets-generator.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\secrets-generator.test.js',
      'lib/utils/secrets-generator.test.js',
      'secrets-generator\\.test\\.js',
      '/tests/lib/app/app-uncovered-lines.test.js',
      '\\\\tests\\\\lib\\\\app\\\\app-uncovered-lines.test.js',
      'lib/app/app-uncovered-lines.test.js',
      'app-uncovered-lines\\.test\\.js',
      '/tests/lib/utils/ensure-dev-certs-for-remote-docker.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\ensure-dev-certs-for-remote-docker.test.js',
      'lib/utils/ensure-dev-certs-for-remote-docker.test.js',
      'ensure-dev-certs-for-remote-docker\\.test\\.js',
      '/tests/lib/generator/generator-error-paths.test.js',
      '\\\\tests\\\\lib\\\\generator\\\\generator-error-paths.test.js',
      'lib/generator/generator-error-paths.test.js',
      'generator-error-paths\\.test\\.js',
      '/tests/lib/generator/generator-validation.test.js',
      '\\\\tests\\\\lib\\\\generator\\\\generator-validation.test.js',
      'lib/generator/generator-validation.test.js',
      'generator-validation\\.test\\.js',
      '/tests/lib/core/secrets-databaselog.test.js',
      '\\\\tests\\\\lib\\\\core\\\\secrets-databaselog.test.js',
      'lib/core/secrets-databaselog.test.js',
      'secrets-databaselog\\.test\\.js',
      '/tests/lib/validation/schema-241-alignment.test.js',
      '\\\\tests\\\\lib\\\\validation\\\\schema-241-alignment.test.js',
      'lib/validation/schema-241-alignment.test.js',
      'schema-241-alignment\\.test\\.js',
      '/tests/lib/utils/schema-resolver-order.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\schema-resolver-order.test.js',
      'lib/utils/schema-resolver-order.test.js',
      'schema-resolver-order\\.test\\.js',
      '/tests/lib/app/app.test.js',
      '\\\\tests\\\\lib\\\\app\\\\app.test.js',
      'lib/app/app.test.js',
      '/tests/lib/templates/application-frontdoor-paths.contract.test.js',
      '\\\\tests\\\\lib\\\\templates\\\\application-frontdoor-paths.contract.test.js',
      'lib/templates/application-frontdoor-paths.contract.test.js',
      'application-frontdoor-paths\\.contract\\.test\\.js',
      '/tests/lib/core/admin-secrets.test.js',
      '\\\\tests\\\\lib\\\\core\\\\admin-secrets.test.js',
      'lib/core/admin-secrets.test.js',
      '/tests/lib/datasource/validate-datasource-parsed.test.js',
      '\\\\tests\\\\lib\\\\datasource\\\\validate-datasource-parsed.test.js',
      'lib/datasource/validate-datasource-parsed.test.js',
      'validate-datasource-parsed\\.test\\.js',
      '/tests/lib/datasource/run-capability-copy.test.js',
      '\\\\tests\\\\lib\\\\datasource\\\\run-capability-copy.test.js',
      'lib/datasource/run-capability-copy.test.js',
      'run-capability-copy\\.test\\.js',
      '/tests/lib/datasource/run-capability-diff.test.js',
      '\\\\tests\\\\lib\\\\datasource\\\\run-capability-diff.test.js',
      'lib/datasource/run-capability-diff.test.js',
      'run-capability-diff\\.test\\.js',
      '/tests/lib/datasource/run-capability-edit.test.js',
      '\\\\tests\\\\lib\\\\datasource\\\\run-capability-edit.test.js',
      'lib/datasource/run-capability-edit.test.js',
      'run-capability-edit\\.test\\.js',
      '/tests/lib/datasource/run-capability-remove.test.js',
      '\\\\tests\\\\lib\\\\datasource\\\\run-capability-remove.test.js',
      'lib/datasource/run-capability-remove.test.js',
      'run-capability-remove\\.test\\.js',
      '/tests/lib/datasource/log-cleaner.test.js',
      '\\\\tests\\\\lib\\\\datasource\\\\log-cleaner.test.js',
      'lib/datasource/log-cleaner.test.js',
      'log-cleaner\\.test\\.js',
      '/tests/lib/datasource/datasource-exporter-service.test.js',
      '\\\\tests\\\\lib\\\\datasource\\\\datasource-exporter-service.test.js',
      'lib/datasource/datasource-exporter-service.test.js',
      'datasource-exporter-service\\.test\\.js',
      '/tests/lib/protection/paths.test.js',
      '\\\\tests\\\\lib\\\\protection\\\\paths.test.js',
      'lib/protection/paths.test.js',
      'protection/paths\\.test\\.js',
      '/tests/lib/protection/protection-resolve.test.js',
      '\\\\tests\\\\lib\\\\protection\\\\protection-resolve.test.js',
      'lib/protection/protection-resolve.test.js',
      'protection-resolve\\.test\\.js',
      '/tests/lib/protection/run-protection-create-helpers.test.js',
      '\\\\tests\\\\lib\\\\protection\\\\run-protection-create-helpers.test.js',
      'lib/protection/run-protection-create-helpers.test.js',
      'run-protection-create-helpers\\.test\\.js',
      '/tests/lib/governance/governance-pack-loader.test.js',
      '\\\\tests\\\\lib\\\\governance\\\\governance-pack-loader.test.js',
      'lib/governance/governance-pack-loader.test.js',
      'governance-pack-loader\\.test\\.js',
      '/tests/lib/protection/validate-batch.test.js',
      '\\\\tests\\\\lib\\\\protection\\\\validate-batch.test.js',
      'lib/protection/validate-batch.test.js',
      'validate-batch\\.test\\.js',
      '/tests/helpers/aifabrix-runtime-sandbox.test.js',
      '\\\\tests\\\\helpers\\\\aifabrix-runtime-sandbox.test.js',
      'helpers/aifabrix-runtime-sandbox\\.test\\.js',
      '/tests/helpers/aifabrix-runtime-backup.test.js',
      '\\\\tests\\\\helpers\\\\aifabrix-runtime-backup.test.js',
      'helpers/aifabrix-runtime-backup\\.test\\.js',
      '/tests/lib/utils/paths-jest-sandbox-integration.test.js',
      '\\\\tests\\\\lib\\\\utils\\\\paths-jest-sandbox-integration.test.js',
      'paths-jest-sandbox-integration\\.test\\.js',
      '/tests/setup-ci-live-fabrix-guard.test.js',
      '\\\\tests\\\\setup-ci-live-fabrix-guard.test.js',
      'setup-ci-live-fabrix-guard\\.test\\.js'
    ];
    if (process.env.INCLUDE_LOCAL_TESTS !== 'true') {
      patterns.push('/tests/local/');
      patterns.push('\\\\tests\\\\local\\\\');
    }
    return patterns;
  })(),
  setupFiles: ['<rootDir>/tests/capture-real-fs.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: isCI ? 15000 : 8000,
  detectOpenHandles: true,
  maxWorkers: 1
};

const isolatedProjects = [
  makeIsolatedProject('cli-utils', ['**/tests/lib/utils/cli-utils.test.js']),
  makeIsolatedProject('external-system-display', ['**/tests/lib/utils/external-system-display.test.js']),
  makeIsolatedProject('dev-hosts-helper', ['**/tests/lib/utils/dev-hosts-helper.test.js']),
  makeIsolatedProject('parameters-validate', ['**/tests/lib/commands/parameters-validate.test.js']),
  makeIsolatedProject('repair-openapi-sync', ['**/tests/lib/commands/repair-openapi-sync.test.js']),
  makeIsolatedProject('paths-app-listing', ['**/tests/lib/utils/paths-app-listing.test.js']),
  makeIsolatedProject('paths-system-builder-resolution', [
    '**/tests/lib/utils/paths-system-builder-resolution.test.js'
  ]),
  makeIsolatedProject('manifest-location', ['**/tests/lib/utils/manifest-location.test.js']),
  makeIsolatedProject('installation-log', ['**/tests/lib/utils/installation-log.test.js']),
  makeIsolatedProject('secrets-ancestor-paths', ['**/tests/lib/utils/secrets-ancestor-paths.test.js']),
  makeIsolatedProject('datasource-validation-watch', [
    '**/tests/lib/utils/datasource-validation-watch.test.js'
  ]),
  makeIsolatedProject('log-viewer', [
    '**/tests/lib/datasource/log-viewer.test.js',
    '**/tests/lib/datasource/log-viewer-structural.test.js',
    '**/tests/lib/datasource/log-viewer-run.test.js'
  ]),
  makeIsolatedProject('manifest-source-emit', ['**/tests/lib/utils/manifest-source-emit.test.js']),
  makeIsolatedProject('register-aifabrix-shell-env', [
    '**/tests/lib/utils/register-aifabrix-shell-env.test.js'
  ]),
  makeIsolatedProject('datasource-test-run-schema-sync', [
    '**/tests/lib/utils/datasource-test-run-schema-sync.test.js'
  ]),
  makeIsolatedProject('infra-platform-contract', [
    '**/tests/lib/parameters/infra-platform-contract.test.js'
  ]),
  makeIsolatedProject('application-frontdoor-paths-contract', [
    '**/tests/lib/templates/application-frontdoor-paths.contract.test.js'
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
  ]),
  makeIsolatedProject('secrets-ensure', ['**/tests/lib/core/secrets-ensure.test.js']),
  makeIsolatedProject('url-declarative-vdir-inactive-env', [
    '**/tests/lib/utils/url-declarative-vdir-inactive-env.test.js'
  ]),
  makeIsolatedProject('url-declarative-user-cfg-per-app-proxy', [
    '**/tests/lib/utils/url-declarative-user-cfg-per-app-proxy.test.js'
  ]),
  makeIsolatedProject('declarative-url-paths-spy-suites', [
    '**/tests/lib/utils/url-declarative-expand-traefik-off-no-usercfg.test.js',
    '**/tests/lib/core/secrets-env-declarative-show-urls.test.js',
    '**/tests/lib/utils/url-declarative-registry-internal-docker-origin.test.js'
  ]),
  makeIsolatedProject('platform-urls-registry-validation', [
    '**/tests/lib/commands/platform-urls-registry.validation.test.js'
  ]),
  makeIsolatedProject('env-copy-resolve-output', ['**/tests/lib/utils/env-copy-resolve-output.test.js']),
  makeIsolatedProject('write-env-output-reload', ['**/tests/lib/utils/write-env-output-reload.test.js']),
  makeIsolatedProject('app-service-env-from-builder', [
    '**/tests/lib/utils/app-service-env-from-builder.test.js'
  ]),
  makeIsolatedProject('infra-kv-discovery', ['**/tests/lib/parameters/infra-kv-discovery.test.js']),
  makeIsolatedProject('infra-env-defaults', ['**/tests/lib/utils/infra-env-defaults.test.js']),
  makeIsolatedProject('compose-traefik-template', [
    '**/tests/lib/infrastructure/compose-traefik-template.test.js'
  ]),
  makeIsolatedProject('generator-external-rbac', [
    '**/tests/lib/generator/generator-external-rbac.test.js'
  ]),
  makeIsolatedProject('helpers-ensure-admin-secrets', [
    '**/tests/lib/infrastructure/helpers-ensure-admin-secrets.test.js'
  ]),
  makeIsolatedProject('secrets-generator', ['**/tests/lib/utils/secrets-generator.test.js']),
  makeIsolatedProject('app-uncovered-lines', ['**/tests/lib/app/app-uncovered-lines.test.js']),
  makeIsolatedProject('ensure-dev-certs-for-remote-docker', [
    '**/tests/lib/utils/ensure-dev-certs-for-remote-docker.test.js'
  ]),
  makeIsolatedProject('generator-error-paths', ['**/tests/lib/generator/generator-error-paths.test.js']),
  makeIsolatedProject('generator-validation', ['**/tests/lib/generator/generator-validation.test.js']),
  makeIsolatedProject('secrets-databaselog', ['**/tests/lib/core/secrets-databaselog.test.js']),
  makeIsolatedProject('schema-241-alignment', ['**/tests/lib/validation/schema-241-alignment.test.js']),
  makeIsolatedProject('schema-resolver-order', ['**/tests/lib/utils/schema-resolver-order.test.js']),
  makeIsolatedProject('app-module', ['**/tests/lib/app/app.test.js']),
  makeIsolatedProject('admin-secrets', ['**/tests/lib/core/admin-secrets.test.js']),
  makeIsolatedProject('validate-datasource-parsed', [
    '**/tests/lib/datasource/validate-datasource-parsed.test.js'
  ]),
  makeIsolatedProject('capability-run-real-fs', [
    '**/tests/lib/datasource/run-capability-copy.test.js',
    '**/tests/lib/datasource/run-capability-diff.test.js',
    '**/tests/lib/datasource/run-capability-edit.test.js',
    '**/tests/lib/datasource/run-capability-remove.test.js'
  ]),
  makeIsolatedProject('log-cleaner', ['**/tests/lib/datasource/log-cleaner.test.js']),
  makeIsolatedProject('datasource-exporter-service', [
    '**/tests/lib/datasource/datasource-exporter-service.test.js'
  ]),
  makeIsolatedProject('protection-paths', ['**/tests/lib/protection/paths.test.js']),
  makeIsolatedProject('protection-resolve', ['**/tests/lib/protection/protection-resolve.test.js']),
  makeIsolatedProject('protection-create-helpers', [
    '**/tests/lib/protection/run-protection-create-helpers.test.js'
  ]),
  makeIsolatedProject('governance-pack-loader', [
    '**/tests/lib/governance/governance-pack-loader.test.js'
  ]),
  makeIsolatedProject('protection-validate-batch', [
    '**/tests/lib/protection/validate-batch.test.js'
  ]),
  makeIsolatedProject('aifabrix-runtime-sandbox', [
    '**/tests/helpers/aifabrix-runtime-sandbox.test.js'
  ]),
  makeIsolatedProject('aifabrix-runtime-backup', [
    '**/tests/helpers/aifabrix-runtime-backup.test.js'
  ]),
  makeIsolatedProject('paths-jest-sandbox-integration', [
    '**/tests/lib/utils/paths-jest-sandbox-integration.test.js'
  ]),
  createSetupCiLiveFabrixGuardProject({ isCI, sharedTransform })
];

const allProjects = [defaultProject, ...isolatedProjects];

module.exports = {
  isCI,
  sharedTransform,
  makeIsolatedProject,
  defaultProject,
  isolatedProjects,
  allProjects,
  globalLiveFabrixHooks
};
