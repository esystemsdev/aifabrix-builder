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
 * Log workspace transport after a successful container restart (mounts unchanged).
 * @param {string} containerName - Docker container name
 * @returns {Promise<void>}
 */
async function logRestartDevMountSummary(containerName) {
  if (!containerName || typeof containerName !== 'string') {
    return;
  }
  const mounts = await fetchContainerMountsJson(containerName);
  const appBind = findAppBindMount(mounts);
  if (!appBind) {
    return;
  }
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

module.exports = {
  findAppBindMount,
  logRestartDevMountSummary
};
