/**
 * Shared "Next actions" + blocking error formatter for the Builder CLI ↔
 * dataplane version gate (plan 142.0). Used by `auth status` display and by
 * the gate thrown from dataplane API entrypoints so users see the same bullets
 * wherever the incompatibility surfaces.
 *
 * @fileoverview Shared CLI version-gate UX helpers (next actions + blocking)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const {
  formatBlockingError,
  formatNextActions
} = require('./cli-test-layout-chalk');

/**
 * Build the canonical Next actions bullets for a CLI ↔ dataplane mismatch.
 *
 * @param {string} required - Minimum Builder CLI semver advertised by dataplane
 * @param {string} installed - Current Builder CLI semver (from package.json)
 * @returns {string[]} Bullet lines (no prefix)
 */
function buildCliVersionUpgradeNextActions(required, installed) {
  const req = (required || '').trim() || 'the dataplane minimum';
  const inst = (installed || '').trim() || 'this CLI';
  return [
    `Upgrade Builder CLI: npm install -g @aifabrix/builder@${req} (or @latest)`,
    'Confirm after upgrade: aifabrix auth status',
    'CI / scripts: aifabrix auth status --validate (exit 3 until upgraded)',
    `Local work (validate, run, up-infra) still works on ${inst}`
  ];
}

/**
 * Build the blocking line shown before the Next actions block when the CLI is
 * older than the dataplane minimum.
 *
 * @param {string} required - Required minimum semver
 * @param {string} installed - Currently installed semver
 * @returns {string}
 */
function buildCliVersionBlockingLine(required, installed) {
  const req = (required || '').trim() || '(unknown)';
  const inst = (installed || '').trim() || '(unknown)';
  return formatBlockingError(
    `Builder CLI ${inst} is below the dataplane minimum (${req}). Upgrade before running dataplane commands.`
  );
}

/**
 * Format the full version-gate error block (blocking line + Next actions).
 * Suitable for `handleCommandError` output and the `auth status` incompatible
 * branch.
 *
 * @param {string} required - Required minimum semver
 * @param {string} installed - Currently installed semver
 * @returns {string} Multi-line, chalk-colored block
 */
function formatCliVersionGateError(required, installed) {
  return [
    buildCliVersionBlockingLine(required, installed),
    '',
    formatNextActions(buildCliVersionUpgradeNextActions(required, installed))
  ].join('\n');
}

module.exports = {
  buildCliVersionUpgradeNextActions,
  buildCliVersionBlockingLine,
  formatCliVersionGateError
};
