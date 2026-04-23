/**
 * CLI secret and security command setup (secret set, secure).
 *
 * @fileoverview Secrets command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');
const { handleCommandError } = require('../utils/cli-utils');
const { handleSecretsSet } = require('../commands/secrets-set');
const { handleSecretsList } = require('../commands/secrets-list');
const { handleSecretsRemove } = require('../commands/secrets-remove');
const { handleSecretsValidate } = require('../commands/secrets-validate');
const { handleSecure } = require('../commands/secure');
const config = require('../core/config');
const logger = require('../utils/logger');

const SECRET_GROUP_HELP_AFTER = `
Subcommands:
  list, set, remove, remove-all   User secrets.local.yaml (add --shared for shared/remote)
  set-secrets-file      Point config at a shared secrets file or https URL
  validate              YAML structure (+ optional --naming)

Also: aifabrix secure   Encrypt secrets.local.yaml (ISO 27001)

Default "secret set" (no --shared): writes only to your user secrets.local.yaml next to
  config.yaml (typically ~/.aifabrix/secrets.local.yaml). Use --shared to write the
  shared store from config aifabrix-secrets (another file or https), not that user file.

Examples:
  $ aifabrix secret list
  $ aifabrix secret set myapp/clientSecret "your-value"
  $ aifabrix secret remove old-key
  $ aifabrix secret remove-all
  $ aifabrix secret validate

Shared over https: key BASH_NPM_TOKEN --shared → NPM_TOKEN available in terminal (exported).
`;

const SECRET_LIST_HELP_AFTER = `
Examples:
  $ aifabrix secret list
  $ aifabrix secret list --shared
`;

const SECRET_SET_HELP_AFTER = `
Where the value is stored:
  No --shared   User file secrets.local.yaml in your aifabrix config directory (same
                folder as config.yaml; often ~/.aifabrix/). Used for app/integration
                secrets and kv:// resolution on your machine.
  --shared      The store set in config.yaml as aifabrix-secrets: a YAML file path or
                an https secrets API (never the user-only file above unless you point
                aifabrix-secrets at that path deliberately).

Examples:
  $ aifabrix secret set myapp/clientSecret "your-secret"
  $ aifabrix secret set hubspot/apiKey "$HUBSPOT_KEY"
  $ aifabrix secret set team/shared-token "value" --shared
  $ aifabrix secret set BASH_NPM_TOKEN "$NPM_TOKEN" --shared

With https aifabrix-secrets: keys named BASH_<NAME> --shared expose <NAME> in your
  terminal as an exported env var (e.g. BASH_NPM_TOKEN → NPM_TOKEN).
`;

const SECRET_REMOVE_HELP_AFTER = `
Examples:
  $ aifabrix secret remove deprecated-key
  $ aifabrix secret remove shared-key --shared
`;

const SECRET_REMOVE_ALL_HELP_AFTER = `
You will be asked to type "yes" to confirm unless you pass --yes.

Examples:
  $ aifabrix secret remove-all
  $ aifabrix secret remove-all --yes
  $ aifabrix secret remove-all --shared
  $ aifabrix secret remove-all --shared --yes
`;

const SECRET_SET_SECRETS_FILE_HELP_AFTER = `
Examples:
  $ aifabrix secret set-secrets-file ./shared-secrets.yaml
  $ aifabrix secret set-secrets-file https://dev.example.com/api/secrets
  $ aifabrix secret set-secrets-file ""
`;

const SECRET_VALIDATE_HELP_AFTER = `
Examples:
  $ aifabrix secret validate
  $ aifabrix secret validate ./secrets.local.yaml
  $ aifabrix secret validate --naming
`;

const SECURE_HELP_AFTER = `
Examples:
  $ aifabrix secure
  $ aifabrix secure --secrets-encryption <32-byte-hex-or-base64>
`;

function setupSecretRemoveAllCommand(secretCmd) {
  const { handleSecretsRemoveAll } = require('../commands/secrets-remove-all');
  secretCmd
    .command('remove-all')
    .description('Remove all secret keys (requires typing "yes" unless --yes)')
    .addHelpText('after', SECRET_REMOVE_ALL_HELP_AFTER)
    .option('--shared', 'Remove all from shared secrets (file or remote API)')
    .option('-y, --yes', 'Skip confirmation prompt (non-interactive / scripts)')
    .action(async options => {
      try {
        await config.ensureSecretsEncryptionKey();
        await handleSecretsRemoveAll(options);
      } catch (error) {
        handleCommandError(error, 'secret remove-all');
        process.exit(1);
      }
    });
}

function setupSecretValidateCommand(secretCmd) {
  secretCmd
    .command('validate [path]')
    .description('Validate secrets file (YAML structure and optional naming convention)')
    .addHelpText('after', SECRET_VALIDATE_HELP_AFTER)
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
    .description('Encrypt secrets.local.yaml at rest (ISO 27001)')
    .addHelpText('after', SECURE_HELP_AFTER)
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

function setupSecretListCommand(secretCmd) {
  secretCmd
    .command('list')
    .description('List secret keys (--shared for shared/remote)')
    .addHelpText('after', SECRET_LIST_HELP_AFTER)
    .option('--shared', 'List shared secrets (from config aifabrix-secrets or remote API)')
    .action(async options => {
      try {
        await config.ensureSecretsEncryptionKey();
        await handleSecretsList(options);
      } catch (error) {
        handleCommandError(error, 'secret list');
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
    .description('User and shared secrets (list, set, remove, remove-all, validate)')
    .addHelpText('after', SECRET_GROUP_HELP_AFTER);

  setupSecretListCommand(secretCmd);

  secretCmd
    .command('set <key> <value>')
    .description(
      'Set a secret (default: user secrets.local.yaml beside config; --shared → aifabrix-secrets store)'
    )
    .addHelpText('after', SECRET_SET_HELP_AFTER)
    .option(
      '--shared',
      'Write to shared secrets (config aifabrix-secrets: YAML path or https), not user secrets.local.yaml'
    )
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
    .description('Remove a secret key')
    .addHelpText('after', SECRET_REMOVE_HELP_AFTER)
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

  setupSecretRemoveAllCommand(secretCmd);
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
    .description('Set shared secrets path in config (file or https; empty clears; not validated)')
    .addHelpText('after', SECRET_SET_SECRETS_FILE_HELP_AFTER)
    .action(async(secretsPath) => {
      try {
        const trimmed = (secretsPath || '').trim();
        if (trimmed !== '' && trimmed.startsWith('http://')) {
          throw new Error('Only https URLs are allowed for remote secrets');
        }
        await config.setSecretsPath(trimmed);
        logger.log(trimmed === '' ? formatSuccessLine('Secrets file path cleared') : formatSuccessLine(`Secrets file path set to ${trimmed}`));
      } catch (error) {
        handleCommandError(error, 'secret set-secrets-file');
        process.exit(1);
      }
    });
}

module.exports = { setupSecretsCommands };
