/**
 * @fileoverview aifabrix secret remove-all – remove every secret (user file, shared file, or remote API)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const yaml = require('js-yaml');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getAifabrixSecretsPath } = require('../core/config');
const pathsUtil = require('../utils/paths');
const remoteDevAuth = require('../utils/remote-dev-auth');
const devApi = require('../api/dev.api');

/**
 * @param {string} question
 * @returns {Promise<string>}
 */
function promptLine(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

/**
 * Read secret keys from a YAML secrets file.
 * @param {string} filePath - Absolute path
 * @returns {string[]} Sorted unique keys
 */
function listKeysFromYamlFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content) || {};
    if (typeof data !== 'object' || Array.isArray(data)) {
      return [];
    }
    return Object.keys(data).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  } catch {
    return [];
  }
}

/**
 * Write an empty secrets map to file (same options as single-key remove).
 * @param {string} filePath - Absolute path
 */
function writeEmptySecretsFile(filePath) {
  const yamlContent = yaml.dump({}, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false });
  fs.writeFileSync(filePath, yamlContent, { mode: 0o600 });
}

/**
 * @param {boolean} skipPrompt - When true (--yes), skip confirmation
 * @param {string} whereLabel - Human-readable target
 * @param {number} count - Number of keys
 * @returns {Promise<boolean>}
 */
async function confirmRemoveAll(skipPrompt, whereLabel, count) {
  if (skipPrompt) {
    return true;
  }
  logger.log(chalk.yellow(`\nThis will permanently remove all ${count} secret key(s) from ${whereLabel}.`));
  logger.log(chalk.gray('This cannot be undone.\n'));
  const answer = (await promptLine(chalk.bold('Type "yes" to confirm (anything else cancels): '))).toLowerCase();
  return answer === 'yes';
}

/**
 * @param {Object} auth - Remote dev auth (serverUrl, clientCertPem, serverCaPem)
 * @param {string} target - Secrets endpoint URL
 * @returns {Promise<string[]>}
 */
async function listRemoteSecretKeys(auth, target) {
  const items = await devApi.listSecrets(
    auth.serverUrl,
    auth.clientCertPem,
    auth.serverCaPem || undefined,
    target
  );
  return (Array.isArray(items) ? items : [])
    .map(i => i.name || i.key || '')
    .filter(k => typeof k === 'string' && k.length > 0)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * @param {string} target - Secrets endpoint URL
 * @returns {string}
 */
function labelForRemoteSharedSecrets(target) {
  const host = remoteDevAuth.getSharedSecretsRemoteHostname(target);
  return host ? `shared secrets (remote - ${host})` : 'shared secrets (remote)';
}

/**
 * @param {Object} auth
 * @param {string[]} keys
 * @param {string} target
 * @returns {Promise<void>}
 */
async function deleteRemoteSecretKeys(auth, keys, target) {
  const ca = auth.serverCaPem || undefined;
  for (const key of keys) {
    await devApi.deleteSecret(auth.serverUrl, auth.clientCertPem, key, ca, target);
  }
}

/**
 * Remove every shared secret via remote API.
 * @param {string} target - Resolved secrets endpoint URL
 * @param {Object} options - { yes?: boolean }
 * @returns {Promise<void>}
 */
async function removeAllRemoteSharedSecrets(target, options) {
  const auth = await remoteDevAuth.getRemoteDevAuth();
  if (!auth) {
    throw new Error('Remote server not configured or certificate missing. Run "aifabrix dev init" first.');
  }
  const keys = await listRemoteSecretKeys(auth, target);
  if (keys.length === 0) {
    logger.log(chalk.gray('No shared secrets to remove.'));
    return;
  }
  const where = labelForRemoteSharedSecrets(target);
  const ok = await confirmRemoveAll(!!options.yes, where, keys.length);
  if (!ok) {
    logger.log(chalk.gray('Cancelled. No secrets were removed.'));
    return;
  }
  await deleteRemoteSecretKeys(auth, keys, target);
  logger.log(chalk.green(`✓ Removed ${keys.length} secret key(s) from ${where}.`));
}

/**
 * Remove every key from a shared secrets YAML file.
 * @param {string} resolvedPath - Absolute file path
 * @param {Object} options - { yes?: boolean }
 * @returns {Promise<void>}
 */
async function removeAllSharedFileSecrets(resolvedPath, options) {
  const keys = listKeysFromYamlFile(resolvedPath);
  if (keys.length === 0) {
    logger.log(chalk.gray('No shared secrets to remove.'));
    return;
  }
  const ok = await confirmRemoveAll(!!options.yes, `shared secrets file (${resolvedPath})`, keys.length);
  if (!ok) {
    logger.log(chalk.gray('Cancelled. No secrets were removed.'));
    return;
  }
  writeEmptySecretsFile(resolvedPath);
  logger.log(chalk.green(`✓ Removed ${keys.length} secret key(s) from shared secrets file.`));
}

/**
 * Remove every key from shared store (remote API or file).
 * @param {string} generalSecretsPath - Path or URL from config
 * @param {Object} options - { yes?: boolean }
 * @returns {Promise<void>}
 */
async function removeAllSharedSecrets(generalSecretsPath, options) {
  const target = await remoteDevAuth.resolveSharedSecretsEndpoint(generalSecretsPath);
  if (remoteDevAuth.isRemoteSecretsUrl(target)) {
    await removeAllRemoteSharedSecrets(target, options);
    return;
  }
  const resolvedPath = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
  await removeAllSharedFileSecrets(resolvedPath, options);
}

/**
 * @param {Object} options - { yes?: boolean }
 * @returns {Promise<void>}
 */
async function removeAllUserSecrets(options) {
  const userSecretsPath = pathsUtil.getPrimaryUserSecretsLocalPath();
  const keys = listKeysFromYamlFile(userSecretsPath);
  if (keys.length === 0) {
    logger.log(chalk.gray('No user secrets to remove.'));
    return;
  }
  const ok = await confirmRemoveAll(!!options.yes, `user secrets (${userSecretsPath})`, keys.length);
  if (!ok) {
    logger.log(chalk.gray('Cancelled. No secrets were removed.'));
    return;
  }
  writeEmptySecretsFile(userSecretsPath);
  logger.log(chalk.green(`✓ Removed ${keys.length} secret key(s) from user secrets.`));
}

/**
 * Handle secret remove-all command.
 * @param {Object} options - { shared?: boolean, yes?: boolean }
 * @returns {Promise<void>}
 */
async function handleSecretsRemoveAll(options) {
  const isShared = options.shared || options['shared'] || false;
  if (!isShared) {
    await removeAllUserSecrets(options);
    return;
  }
  const generalSecretsPath = await getAifabrixSecretsPath();
  if (!generalSecretsPath) {
    throw new Error('Shared secrets not configured. Set aifabrix-secrets in config.yaml.');
  }
  await removeAllSharedSecrets(generalSecretsPath, options);
}

module.exports = { handleSecretsRemoveAll };
