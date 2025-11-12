/**
 * AI Fabrix Builder - Secure Command
 *
 * Handles encryption of secrets in secrets.local.yaml files
 * Sets encryption key in config.yaml and encrypts all secret values
 *
 * @fileoverview Secure command implementation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const inquirer = require('inquirer');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { setSecretsEncryptionKey, getSecretsEncryptionKey } = require('../config');
const { encryptSecret, isEncrypted, validateEncryptionKey } = require('../utils/secrets-encryption');
const { encryptYamlValues } = require('../utils/yaml-preserve');

/**
 * Finds all secrets.local.yaml files to encrypt
 * Includes user secrets file and build secrets from all apps
 *
 * @async
 * @function findSecretsFiles
 * @returns {Promise<Array<{path: string, type: string}>>} Array of secrets file paths
 */
async function findSecretsFiles() {
  const files = [];

  // User's secrets file
  const userSecretsPath = path.join(os.homedir(), '.aifabrix', 'secrets.local.yaml');
  if (fs.existsSync(userSecretsPath)) {
    files.push({ path: userSecretsPath, type: 'user' });
  }

  // Find all apps and check for build.secrets
  // Scan builder directory for apps
  try {
    const builderDir = path.join(process.cwd(), 'builder');
    if (fs.existsSync(builderDir)) {
      const entries = fs.readdirSync(builderDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const appName = entry.name;
          const variablesPath = path.join(builderDir, appName, 'variables.yaml');
          if (fs.existsSync(variablesPath)) {
            try {
              const variablesContent = fs.readFileSync(variablesPath, 'utf8');
              const variables = yaml.load(variablesContent);

              if (variables?.build?.secrets) {
                const buildSecretsPath = path.resolve(
                  path.dirname(variablesPath),
                  variables.build.secrets
                );
                if (fs.existsSync(buildSecretsPath)) {
                  files.push({ path: buildSecretsPath, type: `app:${appName}` });
                }
              }
            } catch (error) {
              // Ignore errors, continue
            }
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors, continue
  }

  // Check config.yaml for general secrets-path
  try {
    const { getSecretsPath } = require('../config');
    const generalSecretsPath = await getSecretsPath();
    if (generalSecretsPath) {
      const resolvedPath = path.isAbsolute(generalSecretsPath)
        ? generalSecretsPath
        : path.resolve(process.cwd(), generalSecretsPath);
      if (fs.existsSync(resolvedPath) && !files.some(f => f.path === resolvedPath)) {
        files.push({ path: resolvedPath, type: 'general' });
      }
    }
  } catch (error) {
    // Ignore errors, continue
  }

  return files;
}

/**
 * Encrypts all non-encrypted values in a secrets file
 * Preserves YAML structure, comments, and formatting
 * Skips URLs (http:// and https://) as they are not secrets
 *
 * @async
 * @function encryptSecretsFile
 * @param {string} filePath - Path to secrets file
 * @param {string} encryptionKey - Encryption key
 * @returns {Promise<{encrypted: number, total: number}>} Count of encrypted values
 */
async function encryptSecretsFile(filePath, encryptionKey) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Validate that file contains valid YAML structure (optional check)
  try {
    const secrets = yaml.load(content);
    if (!secrets || typeof secrets !== 'object') {
      throw new Error(`Invalid secrets file format: ${filePath}`);
    }
  } catch (error) {
    // If YAML parsing fails, still try to encrypt (might have syntax issues but could be fixable)
    // The line-by-line parser will handle it gracefully
  }

  // Use line-by-line encryption to preserve comments and formatting
  const result = encryptYamlValues(content, encryptionKey);

  // Write back to file preserving all formatting
  fs.writeFileSync(filePath, result.content, { mode: 0o600 });

  return { encrypted: result.encrypted, total: result.total };
}

/**
 * Prompt for encryption key if not provided
 *
 * @async
 * @function promptForEncryptionKey
 * @returns {Promise<string>} Encryption key
 */
async function promptForEncryptionKey() {
  const answer = await inquirer.prompt([{
    type: 'password',
    name: 'key',
    message: 'Enter encryption key (32 bytes, hex or base64):',
    mask: '*',
    validate: (input) => {
      if (!input || input.trim().length === 0) {
        return 'Encryption key is required';
      }
      try {
        validateEncryptionKey(input.trim());
        return true;
      } catch (error) {
        return error.message;
      }
    }
  }]);

  return answer.key.trim();
}

/**
 * Handle secure command action
 * Sets encryption key and encrypts all secrets files
 *
 * @async
 * @function handleSecure
 * @param {Object} options - Command options
 * @param {string} [options.secretsEncryption] - Encryption key (optional, will prompt if not provided)
 * @returns {Promise<void>} Resolves when encryption completes
 * @throws {Error} If encryption fails
 */
async function handleSecure(options) {
  logger.log(chalk.blue('\n🔐 Securing secrets files...\n'));

  // Get or prompt for encryption key
  let encryptionKey = options.secretsEncryption || options['secrets-encryption'];
  if (!encryptionKey) {
    // Check if key already exists in config
    const existingKey = await getSecretsEncryptionKey();
    if (existingKey) {
      logger.log(chalk.yellow('⚠️  Encryption key already configured in config.yaml'));
      const useExisting = await inquirer.prompt([{
        type: 'confirm',
        name: 'use',
        message: 'Use existing encryption key?',
        default: true
      }]);
      if (useExisting.use) {
        encryptionKey = existingKey;
      } else {
        encryptionKey = await promptForEncryptionKey();
        await setSecretsEncryptionKey(encryptionKey);
        logger.log(chalk.green('✓ Encryption key saved to config.yaml'));
      }
    } else {
      encryptionKey = await promptForEncryptionKey();
      await setSecretsEncryptionKey(encryptionKey);
      logger.log(chalk.green('✓ Encryption key saved to config.yaml'));
    }
  } else {
    // Validate and save the provided key
    validateEncryptionKey(encryptionKey);
    await setSecretsEncryptionKey(encryptionKey);
    logger.log(chalk.green('✓ Encryption key saved to config.yaml'));
  }

  // Find all secrets files
  const secretsFiles = await findSecretsFiles();

  if (secretsFiles.length === 0) {
    logger.log(chalk.yellow('⚠️  No secrets files found to encrypt'));
    logger.log(chalk.gray('   Create ~/.aifabrix/secrets.local.yaml or configure build.secrets in variables.yaml'));
    return;
  }

  logger.log(chalk.gray(`Found ${secretsFiles.length} secrets file(s) to process:\n`));

  // Encrypt each file
  let totalEncrypted = 0;
  let totalValues = 0;

  for (const file of secretsFiles) {
    try {
      logger.log(chalk.gray(`Processing: ${file.path} (${file.type})`));
      const result = await encryptSecretsFile(file.path, encryptionKey);
      totalEncrypted += result.encrypted;
      totalValues += result.total;

      if (result.encrypted > 0) {
        logger.log(chalk.green(`  ✓ Encrypted ${result.encrypted} of ${result.total} values`));
      } else {
        logger.log(chalk.gray(`  - All values already encrypted (${result.total} total)`));
      }
    } catch (error) {
      logger.log(chalk.red(`  ✗ Error: ${error.message}`));
    }
  }

  logger.log(chalk.green('\n✅ Encryption complete!'));
  logger.log(chalk.gray(`   Files processed: ${secretsFiles.length}`));
  logger.log(chalk.gray(`   Values encrypted: ${totalEncrypted} of ${totalValues} total`));
  logger.log(chalk.gray('   Encryption key stored in: ~/.aifabrix/config.yaml\n'));
}

module.exports = { handleSecure };

