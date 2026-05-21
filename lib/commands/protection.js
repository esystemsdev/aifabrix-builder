/**
 * @fileoverview Protection manifest CLI commands.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const {
  registerProtectionCreate,
  registerProtectionValidate,
  registerProtectionUpload,
  registerProtectionList,
  registerProtectionShow,
  registerProtectionDelete
} = require('./protection-cli-leaves');

const PROTECTION_HELP_AFTER = `

Examples:
  $ aifabrix protection create hubspot-companies --type country-sales
  $ aifabrix protection validate hubspot-companies --simulate
  $ aifabrix protection upload hubspot-companies --dry-run
  $ aifabrix protection list
  $ aifabrix protection show hubspot-companies
  $ aifabrix protection delete hubspot-companies --yes

Per-command help:  aifabrix protection <command> --help
`;

/**
 * @param {import('commander').Command} program
 */
function setupProtectionCommands(program) {
  const protection = program
    .command('protection')
    .description('Manage protection manifests in integration/.protection/ (repo root)')
    .addHelpText('after', PROTECTION_HELP_AFTER);

  registerProtectionCreate(protection);
  registerProtectionValidate(protection);
  registerProtectionUpload(protection);
  registerProtectionList(protection);
  registerProtectionShow(protection);
  registerProtectionDelete(protection);
}

module.exports = {
  setupProtectionCommands
};
