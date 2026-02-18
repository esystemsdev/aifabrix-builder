/**
 * CLI secret and security command setup (secret set, secure).
 *
 * @fileoverview Secrets command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { handleCommandError } = require('../utils/cli-utils');
const { handleSecretsSet } = require('../commands/secrets-set');
const { handleSecretsList } = require('../commands/secrets-list');
const { handleSecretsRemove } = require('../commands/secrets-remove');
const { handleSecure } = require('../commands/secure');

/**
 * Sets up secrets and security commands
 * @param {Command} program - Commander program instance
 */
function setupSecretsCommands(program) {
  const secretCmd = program
    .command('secret')
    .description('Manage secrets in secrets files');

  secretCmd
    .command('list')
    .description('List secret keys (user or shared; use --shared for shared)')
    .option('--shared', 'List shared secrets (from config aifabrix-secrets or remote API)')
    .action(async(options) => {
      try {
        await handleSecretsList(options);
      } catch (error) {
        handleCommandError(error, 'secret list');
        process.exit(1);
      }
    });

  secretCmd
    .command('set <key> <value>')
    .description('Set a secret value in secrets file')
    .option('--shared', 'Save to general secrets file (from config.yaml aifabrix-secrets) instead of user secrets')
    .action(async(key, value, options) => {
      try {
        await handleSecretsSet(key, value, options);
      } catch (error) {
        handleCommandError(error, 'secret set');
        process.exit(1);
      }
    });

  secretCmd
    .command('remove <key>')
    .description('Remove a secret by key')
    .option('--shared', 'Remove from shared secrets (file or remote API)')
    .action(async(key, options) => {
      try {
        await handleSecretsRemove(key, options);
      } catch (error) {
        handleCommandError(error, 'secret remove');
        process.exit(1);
      }
    });

  program.command('secure')
    .description('Encrypt secrets in secrets.local.yaml files for ISO 27001 compliance')
    .option('--secrets-encryption <key>', 'Encryption key (32 bytes, hex or base64)')
    .action(async(options) => {
      try {
        await handleSecure(options);
      } catch (error) {
        handleCommandError(error, 'secure');
        process.exit(1);
      }
    });
}

module.exports = { setupSecretsCommands };
