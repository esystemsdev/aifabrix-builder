/**
 * Mutagen sync for `aifabrix run --reload` when Docker runs on another host.
 *
 * @fileoverview ensureReloadSync extracted from run.js (size limits)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const chalk = require('chalk');
const { formatProgress } = require('../utils/cli-test-layout-chalk');
const config = require('../core/config');
const logger = require('../utils/logger');
const mutagen = require('../utils/mutagen');
const pathsUtil = require('../utils/paths');
const {
  isReloadBindMountOnEngineHost,
  isLocalhostSyncSshHost
} = require('../utils/docker-reload-mount');
const { sectionTitle, headerKeyValue, metadata } = require('../utils/cli-test-layout-chalk');

/**
 * @typedef {Object} ReloadSyncSummaryBind
 * @property {'bind-mount'} transport
 * @property {string} hostPath - Host directory bind-mounted to /app in the container
 */

/**
 * @typedef {Object} ReloadSyncSummaryMutagen
 * @property {'mutagen'} transport
 * @property {string} remotePath - Path on sync host used for Docker -v
 * @property {string} sessionName - Mutagen session name
 * @property {string} localPath - Local folder synced (same as build context)
 * @property {string} syncSshHost - sync-ssh-host from config
 * @property {string} sshUrl - Mutagen endpoint (user@host:path)
 */

/**
 * @typedef {ReloadSyncSummaryBind|ReloadSyncSummaryMutagen} ReloadSyncSummary
 */

/**
 * Install Mutagen if needed, create sync session, return summary for compose and UX.
 * @param {string} appName
 * @param {string} developerId
 * @param {boolean} debug
 * @param {string} codePath
 * @param {string} [remoteSyncPath]
 * @param {string} syncSshHost
 * @returns {Promise<ReloadSyncSummaryMutagen>}
 */
async function startMutagenReloadSync(
  appName,
  developerId,
  debug,
  codePath,
  remoteSyncPath,
  syncSshHost
) {
  const [userMutagenFolder, syncSshUser] = await Promise.all([
    config.getUserMutagenFolder(),
    config.getSyncSshUser()
  ]);
  if (!userMutagenFolder || !syncSshUser || !syncSshHost) {
    throw new Error(
      'run --reload requires remote server sync settings. Run "aifabrix dev init" or set user-mutagen-folder, sync-ssh-user, sync-ssh-host in config.'
    );
  }
  const mutagenPath = await mutagen.ensureMutagenPath(logger.log);
  const remotePath = mutagen.getRemotePath(userMutagenFolder, appName, remoteSyncPath);
  const sshUrl = mutagen.getSyncSshUrl(syncSshUser, syncSshHost, remotePath);
  const sessionName = mutagen.getSessionName(developerId, appName);
  const localPath = (codePath && typeof codePath === 'string') ? codePath : pathsUtil.getBuilderPath(appName);
  if (debug) logger.log(chalk.gray(`[DEBUG] Mutagen sync: ${sessionName} ${localPath} <-> ${sshUrl}`));
  logger.log(formatProgress('Reload: ensuring Mutagen sync (remote Docker engine)…'));
  await mutagen.ensureSyncSession(mutagenPath, sessionName, localPath, sshUrl);
  return {
    transport: 'mutagen',
    remotePath,
    sessionName,
    localPath,
    syncSshHost,
    sshUrl
  };
}

/**
 * When run --reload in dev with remote: ensure Mutagen sync session; return summary for mounts and CLI copy.
 * Uses codePath (resolved build.context) as Mutagen local path so one config field drives both local and remote.
 * Skips Mutagen when docker-endpoint targets this host (bind mount) or sync-ssh-host is localhost.
 *
 * @param {string} appName - Application name
 * @param {string} developerId - Developer ID
 * @param {boolean} debug - Debug flag
 * @param {string} codePath - Resolved build.context (absolute path to app code)
 * @param {string} [remoteSyncPath] - Optional relative path under user-mutagen-folder (from build.remoteSyncPath); when unset, defaults to dev/<appKey>
 * @returns {Promise<ReloadSyncSummary>}
 * @throws {Error} If --reload but remote not configured, or Mutagen install fails
 */
async function ensureReloadSync(appName, developerId, debug, codePath, remoteSyncPath) {
  const endpoint = await config.getDockerEndpoint();
  if (isReloadBindMountOnEngineHost(endpoint)) {
    if (debug) {
      logger.log(
        chalk.gray('[DEBUG] Docker engine shares this host filesystem; skipping Mutagen for --reload')
      );
    }
    return { transport: 'bind-mount', hostPath: codePath };
  }
  const syncSshHost = await config.getSyncSshHost();
  if (isLocalhostSyncSshHost(syncSshHost || '')) {
    if (debug) {
      logger.log(chalk.gray('[DEBUG] sync-ssh-host is localhost; skipping Mutagen, using local path'));
    }
    return { transport: 'bind-mount', hostPath: codePath };
  }
  return startMutagenReloadSync(appName, developerId, debug, codePath, remoteSyncPath, syncSshHost);
}

/**
 * Log how --reload is wired (bind vs Mutagen) after compose/env prep, before container start.
 * @param {boolean} reload
 * @param {ReloadSyncSummary|undefined} summary
 */
function logReloadDevSummary(reload, summary) {
  if (!reload || !summary) {
    return;
  }
  logger.log('');
  logger.log(sectionTitle('Reload (dev)'));
  if (summary.transport === 'bind-mount') {
    logger.log(headerKeyValue('Transport:', 'Direct bind mount on the Docker host (no Mutagen).'));
    logger.log(headerKeyValue('Host path → container:', `${summary.hostPath} → /app`));
    logger.log(metadata('Edits under the host path are visible inside the container immediately.'));
    logger.log('');
    return;
  }
  logger.log(headerKeyValue('Transport:', 'Mutagen two-way sync (Docker engine on another host).'));
  logger.log(headerKeyValue('Session:', summary.sessionName));
  logger.log(headerKeyValue('Sync host:', summary.syncSshHost));
  logger.log(headerKeyValue('Local folder:', summary.localPath));
  logger.log(headerKeyValue('Remote mount (-v):', summary.remotePath));
  logger.log(metadata(`Mutagen endpoint: ${summary.sshUrl}`));
  logger.log('');
}

module.exports = { ensureReloadSync, logReloadDevSummary };
