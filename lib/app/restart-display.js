/**
 * After `docker restart`, describe dev workspace mounts for developer clarity.
 *
 * @fileoverview Bind mount vs remote-engine hints (aligns with run --reload messaging)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const logger = require('../utils/logger');
const config = require('../core/config');
const { execWithDockerEnv } = require('../utils/docker-exec');
const { sectionTitle, headerKeyValue, metadata } = require('../utils/cli-test-layout-chalk');
const { isReloadBindMountOnEngineHost } = require('../utils/docker-reload-mount');
const { isApplicationsReloadDefaultOn } = require('../utils/applications-config-defaults');

/**
 * @param {unknown} mounts - docker inspect .Mounts
 * @returns {{ Type: string, Source: string, Destination: string }|null}
 */
function findAppBindMount(mounts) {
  if (!Array.isArray(mounts)) {
    return null;
  }
  const hit = mounts.find((m) => m && m.Type === 'bind' && m.Destination === '/app');
  return hit && typeof hit.Source === 'string' ? hit : null;
}

/**
 * @param {string} stdout
 * @returns {unknown|null}
 */
function parseInspectMountsStdout(stdout) {
  try {
    return JSON.parse(String(stdout || '').trim());
  } catch {
    return null;
  }
}

/**
 * @param {string} containerName
 * @returns {Promise<unknown|null>}
 */
async function fetchContainerMountsJson(containerName) {
  try {
    const { stdout } = await execWithDockerEnv(
      `docker inspect --format '{{json .Mounts}}' ${containerName}`,
      { maxBuffer: 2 * 1024 * 1024 }
    );
    return parseInspectMountsStdout(stdout);
  } catch {
    return null;
  }
}

/**
 * Log saved reload default for the app (same source as `aifabrix run` dev persist / `aifabrix show`).
 * @param {string|null|undefined} appName - Application key (e.g. miso-controller)
 * @returns {Promise<void>}
 */
async function logReloadConfigSummaryForRestart(appName) {
  if (!appName || typeof appName !== 'string') {
    return;
  }
  const userCfg = await config.getConfig();
  const reloadOn = isApplicationsReloadDefaultOn(userCfg, appName);
  logger.log('');
  logger.log(sectionTitle('Reload (config)'));
  logger.log(
    headerKeyValue(
      'Next dev run:',
      reloadOn ? 'reload on (applications.<app>.reload in config)' : 'reload off'
    )
  );
  logger.log(
    metadata(
      'Persisted when you last ran this app in dev with or without --reload. Use aifabrix show <app> to inspect.'
    )
  );
  logger.log('');
}

/**
 * Log workspace transport after a successful container restart (mounts unchanged).
 * @param {string} containerName - Docker container name
 * @param {string|null} [appName] - Application key; when set, logs reload default from config after mount info
 * @returns {Promise<void>}
 */
async function logRestartDevMountSummary(containerName, appName = null) {
  if (!containerName || typeof containerName !== 'string') {
    await logReloadConfigSummaryForRestart(appName);
    return;
  }
  const mounts = await fetchContainerMountsJson(containerName);
  const appBind = findAppBindMount(mounts);
  if (appBind) {
    const endpoint = await config.getDockerEndpoint();
    const localEngine = isReloadBindMountOnEngineHost(endpoint);

    logger.log('');
    logger.log(sectionTitle('Dev workspace (unchanged by restart)'));
    if (localEngine) {
      logger.log(headerKeyValue('Transport:', 'Direct bind mount on the Docker host (no Mutagen).'));
      logger.log(headerKeyValue('Host path → container:', `${appBind.Source} → /app`));
      logger.log(metadata('Edits under the host path are visible inside the container immediately.'));
    } else {
      logger.log(
        headerKeyValue(
          'Transport:',
          'Bind mount on the Docker engine (see path below; Mutagen may sync to this path when using --reload).'
        )
      );
      logger.log(headerKeyValue('Engine path → container:', `${appBind.Source} → /app`));
    }
    logger.log('');
  }
  await logReloadConfigSummaryForRestart(appName);
}

module.exports = {
  findAppBindMount,
  logReloadConfigSummaryForRestart,
  logRestartDevMountSummary
};
