/**
 * @fileoverview After dev init: merge SSH config Host alias from sync settings / server URL.
 */

const chalk = require('chalk');
const config = require('../core/config');
const logger = require('./logger');
const { ensureDevSshConfigBlock } = require('./dev-ssh-config-helper');
const { successGlyph } = require('./cli-layout-chalk');

/**
 * Hostname from Builder Server URL (for sync-ssh-host fallback).
 * @param {string} baseUrl - e.g. https://builder02.local
 * @returns {string|null}
 */
function hostnameFromBaseUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') return null;
  const s = baseUrl.trim().replace(/\/+$/, '');
  const withProtocol = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    return new URL(withProtocol).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Update ~/.ssh/config with Host <user>.<host> for interactive SSH; log result.
 * @param {string} baseUrl - Builder Server base URL
 * @param {string} devId - Developer ID (digits)
 * @returns {Promise<{ hostAlias: string|null, syncUser: string, syncHost: string|null }>}
 */
async function mergeDevSshConfigAfterInit(baseUrl, devId) {
  const syncHost = (await config.getSyncSshHost()) || hostnameFromBaseUrl(baseUrl);
  const syncUser = (await config.getSyncSshUser()) || `dev${devId}`;
  if (!syncHost) {
    return { hostAlias: null, syncUser, syncHost: null };
  }
  try {
    const res = await ensureDevSshConfigBlock(syncUser, syncHost);
    if (res.ok && res.configPath && res.hostAlias) {
      if (res.skippedDuplicate) {
        logger.log(
          chalk.gray('  SSH config already has ') +
            chalk.cyan(`${syncUser}@${syncHost}`) +
            chalk.gray(` (Host ${res.hostAlias}); left unchanged.`)
        );
      } else {
        logger.log(
          `${chalk.green('  ')}${successGlyph()}${chalk.green(' SSH config updated: ')}` +
            chalk.cyan(`Host ${res.hostAlias}`) +
            chalk.gray(` → ${res.configPath}`)
        );
      }
      return { hostAlias: res.hostAlias, syncUser, syncHost };
    }
    if (!res.ok && res.error) {
      logger.log(chalk.yellow(`  ⚠ Could not update SSH config: ${res.error}`));
    }
  } catch (e) {
    logger.log(chalk.yellow(`  ⚠ Could not update SSH config: ${e.message || e}`));
  }
  return { hostAlias: null, syncUser, syncHost };
}

module.exports = { mergeDevSshConfigAfterInit, hostnameFromBaseUrl };
