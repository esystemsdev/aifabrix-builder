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
 * On Windows, Compose often forwards binds as "SOURCE:TARGET:rw". A SOURCE
 * like "C:/Users/..." is split at the first colon, so the engine must receive
 * paths in Linux-VM form (e.g. "/c/Users/...") instead.
 *
 * @param {string} fsPath - Host path (absolute or relative)
 * @returns {string} Path with forward slashes, resolved when relative
 */
function toDockerBindMountSource(fsPath) {
  if (!fsPath || typeof fsPath !== 'string') {
    return fsPath;
  }
  let resolved = path.resolve(fsPath).split(path.sep).join('/');
  if (process.platform === 'win32') {
    const drive = /^([a-zA-Z]):(\/.*)$/.exec(resolved);
    if (drive) {
      resolved = `/${drive[1].toLowerCase()}${drive[2]}`;
    }
  }
  return resolved;
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
    keyFile: process.env.TRAEFIK_KEY_FILE || null,
    trustForwardedHeaders: false
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
      errors.push(
        'TLS is enabled for Traefik but certificate files are missing or invalid. ' +
          'Set TRAEFIK_CERT_FILE and TRAEFIK_KEY_FILE (and TRAEFIK_CERT_STORE if used) to your local cert and key, ' +
          'or disable TLS in application/frontDoorRouting for local development.'
      );
    } else {
      if (!fs.existsSync(traefikConfig.certFile)) {
        errors.push(
          'TLS is enabled for Traefik but certificate files are missing or invalid. ' +
            `Certificate file not found: ${traefikConfig.certFile}`
        );
      }
      if (!fs.existsSync(traefikConfig.keyFile)) {
        errors.push(
          'TLS is enabled for Traefik but certificate files are missing or invalid. ' +
            `Private key file not found: ${traefikConfig.keyFile}`
        );
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
      trustForwardedHeaders: !!traefikConfig.trustForwardedHeaders,
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
