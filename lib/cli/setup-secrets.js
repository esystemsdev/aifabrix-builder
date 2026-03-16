/**
 * CLI secret and security command setup (secret set, secure).
 *
 * @fileoverview Secrets command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { handleCommandError } = require('../utils/cli-utils');
const { handleSecretsSet } = require('../commands/secrets-set');
const { handleSecretsList } = require('../commands/secrets-list');
const { handleSecretsRemove } = require('../commands/secrets-remove');
const { handleSecretsValidate } = require('../commands/secrets-validate');
const { handleSecure } = require('../commands/secure');
const config = require('../core/config');
const logger = require('../utils/logger');

function setupSecretValidateCommand(secretCmd) {
  secretCmd
    .command('validate [path]')
    .description('Validate secrets file (YAML structure and optional naming convention)')
    .option('--naming', 'Check key names against *KeyVault convention')
    .action(async(pathArg, options) => {
      try {
        await config.ensureSecretsEncryptionKey();
        const result = await handleSecretsValidate(pathArg, options);
        if (!result.valid) process.exit(1);
      } catch (error) {
        handleCommandError(error, 'secret validate');
        process.exit(1);
      }
    });
}

/**
 * Registers the secure command on the program.
 * @param {Command} program - Commander program instance
 */
function setupSecureCommand(program) {
  program.command('secure')
    .description('Encrypt secrets in secrets.local.yaml files for ISO 27001 compliance')
    .option('--secrets-encryption <key>', 'Encryption key (32 bytes, hex or base64)')
    .action(async(options) => {
      try {
        await config.ensureSecretsEncryptionKey();
        await handleSecure(options);
      } catch (error) {
        handleCommandError(error, 'secure');
        process.exit(1);
      }
    });
}

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
        await config.ensureSecretsEncryptionKey();
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
        await config.ensureSecretsEncryptionKey();
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
        await config.ensureSecretsEncryptionKey();
        await handleSecretsRemove(key, options);
      } catch (error) {
        handleCommandError(error, 'secret remove');
        process.exit(1);
      }
    });

  setupSecretSetSecretsFileCommand(secretCmd);
  setupSecretValidateCommand(secretCmd);
  setupSecureCommand(program);
}

/**
 * Register secret set-secrets-file command.
 * @param {Command} secretCmd - secret command group
 */
function setupSecretSetSecretsFileCommand(secretCmd) {
  secretCmd
    .command('set-secrets-file <path>')
    .description('Set aifabrix-secrets path in config (local file or https URL; pass empty to clear; path/URL is not checked for existence)')
    .action(async(secretsPath) => {
      try {
        const trimmed = (secretsPath || '').trim();
        if (trimmed !== '' && trimmed.startsWith('http://')) {
          throw new Error('Only https URLs are allowed for remote secrets');
        }
        await config.setSecretsPath(trimmed);
        logger.log(trimmed === '' ? chalk.green('✓ Secrets file path cleared') : chalk.green(`✓ Secrets file path set to ${trimmed}`));
      } catch (error) {
        handleCommandError(error, 'secret set-secrets-file');
        process.exit(1);
      }
    });
}

module.exports = { setupSecretsCommands };
