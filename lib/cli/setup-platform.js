/**
 * CLI registration for `aifabrix setup` and `aifabrix teardown`.
 *
 * `setup` is the one-shot platform installer. When no infrastructure is
 * detected it runs a small wizard (admin email/password, AI tool keys) and
 * then `up-infra` + `up-platform`. When infra is already up, it offers a
 * mode menu (re-install, wipe data, clean install files, update images).
 *
 * `teardown` is the symmetrical inverse of `setup`: `down-infra -v` plus a
 * full clean of the AI Fabrix system directory (everything except
 * `config.yaml`).
 *
 * @fileoverview CLI command setup for setup/teardown
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const { handleCommandError } = require('../utils/cli-utils');
const { handleSetup } = require('../commands/setup');
const { handleTeardown } = require('../commands/teardown');

const SETUP_HELP_AFTER = `
What this command does:
  - With no infra running: prompts for admin email/password (used for Postgres, pgAdmin, Keycloak), prompts for an AI tool (OpenAI or Azure OpenAI) only when keys are not already set, then runs up-infra and up-platform.
  - With infra running: shows a mode menu:
      1) Re-install — stop infra and remove all volumes, then up-infra + up-platform --force.
      2) Wipe data — drop every database and DB user, then up-infra + up-platform --force.
      3) Clean installation files — remove user-local secrets, then up-infra + up-platform --force.
      4) Update images — pull the latest infra and platform images, then up-infra + up-platform.

AI tool keys are read from the user-local file (~/.aifabrix/secrets.local.yaml) merged with the shared aifabrix-secrets file. If either source already provides keys, the AI tool prompt is skipped.

Use 'aifabrix teardown' to fully remove the local installation.
`;

const TEARDOWN_HELP_AFTER = `
What this command does:
  - Runs down-infra -v (stops all infra + apps, removes every Docker volume).
  - Removes every file and subfolder inside ~/.aifabrix/ EXCEPT config.yaml.
    This includes secrets.local.yaml, admin-secrets.env, auth/token files,
    and infra-dev*/ directories.

This is the symmetrical inverse of 'aifabrix setup'. Use --yes / -y to skip the confirmation prompt in CI.
`;

/**
 * Register the setup command on the Commander program.
 * @param {import('commander').Command} program
 */
function registerSetup(program) {
  program
    .command('setup')
    .description('Install or refresh the full AI Fabrix platform (infra + miso + dataplane)')
    .option('-d, --developer <id>', 'Pin developer ID before fresh install (fresh path only; ignored when infra is already up)')
    .option('-y, --yes', 'Skip destructive confirmation prompts (re-install, wipe data, teardown)')
    .addHelpText('after', SETUP_HELP_AFTER)
    .action(async(options) => {
      try {
        await handleSetup(options || {});
      } catch (error) {
        handleCommandError(error, 'setup');
        process.exit(1);
      }
    });
}

/**
 * Register the teardown command on the Commander program.
 * @param {import('commander').Command} program
 */
function registerTeardown(program) {
  program
    .command('teardown')
    .description('Tear down local AI Fabrix infra and clean ~/.aifabrix/ except config.yaml')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .addHelpText('after', TEARDOWN_HELP_AFTER)
    .action(async(options) => {
      try {
        await handleTeardown(options || {});
      } catch (error) {
        handleCommandError(error, 'teardown');
        process.exit(1);
      }
    });
}

/**
 * Register all setup-platform commands on the Commander program.
 * @param {import('commander').Command} program
 */
function setupPlatformCommands(program) {
  registerSetup(program);
  registerTeardown(program);
}

module.exports = {
  setupPlatformCommands,
  registerSetup,
  registerTeardown
};
