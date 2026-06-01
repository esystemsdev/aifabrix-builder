/**
 * Jest isolated project list (separate process per suite when run via jest.config.isolated.js).
 * @fileoverview
 */

'use strict';

const { createSetupCiLiveFabrixGuardProject } = require('./jest.global-live-fabrix-hooks');

/** @type {[string, string[]][]} displayName and testMatch globs */
const ISOLATED_SUITE_ENTRIES = [
  ['cli-utils', ['**/tests/lib/utils/cli-utils.test.js']],
  ['external-system-display', ['**/tests/lib/utils/external-system-display.test.js']],
  ['dev-hosts-helper', ['**/tests/lib/utils/dev-hosts-helper.test.js']],
  ['parameters-validate', ['**/tests/lib/commands/parameters-validate.test.js']],
  ['test-e2e-external', ['**/tests/lib/commands/test-e2e-external.test.js']],
  ['repair-openapi-sync', ['**/tests/lib/commands/repair-openapi-sync.test.js']],
  ['paths-app-listing', ['**/tests/lib/utils/paths-app-listing.test.js']],
  ['paths-system-builder-resolution', ['**/tests/lib/utils/paths-system-builder-resolution.test.js']],
  ['manifest-location', ['**/tests/lib/utils/manifest-location.test.js']],
  ['installation-log', ['**/tests/lib/utils/installation-log.test.js']],
  ['secrets-ancestor-paths', ['**/tests/lib/utils/secrets-ancestor-paths.test.js']],
  ['datasource-validation-watch', ['**/tests/lib/utils/datasource-validation-watch.test.js']],
  [
    'log-viewer',
    [
      '**/tests/lib/datasource/log-viewer.test.js',
      '**/tests/lib/datasource/log-viewer-structural.test.js',
      '**/tests/lib/datasource/log-viewer-run.test.js'
    ]
  ],
  ['audit-evidence-extract', ['**/tests/lib/datasource/audit-evidence-extract.test.js']],
  ['manifest-source-emit', ['**/tests/lib/utils/manifest-source-emit.test.js']],
  ['register-aifabrix-shell-env', ['**/tests/lib/utils/register-aifabrix-shell-env.test.js']],
  ['datasource-test-run-schema-sync', ['**/tests/lib/utils/datasource-test-run-schema-sync.test.js']],
  ['infra-platform-contract', ['**/tests/lib/parameters/infra-platform-contract.test.js']],
  [
    'application-frontdoor-paths-contract',
    ['**/tests/lib/templates/application-frontdoor-paths.contract.test.js']
  ],
  ['database-secret-values', ['**/tests/lib/parameters/database-secret-values.test.js']],
  ['infra-parameter-validate', ['**/tests/lib/parameters/infra-parameter-validate.test.js']],
  ['infra-parameter-catalog', ['**/tests/lib/parameters/infra-parameter-catalog.test.js']],
  ['urls-local-registry', ['**/tests/lib/utils/urls-local-registry.test.js']],
  ['aifabrix-runtime-config-dir', ['**/tests/lib/utils/aifabrix-runtime-config-dir.test.js']],
  ['platform-env-template-kv-catalog', ['**/tests/lib/parameters/platform-env-template-kv-catalog.test.js']],
  ['resolve-infra-state-paths', ['**/tests/lib/infrastructure/resolve-infra-state-paths.test.js']],
  ['dev-ssh-config-helper', ['**/tests/lib/utils/dev-ssh-config-helper.test.js']],
  ['ssh-key-helper', ['**/tests/lib/utils/ssh-key-helper.test.js']],
  ['secrets-ensure-catalog-fallback', ['**/tests/lib/core/secrets-ensure-catalog-fallback.test.js']],
  ['secrets-ensure', ['**/tests/lib/core/secrets-ensure.test.js']],
  ['url-declarative-vdir-inactive-env', ['**/tests/lib/utils/url-declarative-vdir-inactive-env.test.js']],
  [
    'url-declarative-user-cfg-per-app-proxy',
    ['**/tests/lib/utils/url-declarative-user-cfg-per-app-proxy.test.js']
  ],
  [
    'declarative-url-paths-spy-suites',
    [
      '**/tests/lib/utils/url-declarative-expand-traefik-off-no-usercfg.test.js',
      '**/tests/lib/core/secrets-env-declarative-show-urls.test.js',
      '**/tests/lib/utils/url-declarative-registry-internal-docker-origin.test.js'
    ]
  ],
  ['platform-urls-registry-validation', ['**/tests/lib/commands/platform-urls-registry.validation.test.js']],
  ['env-copy-resolve-output', ['**/tests/lib/utils/env-copy-resolve-output.test.js']],
  ['write-env-output-reload', ['**/tests/lib/utils/write-env-output-reload.test.js']],
  ['app-service-env-from-builder', ['**/tests/lib/utils/app-service-env-from-builder.test.js']],
  ['infra-kv-discovery', ['**/tests/lib/parameters/infra-kv-discovery.test.js']],
  ['infra-env-defaults', ['**/tests/lib/utils/infra-env-defaults.test.js']],
  ['compose-traefik-template', ['**/tests/lib/infrastructure/compose-traefik-template.test.js']],
  ['generator-external-rbac', ['**/tests/lib/generator/generator-external-rbac.test.js']],
  ['helpers-ensure-admin-secrets', ['**/tests/lib/infrastructure/helpers-ensure-admin-secrets.test.js']],
  ['secrets-generator', ['**/tests/lib/utils/secrets-generator.test.js']],
  ['app-uncovered-lines', ['**/tests/lib/app/app-uncovered-lines.test.js']],
  ['ensure-dev-certs-for-remote-docker', ['**/tests/lib/utils/ensure-dev-certs-for-remote-docker.test.js']],
  ['generator-error-paths', ['**/tests/lib/generator/generator-error-paths.test.js']],
  ['generator-validation', ['**/tests/lib/generator/generator-validation.test.js']],
  ['secrets-databaselog', ['**/tests/lib/core/secrets-databaselog.test.js']],
  ['schema-241-alignment', ['**/tests/lib/validation/schema-241-alignment.test.js']],
  ['schema-resolver-order', ['**/tests/lib/utils/schema-resolver-order.test.js']],
  ['app-module', ['**/tests/lib/app/app.test.js']],
  ['admin-secrets', ['**/tests/lib/core/admin-secrets.test.js']],
  ['validate-datasource-parsed', ['**/tests/lib/datasource/validate-datasource-parsed.test.js']],
  [
    'capability-run-real-fs',
    [
      '**/tests/lib/datasource/run-capability-copy.test.js',
      '**/tests/lib/datasource/run-capability-diff.test.js',
      '**/tests/lib/datasource/run-capability-edit.test.js',
      '**/tests/lib/datasource/run-capability-remove.test.js'
    ]
  ],
  ['log-cleaner', ['**/tests/lib/datasource/log-cleaner.test.js']],
  ['datasource-exporter-service', ['**/tests/lib/datasource/datasource-exporter-service.test.js']],
  ['protection-paths', ['**/tests/lib/protection/paths.test.js']],
  ['protection-resolve', ['**/tests/lib/protection/protection-resolve.test.js']],
  ['protection-create-helpers', ['**/tests/lib/protection/run-protection-create-helpers.test.js']],
  ['governance-pack-loader', ['**/tests/lib/governance/governance-pack-loader.test.js']],
  ['protection-validate-batch', ['**/tests/lib/protection/validate-batch.test.js']],
  ['aifabrix-runtime-sandbox', ['**/tests/helpers/aifabrix-runtime-sandbox.test.js']],
  ['aifabrix-runtime-backup', ['**/tests/helpers/aifabrix-runtime-backup.test.js']],
  ['paths-jest-sandbox-integration', ['**/tests/lib/utils/paths-jest-sandbox-integration.test.js']]
];

/**
 * @param {Function} makeIsolatedProject - Factory from jest.projects.js
 * @param {boolean} isCI - True when CI or CI_SIMULATION is set
 * @param {object} sharedTransform - Babel-jest transform shared with default project
 * @returns {object[]} Jest multi-project entries
 */
function buildIsolatedProjects(makeIsolatedProject, isCI, sharedTransform) {
  const projects = ISOLATED_SUITE_ENTRIES.map(([name, testMatch]) =>
    makeIsolatedProject(name, testMatch)
  );
  projects.push(createSetupCiLiveFabrixGuardProject({ isCI, sharedTransform }));
  return projects;
}

module.exports = { buildIsolatedProjects, ISOLATED_SUITE_ENTRIES };
