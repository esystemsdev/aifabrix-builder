/**
 * @fileoverview CLI action handlers for dev list/add/update/pin/delete (remote Builder Server)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const config = require('../core/config');
const logger = require('../utils/logger');
const devApi = require('../api/dev.api');
const { getRemoteDevAuth } = require('../utils/remote-dev-auth');

const REMOTE_NOT_CONFIGURED_MSG = 'Remote server is not configured. Set remote-server and run "aifabrix dev init" first.';

const ID_WIDTH = 8;
const NAME_WIDTH = 25;
const EMAIL_WIDTH = 30;
const CERT_WIDTH = 28;
const TABLE_SEPARATOR_LENGTH = 120;

/**
 * Handle dev list – list developer users (remote only). Table format, sorted by name.
 * @returns {Promise<void>}
 */
async function handleDevList() {
  const auth = await getRemoteDevAuth();
  if (!auth) {
    logger.log(chalk.yellow(REMOTE_NOT_CONFIGURED_MSG));
    return;
  }
  const users = await devApi.listUsers(auth.serverUrl, auth.clientCertPem);
  if (users.length === 0) {
    logger.log(chalk.gray('No developers registered.'));
    return;
  }
  logger.log(chalk.bold('\n📋 Developers:\n'));
  logger.log(chalk.gray('ID'.padEnd(ID_WIDTH) + 'Name'.padEnd(NAME_WIDTH) + 'Email'.padEnd(EMAIL_WIDTH) + 'Cert'.padEnd(CERT_WIDTH) + 'Groups'));
  logger.log(chalk.gray('-'.repeat(TABLE_SEPARATOR_LENGTH)));
  const sorted = [...users].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  sorted.forEach(u => {
    const certInfo = u.certificateIssued
      ? `until ${u.certificateValidNotAfter || '?'}`
      : 'no cert';
    const id = String(u.id ?? '').padEnd(ID_WIDTH);
    const name = (u.name || 'N/A').padEnd(NAME_WIDTH);
    const email = (u.email || 'N/A').padEnd(EMAIL_WIDTH);
    const cert = certInfo.padEnd(CERT_WIDTH);
    const groups = (u.groups || []).join(', ');
    logger.log(`${id}${name}${email}${cert}${groups}`);
  });
  logger.log('');
}

/**
 * Handle dev add – create developer (remote only).
 * @param {Object} options - Commander options (developerId, name, email, groups)
 * @returns {Promise<void>}
 */
async function handleDevAdd(options) {
  const auth = await getRemoteDevAuth();
  if (!auth) throw new Error(REMOTE_NOT_CONFIGURED_MSG);
  const groups = (options.groups || 'developer').split(',').map(s => s.trim()).filter(Boolean);
  const user = await devApi.createUser(auth.serverUrl, auth.clientCertPem, {
    developerId: options.developerId,
    name: options.name,
    email: options.email,
    groups: groups.length ? groups : ['developer']
  });
  logger.log(chalk.green(`✓ Developer ${user.id} created. Use "aifabrix dev pin ${user.id}" to create a PIN for onboarding.`));
}

/**
 * Handle dev update – update developer (remote only).
 * @param {string} developerId - Developer ID
 * @param {Object} options - Commander options (name, email, groups)
 * @returns {Promise<void>}
 */
async function handleDevUpdate(developerId, options) {
  const auth = await getRemoteDevAuth();
  if (!auth) throw new Error(REMOTE_NOT_CONFIGURED_MSG);
  const id = options.developerId || options['developer-id'] || developerId;
  if (!id) throw new Error('Developer ID is required (--developer-id or positional argument).');
  const body = {};
  if (options.name) body.name = options.name;
  if (options.email) body.email = options.email;
  if (options.groups) body.groups = options.groups.split(',').map(s => s.trim()).filter(Boolean);
  if (Object.keys(body).length === 0) {
    throw new Error('Provide at least one of --name, --email, --groups');
  }
  await devApi.updateUser(auth.serverUrl, auth.clientCertPem, id, body);
  logger.log(chalk.green(`✓ Developer ${id} updated.`));
}

/**
 * Handle dev pin – create/regenerate PIN (remote only).
 * @param {string} [developerId] - Developer ID (optional; uses config if omitted)
 * @returns {Promise<void>}
 */
async function handleDevPin(developerId) {
  const auth = await getRemoteDevAuth();
  if (!auth) throw new Error(REMOTE_NOT_CONFIGURED_MSG);
  const id = developerId || await config.getDeveloperId();
  if (!id) throw new Error('developerId is required (argument or set developer-id in config)');
  const res = await devApi.createPin(auth.serverUrl, auth.clientCertPem, id);
  logger.log(chalk.green(`✓ PIN created for ${id}, expires ${res.expiresAt}.`));
  logger.log(chalk.yellow('  Give this PIN once to the developer for: aifabrix dev init --developer-id ' + id + ' --server <url> --pin <pin>'));
  logger.log(chalk.cyan('  PIN: ' + res.pin));
}

/**
 * Handle dev delete – remove developer (remote only).
 * @param {string} developerId - Developer ID
 * @returns {Promise<void>}
 */
async function handleDevDelete(developerId) {
  const auth = await getRemoteDevAuth();
  if (!auth) throw new Error(REMOTE_NOT_CONFIGURED_MSG);
  const id = developerId;
  if (!id) throw new Error('Developer ID is required (positional argument or --developer-id).');
  await devApi.deleteUser(auth.serverUrl, auth.clientCertPem, id);
  logger.log(chalk.green(`✓ Developer ${id} removed.`));
}

module.exports = {
  handleDevList,
  handleDevAdd,
  handleDevUpdate,
  handleDevPin,
  handleDevDelete
};
