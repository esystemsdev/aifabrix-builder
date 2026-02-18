/**
 * @fileoverview aifabrix secret list – list secret keys and values (user file, shared file, or remote API)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { getAifabrixSecretsPath } = require('../core/config');
const pathsUtil = require('../utils/paths');
const { isRemoteSecretsUrl, getRemoteDevAuth } = require('../utils/remote-dev-auth');
const devApi = require('../api/dev.api');

const REMOTE_NOT_CONFIGURED_MSG = 'Remote server is not configured. Set remote-server and run "aifabrix dev init" first.';

/**
 * List secret keys and values from a YAML file.
 * @param {string} filePath - Absolute path to secrets file
 * @returns {Array<{ key: string, value: string }>} Key-value pairs (value stringified)
 */
function listKeysAndValuesFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content) || {};
    if (typeof data !== 'object' || Array.isArray(data)) return [];
    return Object.entries(data).map(([key, val]) => ({
      key,
      value: val != null ? String(val) : ''
    }));
  } catch {
    return [];
  }
}

const KEY_COL_WIDTH = 45;
const TABLE_SEPARATOR_LENGTH = 120;

/**
 * Log a list of secret keys and values as a table (header, column headers, separator, rows).
 * Keys are sorted alphabetically. Matches datasource list style.
 * @param {string} emptyMessage - Message when items.length === 0
 * @param {string} title - Table title (e.g. "User secrets")
 * @param {Array<{ key: string, value: string }>} items - Key-value pairs
 */
function logKeyValueList(emptyMessage, title, items) {
  if (items.length === 0) {
    logger.log(chalk.gray(emptyMessage));
    return;
  }
  logger.log(chalk.bold(`\n📋 ${title}:\n`));
  logger.log(chalk.gray('Key'.padEnd(KEY_COL_WIDTH) + 'Value'));
  logger.log(chalk.gray('-'.repeat(TABLE_SEPARATOR_LENGTH)));
  const sorted = [...items].sort((a, b) => a.key.localeCompare(b.key, undefined, { sensitivity: 'base' }));
  sorted.forEach(({ key, value }) => {
    const keyCol = key.padEnd(KEY_COL_WIDTH);
    logger.log(`${keyCol}${value}`);
  });
  logger.log('');
}

/**
 * List shared secrets (remote API or file) and log key and value.
 * @param {string} generalSecretsPath - Path or URL for shared secrets
 * @returns {Promise<void>}
 */
async function listSharedSecrets(generalSecretsPath) {
  if (isRemoteSecretsUrl(generalSecretsPath)) {
    const auth = await getRemoteDevAuth();
    if (!auth) {
      throw new Error(REMOTE_NOT_CONFIGURED_MSG);
    }
    const items = await devApi.listSecrets(auth.serverUrl, auth.clientCertPem);
    const keyValues = items.map(i => ({ key: i.name || i.key || '', value: i.value != null ? String(i.value) : '' }));
    logKeyValueList('No shared secrets (remote).', 'Shared secrets (remote)', keyValues);
    return;
  }
  const resolvedPath = path.isAbsolute(generalSecretsPath)
    ? generalSecretsPath
    : path.resolve(process.cwd(), generalSecretsPath);
  const keyValues = listKeysAndValuesFromFile(resolvedPath);
  const fileTitle = `Shared secrets (file: ${resolvedPath})`;
  logKeyValueList('No shared secrets in file.', fileTitle, keyValues);
}

/** List user secrets and log key and value. */
function listUserSecrets() {
  const userSecretsPath = path.join(pathsUtil.getAifabrixHome(), 'secrets.local.yaml');
  const keyValues = listKeysAndValuesFromFile(userSecretsPath);
  logKeyValueList('No user secrets.', 'User secrets', keyValues);
}

/**
 * Handle secret list command. Lists key and value for each secret.
 * @param {Object} options - Command options
 * @param {boolean} [options.shared] - If true, list shared secrets (file or remote API)
 * @returns {Promise<void>}
 */
async function handleSecretsList(options) {
  const isShared = options.shared || options['shared'] || false;

  if (isShared) {
    const generalSecretsPath = await getAifabrixSecretsPath();
    if (!generalSecretsPath) {
      throw new Error('Shared secrets not configured. Set aifabrix-secrets in config.yaml.');
    }
    await listSharedSecrets(generalSecretsPath);
  } else {
    listUserSecrets();
  }
}

module.exports = { handleSecretsList };
