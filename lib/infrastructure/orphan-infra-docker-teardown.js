/**
 * Tear down AI Fabrix infra Docker resources when compose.yaml / admin-secrets
 * are missing from disk (e.g. after manual deletes). Matches compose naming from
 * `templates/infra/compose.yaml.hbs` and `lib/infrastructure/compose.js`.
 *
 * @fileoverview Orphan Docker teardown for developer-scoped infra stacks
 */

'use strict';

const dockerUtils = require('../utils/docker');
const logger = require('../utils/logger');
const { execAsyncWithCwd } = require('./services');
const { getInfraProjectName } = require('./helpers');

/**
 * Bridge network name for this developer (must match compose generator).
 * @param {string|number} devId - Developer ID
 * @returns {string}
 */
function getInfraBridgeNetworkName(devId) {
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  return idNum === 0 ? 'infra-aifabrix-network' : `infra-dev${devId}-aifabrix-network`;
}

/**
 * Known infra service container names (postgres, redis, optional UIs).
 * @param {string|number} devId - Developer ID
 * @returns {string[]}
 */
function getInfraServiceContainerNames(devId) {
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  if (idNum === 0) {
    return ['aifabrix-postgres', 'aifabrix-redis', 'aifabrix-pgadmin', 'aifabrix-redis-commander', 'aifabrix-traefik'];
  }
  return [
    `aifabrix-dev${devId}-postgres`,
    `aifabrix-dev${devId}-redis`,
    `aifabrix-dev${devId}-pgadmin`,
    `aifabrix-dev${devId}-redis-commander`,
    `aifabrix-dev${devId}-traefik`
  ];
}

/**
 * Named volumes declared in infra compose (explicit `name:` entries).
 * @param {string|number} devId - Developer ID
 * @returns {string[]}
 */
function getInfraNamedVolumeCandidates(devId) {
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  if (idNum === 0) {
    return ['infra_postgres_data', 'infra_redis_data', 'infra_pgadmin_data'];
  }
  return [
    `infra_dev${devId}_postgres_data`,
    `infra_dev${devId}_redis_data`,
    `infra_dev${devId}_pgadmin_data`
  ];
}

/**
 * `docker compose down` using only the Compose project name (works when the
 * compose file was removed but the project still exists in Docker).
 *
 * @param {string|number} devId - Developer ID
 * @param {boolean} withVolumes - Pass `-v` to remove named volumes
 * @returns {Promise<void>}
 */
async function tryComposeProjectDown(devId, withVolumes) {
  const composeCmd = await dockerUtils.getComposeCommand();
  const projectName = getInfraProjectName(devId);
  const volFlag = withVolumes ? ' -v' : '';
  await execAsyncWithCwd(`${composeCmd} -p "${projectName}" down${volFlag}`);
}

/**
 * @param {string} name - Container name
 * @returns {Promise<void>}
 */
async function dockerRmForceOne(name) {
  try {
    await execAsyncWithCwd(`docker rm -f "${name}"`);
    logger.log(`Stopped and removed container: ${name}`);
  } catch {
    logger.log(`Container ${name} not running or already removed`);
  }
}

/**
 * @param {string} vol - Volume name
 * @returns {Promise<void>}
 */
async function dockerVolumeRmForceOne(vol) {
  try {
    await execAsyncWithCwd(`docker volume rm -f "${vol}"`);
    logger.log(`Removed volume: ${vol}`);
  } catch {
    logger.log(`Volume ${vol} not found or already removed`);
  }
}

/**
 * Remove containers on the developer infra bridge network (covers strays).
 * @param {string} networkName - Docker network name
 * @returns {Promise<void>}
 */
async function removeContainersOnNetwork(networkName) {
  let stdout = '';
  try {
    ({ stdout } = await execAsyncWithCwd(
      `docker network inspect "${networkName}" --format '{{json .Containers}}'`
    ));
  } catch {
    return;
  }
  const raw = String(stdout || '').trim();
  if (!raw || raw === 'null' || raw === '{}') return;
  let containers;
  try {
    containers = JSON.parse(raw);
  } catch {
    return;
  }
  for (const endpoint of Object.values(containers)) {
    const name = endpoint && typeof endpoint.Name === 'string' ? endpoint.Name.replace(/^\//, '') : '';
    if (name) await dockerRmForceOne(name);
  }
}

/**
 * Remove bridge network if present.
 * @param {string} networkName - Docker network name
 * @returns {Promise<void>}
 */
async function removeNetworkIfPresent(networkName) {
  try {
    await execAsyncWithCwd(`docker network rm "${networkName}"`);
    logger.log(`Removed network: ${networkName}`);
  } catch {
    logger.log(`Network ${networkName} not removed (still in use or already gone)`);
  }
}

/**
 * Last-resort teardown: remove known infra containers, optional volumes, then network.
 *
 * @param {string|number} devId - Developer ID
 * @param {{ removeVolumes?: boolean }} [opts]
 * @returns {Promise<void>}
 */
async function stopInfraDockerStackOrphaned(devId, opts = {}) {
  const removeVolumes = opts.removeVolumes !== false;
  const networkName = getInfraBridgeNetworkName(devId);

  for (const name of getInfraServiceContainerNames(devId)) {
    await dockerRmForceOne(name);
  }

  await removeContainersOnNetwork(networkName);

  if (removeVolumes) {
    for (const vol of getInfraNamedVolumeCandidates(devId)) {
      await dockerVolumeRmForceOne(vol);
    }
  }

  await removeNetworkIfPresent(networkName);
}

module.exports = {
  getInfraBridgeNetworkName,
  getInfraServiceContainerNames,
  getInfraNamedVolumeCandidates,
  tryComposeProjectDown,
  stopInfraDockerStackOrphaned
};
