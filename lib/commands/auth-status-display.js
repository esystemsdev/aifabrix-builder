/**
 * Auth-status dataplane version block + blocking upgrade UX (plan 142.0).
 *
 * Kept in a separate module so `auth-status.js` stays under the 500-line
 * limit and so the same display helpers can be reused by future dataplane
 * gate surfaces (`upload`, `wizard`, `deploy`, …).
 *
 * @fileoverview TTY rendering for dataplane / Builder CLI compatibility
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const logger = require('../utils/logger');
const {
  successGlyph,
  failureGlyph
} = require('../utils/cli-test-layout-chalk');
const {
  formatCliVersionGateError
} = require('../utils/dataplane-cli-version-help');

/**
 * Format a single key/value version line indented under the dataplane block.
 * @private
 * @param {string} label
 * @param {string|undefined|null} value
 * @returns {string}
 */
function versionLine(label, value) {
  const display = value && String(value).trim() ? chalk.cyan(value) : chalk.gray('—');
  return `  ${label}: ${display}`;
}

/**
 * Render the dataplane version subsection on `aifabrix auth status`.
 *
 * Designed to be called immediately after the existing connection/status line,
 * so the output reads as a single grouped block per layout.md §HEADER BLOCK.
 *
 * @param {Object} params
 * @param {boolean} params.connected - Whether dataplane reachability probe passed
 * @param {string|undefined} params.dataplaneVersion - From `device.<controllerUrl>.dataplane-version`
 * @param {string|undefined} params.minBuilderCliVersion - From `device.<controllerUrl>.dataplane-min-cli-version`
 * @param {string} params.cliVersion - Installed Builder CLI version
 * @param {boolean} params.compatible - true when CLI ≥ minimum (or no minimum enforced)
 * @returns {void}
 */
function displayDataplaneVersionSection({
  connected,
  dataplaneVersion,
  minBuilderCliVersion,
  cliVersion,
  compatible
}) {
  if (!connected && !dataplaneVersion) {
    // Nothing to add — keep auth status quiet when the dataplane probe failed
    // and no cached version is known (the reachability line already told the user).
    return;
  }
  logger.log(versionLine('Dataplane version', dataplaneVersion));
  logger.log(versionLine('Min Builder CLI', minBuilderCliVersion));
  logger.log(versionLine('This CLI', cliVersion));
  if (!minBuilderCliVersion) {
    logger.log(`  Compatibility: ${chalk.gray('Not enforced')}`);
    return;
  }
  if (compatible) {
    logger.log(`  Compatibility: ${successGlyph()} ${chalk.green('OK')}`);
  } else {
    logger.log(`  Compatibility: ${failureGlyph()} ${chalk.red('Upgrade required')}`);
  }
}

/**
 * Render the blocking upgrade block (red ✖ + Next actions) under the
 * dataplane subsection when the CLI is incompatible.
 *
 * @param {Object} params
 * @param {string} params.required - Required minimum semver
 * @param {string} params.installed - Currently installed semver
 * @returns {void}
 */
function displayCliUpgradeRequired({ required, installed }) {
  logger.log('');
  logger.log(formatCliVersionGateError(required, installed));
}

module.exports = {
  displayDataplaneVersionSection,
  displayCliUpgradeRequired
};
