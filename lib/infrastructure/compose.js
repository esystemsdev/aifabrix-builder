/**
 * AI Fabrix Builder Infrastructure Compose File Generation
 *
 * Handles Docker Compose file generation from templates and Traefik configuration.
 *
 * @fileoverview Compose file generation for infrastructure
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const handlebars = require('handlebars');
const path = require('path');

/**
 * Normalize a host path for Docker Compose bind mounts. Docker Desktop sends
 * mounts to a Linux VM; backslashes in Windows paths yield "invalid volume
 * specification" from the daemon.
 *
 * @param {string} fsPath - Host path (absolute or relative)
 * @returns {string} Path with forward slashes, resolved when relative
 */
function toDockerBindMountSource(fsPath) {
  if (!fsPath || typeof fsPath !== 'string') {
    return fsPath;
  }
  return path.resolve(fsPath).split(path.sep).join('/');
}

/**
 * Builds Traefik configuration from environment variables
 * @param {boolean} enabled - Whether Traefik should be included
 * @returns {Object} Traefik configuration
 */
function buildTraefikConfig(enabled) {
  return {
    enabled: !!enabled,
    certStore: process.env.TRAEFIK_CERT_STORE || null,
    certFile: process.env.TRAEFIK_CERT_FILE || null,
    keyFile: process.env.TRAEFIK_KEY_FILE || null
  };
}

/**
 * Validates Traefik configuration when enabled
 * @param {Object} traefikConfig - Traefik configuration
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
function validateTraefikConfig(traefikConfig) {
  if (!traefikConfig || !traefikConfig.enabled) {
    return { valid: true, errors: [] };
  }

  const errors = [];

  if (traefikConfig.certStore) {
    if (!traefikConfig.certFile || !traefikConfig.keyFile) {
      errors.push('TRAEFIK_CERT_FILE and TRAEFIK_KEY_FILE are required when TRAEFIK_CERT_STORE is set');
    } else {
      if (!fs.existsSync(traefikConfig.certFile)) {
        errors.push(`Certificate file not found: ${traefikConfig.certFile}`);
      }
      if (!fs.existsSync(traefikConfig.keyFile)) {
        errors.push(`Private key file not found: ${traefikConfig.keyFile}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Generate docker-compose file from template
 * @param {string} templatePath - Path to compose template
 * @param {string} devId - Developer ID
 * @param {number} idNum - Developer ID number
 * @param {Object} ports - Port configuration
 * @param {string} infraDir - Infrastructure directory
 * @param {Object} [options] - Additional options
 * @param {Object|boolean} [options.traefik] - Traefik configuration
 * @param {Object} [options.pgadmin] - pgAdmin config { enabled: boolean }
 * @param {Object} [options.redisCommander] - Redis Commander config { enabled: boolean }
 * @returns {string} Path to generated compose file
 */
function generateComposeFile(templatePath, devId, idNum, ports, infraDir, options = {}) {
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const template = handlebars.compile(templateContent);
  const networkName = idNum === 0 ? 'infra-aifabrix-network' : `infra-dev${devId}-aifabrix-network`;
  const serversJsonPath = path.join(infraDir, 'servers.json');
  const pgpassPath = path.join(infraDir, 'pgpass');
  const traefikConfig = typeof options.traefik === 'object'
    ? options.traefik
    : buildTraefikConfig(!!options.traefik);
  const pgadminConfig = options.pgadmin && typeof options.pgadmin.enabled === 'boolean'
    ? options.pgadmin
    : { enabled: true };
  const redisCommanderConfig = options.redisCommander && typeof options.redisCommander.enabled === 'boolean'
    ? options.redisCommander
    : { enabled: true };
  const traefikForCompose = traefikConfig && typeof traefikConfig === 'object'
    ? {
      ...traefikConfig,
      ...(traefikConfig.certFile
        ? { certFile: toDockerBindMountSource(traefikConfig.certFile) }
        : {}),
      ...(traefikConfig.keyFile
        ? { keyFile: toDockerBindMountSource(traefikConfig.keyFile) }
        : {})
    }
    : traefikConfig;
  const initScriptsBind = toDockerBindMountSource(path.join(infraDir, 'init-scripts'));
  const infraDirBind = toDockerBindMountSource(infraDir);
  const composeContent = template({
    devId: devId,
    postgresPort: ports.postgres,
    redisPort: ports.redis,
    pgadminPort: ports.pgadmin,
    redisCommanderPort: ports.redisCommander,
    traefikHttpPort: ports.traefikHttp,
    traefikHttpsPort: ports.traefikHttps,
    networkName: networkName,
    serversJsonPath: serversJsonPath,
    pgpassPath: pgpassPath,
    infraDir: infraDir,
    initScriptsBind: initScriptsBind,
    infraDirBind: infraDirBind,
    traefik: traefikForCompose,
    pgadmin: pgadminConfig,
    redisCommander: redisCommanderConfig
  });
  const composePath = path.join(infraDir, 'compose.yaml');
  fs.writeFileSync(composePath, composeContent);
  return composePath;
}

module.exports = {
  buildTraefikConfig,
  validateTraefikConfig,
  generateComposeFile,
  toDockerBindMountSource
};
