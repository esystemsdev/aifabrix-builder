/**
 * CLI secrets and security command setup (secrets set, secure).
 *
 * @fileoverview Secrets command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { handleCommandError } = require('../utils/cli-utils');
const { handleSecretsSet } = require('../commands/secrets-set');
const { handleSecure } = require('../commands/secure');

/**
 * Sets up secrets and security commands
 * @param {Command} program - Commander program instance
 */
function setupSecretsCommands(program) {
  const secretsCmd = program
    .command('secrets')
    .description('Manage secrets in secrets files');

  secretsCmd
    .command('set <key> <value>')
    .description('Set a secret value in secrets file')
    .option('--shared', 'Save to general secrets file (from config.yaml aifabrix-secrets) instead of user secrets')
    .action(async(key, value, options) => {
      try {
        await handleSecretsSet(key, value, options);
      } catch (error) {
        handleCommandError(error, 'secrets set');
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
