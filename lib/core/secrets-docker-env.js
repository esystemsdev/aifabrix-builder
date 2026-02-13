/**
 * Docker environment helpers for secrets/env generation.
 *
 * @fileoverview Base docker env, config overrides, and PORT handling for container env
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const yaml = require('js-yaml');
const config = require('./config');
const { getEnvHosts } = require('../utils/env-endpoints');
const { getContainerPortFromPath } = require('../utils/port-resolver');

/**
 * Gets base docker environment config
 * @async
 * @function getBaseDockerEnv
 * @returns {Promise<Object>} Docker environment config
 */
async function getBaseDockerEnv() {
  return await getEnvHosts('docker');
}

/**
 * Applies config.yaml override to docker environment
 * @function applyDockerEnvOverride
 * @param {Object} dockerEnv - Base docker environment config
 * @returns {Object} Updated docker environment config
 */
function applyDockerEnvOverride(dockerEnv) {
  try {
    const cfgPath = config.CONFIG_FILE;
    if (fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, 'utf8');
      const cfg = yaml.load(cfgContent) || {};
      if (cfg && cfg.environments && cfg.environments.docker) {
        return { ...dockerEnv, ...cfg.environments.docker };
      }
    }
  } catch {
    // Ignore config.yaml read errors, continue with env-config values
  }
  return dockerEnv;
}

/**
 * Gets container port from docker environment config
 * @function getContainerPortFromDockerEnv
 * @param {Object} dockerEnv - Docker environment config
 * @returns {number} Container port (defaults to 3000)
 */
function getContainerPortFromDockerEnv(dockerEnv) {
  if (dockerEnv.PORT === undefined || dockerEnv.PORT === null) {
    return 3000;
  }
  const portVal = typeof dockerEnv.PORT === 'number' ? dockerEnv.PORT : parseInt(dockerEnv.PORT, 10);
  return Number.isNaN(portVal) ? 3000 : portVal;
}

/**
 * Updates PORT in resolved content for docker environment
 * Sets PORT to container port (build.containerPort or port from application config)
 * NOT the host port (which includes developer-id offset)
 * @async
 * @function updatePortForDocker
 * @param {string} resolved - Resolved environment content
 * @param {string} variablesPath - Path to application config file
 * @returns {Promise<string>} Updated content with PORT set
 */
async function updatePortForDocker(resolved, variablesPath) {
  let dockerEnv = await getBaseDockerEnv();
  dockerEnv = applyDockerEnvOverride(dockerEnv);

  let containerPort = getContainerPortFromPath(variablesPath);
  if (containerPort === null) {
    containerPort = getContainerPortFromDockerEnv(dockerEnv);
  }

  return resolved.replace(/^PORT\s*=\s*.*$/m, `PORT=${containerPort}`);
}

module.exports = {
  getBaseDockerEnv,
  applyDockerEnvOverride,
  getContainerPortFromDockerEnv,
  updatePortForDocker
};
