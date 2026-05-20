/**
 * Identity and RBAC commands (Controller users, groups, sync, cache).
 *
 * @fileoverview `aifabrix identity` command group
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { setupIdentityUserCommands } = require('./identity-user-cli');
const { setupIdentityGroupCommands } = require('./identity-group-cli');
const {
  setupIdentityMembershipCommands,
  setupIdentityRoleCommands,
  setupIdentityCacheCommands
} = require('./identity-membership-role-cache');
const { setupIdentityApplyCommand, setupIdentitySyncCommand } = require('./identity-apply-sync');
const { IDENTITY_HELP_AFTER } = require('../cli/setup-app.help');

/**
 * @param {import('commander').Command} program
 */
function setupIdentityCommands(program) {
  const identityCmd = program
    .command('identity')
    .description('Manage controller users, groups, RBAC mappings, cache, and dataplane identity sync')
    .addHelpText('after', IDENTITY_HELP_AFTER);

  setupIdentityUserCommands(identityCmd.command('user').description('User commands'));
  setupIdentityGroupCommands(identityCmd.command('group').description('Group commands'));
  setupIdentityMembershipCommands(
    identityCmd.command('membership').description('User–group membership commands')
  );
  setupIdentityRoleCommands(identityCmd.command('role').description('Environment role commands'));
  setupIdentityCacheCommands(identityCmd.command('cache').description('Controller cache commands'));
  setupIdentityApplyCommand(identityCmd);
  setupIdentitySyncCommand(identityCmd);
}

module.exports = {
  setupIdentityCommands
};
