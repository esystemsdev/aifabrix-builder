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
    traefik: traefikConfig
  });
  const composePath = path.join(infraDir, 'compose.yaml');
  fs.writeFileSync(composePath, composeContent);
  return composePath;
}

module.exports = {
  buildTraefikConfig,
  validateTraefikConfig,
  generateComposeFile
};
