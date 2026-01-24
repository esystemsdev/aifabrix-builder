/**
 * AI Fabrix Builder Infrastructure Helpers
 *
 * Helper functions for infrastructure management including directory names,
 * Docker availability checks, and pgAdmin configuration.
 *
 * @fileoverview Helper functions for infrastructure management
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const secrets = require('../core/secrets');
const logger = require('../utils/logger');
const dockerUtils = require('../utils/docker');
const paths = require('../utils/paths');

/**
 * Gets infrastructure directory name based on developer ID
 * Dev 0: infra (no dev-0 suffix), Dev > 0: infra-dev{id}
 * @param {number|string} devId - Developer ID
 * @returns {string} Infrastructure directory name
 */
function getInfraDirName(devId) {
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  return idNum === 0 ? 'infra' : `infra-dev${devId}`;
}

/**
 * Gets Docker Compose project name based on developer ID
 * Dev 0: infra (no dev-0 suffix), Dev > 0: infra-dev{id}
 * @param {number|string} devId - Developer ID
 * @returns {string} Docker Compose project name
 */
function getInfraProjectName(devId) {
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  return idNum === 0 ? 'infra' : `infra-dev${devId}`;
}

/**
 * Check Docker availability
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If Docker is not available
 */
async function checkDockerAvailability() {
  try {
    await dockerUtils.ensureDockerAndCompose();
  } catch (error) {
    throw new Error('Docker or Docker Compose is not available. Please install and start Docker.');
  }
}

/**
 * Ensure admin secrets file exists
 * @async
 * @returns {Promise<string>} Path to admin secrets file
 */
async function ensureAdminSecrets() {
  const adminSecretsPath = path.join(paths.getAifabrixHome(), 'admin-secrets.env');
  if (!fs.existsSync(adminSecretsPath)) {
    logger.log('Generating admin-secrets.env...');
    await secrets.generateAdminSecretsEnv();
  }
  return adminSecretsPath;
}

/**
 * Generates pgAdmin4 configuration files (servers.json and pgpass)
 * @param {string} infraDir - Infrastructure directory path
 * @param {string} postgresPassword - PostgreSQL password
 */
function generatePgAdminConfig(infraDir, postgresPassword) {
  const serversJsonTemplatePath = path.join(__dirname, '..', 'templates', 'infra', 'servers.json.hbs');
  if (!fs.existsSync(serversJsonTemplatePath)) {
    return;
  }

  const serversJsonTemplateContent = fs.readFileSync(serversJsonTemplatePath, 'utf8');
  const serversJsonTemplate = handlebars.compile(serversJsonTemplateContent);
  const serversJsonContent = serversJsonTemplate({ postgresPassword });
  const serversJsonPath = path.join(infraDir, 'servers.json');
  fs.writeFileSync(serversJsonPath, serversJsonContent, { mode: 0o644 });

  const pgpassContent = `postgres:5432:postgres:pgadmin:${postgresPassword}\n`;
  const pgpassPath = path.join(infraDir, 'pgpass');
  fs.writeFileSync(pgpassPath, pgpassContent, { mode: 0o600 });
}

/**
 * Prepare infrastructure directory and extract postgres password
 * @param {string} devId - Developer ID
 * @param {string} adminSecretsPath - Path to admin secrets file
 * @returns {Object} Object with infraDir and postgresPassword
 */
function prepareInfraDirectory(devId, adminSecretsPath) {
  const aifabrixDir = paths.getAifabrixHome();
  const infraDirName = getInfraDirName(devId);
  const infraDir = path.join(aifabrixDir, infraDirName);
  if (!fs.existsSync(infraDir)) {
    fs.mkdirSync(infraDir, { recursive: true });
  }

  const adminSecretsContent = fs.readFileSync(adminSecretsPath, 'utf8');
  const postgresPasswordMatch = adminSecretsContent.match(/^POSTGRES_PASSWORD=(.+)$/m);
  const postgresPassword = postgresPasswordMatch ? postgresPasswordMatch[1] : '';
  generatePgAdminConfig(infraDir, postgresPassword);

  return { infraDir, postgresPassword };
}

/**
 * Register Handlebars helper for equality comparison
 */
function registerHandlebarsHelper() {
  handlebars.registerHelper('eq', (a, b) => {
    // Handle null/undefined - treat as "0" for default infrastructure
    if (a === null || a === undefined) a = '0';
    if (b === null || b === undefined) b = '0';
    const aNum = typeof a === 'string' && /^\d+$/.test(a) ? parseInt(a, 10) : a;
    const bNum = typeof b === 'string' && /^\d+$/.test(b) ? parseInt(b, 10) : b;
    if (typeof aNum === 'number' && typeof bNum === 'number') {
      return aNum === bNum;
    }
    return a === b;
  });
}

module.exports = {
  getInfraDirName,
  getInfraProjectName,
  checkDockerAvailability,
  ensureAdminSecrets,
  generatePgAdminConfig,
  prepareInfraDirectory,
  registerHandlebarsHelper
};
