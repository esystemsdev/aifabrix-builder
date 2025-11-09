/**
 * Application README.md Generation
 *
 * Generates README.md files for applications based on configuration
 *
 * @fileoverview README.md generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const handlebars = require('handlebars');

/**
 * Checks if a file exists
 * @async
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats application name for display (capitalize first letter of each word)
 * @param {string} appName - Application name
 * @returns {string} Formatted display name
 */
function formatAppDisplayName(appName) {
  return appName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Loads and compiles README.md template
 * @returns {Function} Compiled Handlebars template
 * @throws {Error} If template not found
 */
function loadReadmeTemplate() {
  const templatePath = path.join(__dirname, '..', 'templates', 'applications', 'README.md.hbs');
  if (!fsSync.existsSync(templatePath)) {
    throw new Error(`README template not found at ${templatePath}`);
  }

  const templateContent = fsSync.readFileSync(templatePath, 'utf8');
  return handlebars.compile(templateContent);
}

/**
 * Generates README.md content for an application using Handlebars template
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @returns {string} README.md content
 */
function generateReadmeMd(appName, config) {
  const template = loadReadmeTemplate();
  const displayName = formatAppDisplayName(appName);
  const imageName = `aifabrix/${appName}`;
  const port = config.port || 3000;
  // Extract registry from nested structure (config.image.registry) or flattened (config.registry)
  const registry = config.image?.registry || config.registry || 'myacr.azurecr.io';

  const hasDatabase = config.database || config.requires?.database || false;
  const hasRedis = config.redis || config.requires?.redis || false;
  const hasStorage = config.storage || config.requires?.storage || false;
  const hasAuthentication = config.authentication || false;
  const hasAnyService = hasDatabase || hasRedis || hasStorage || hasAuthentication;

  const context = {
    appName,
    displayName,
    imageName,
    port,
    registry,
    hasDatabase,
    hasRedis,
    hasStorage,
    hasAuthentication,
    hasAnyService
  };

  return template(context);
}

/**
 * Generates README.md file if it doesn't exist
 * @async
 * @function generateReadmeMdFile
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @returns {Promise<void>} Resolves when README.md is generated or skipped
 * @throws {Error} If file generation fails
 */
async function generateReadmeMdFile(appPath, appName, config) {
  const readmePath = path.join(appPath, 'README.md');
  if (!(await fileExists(readmePath))) {
    const readmeContent = generateReadmeMd(appName, config);
    await fs.writeFile(readmePath, readmeContent);
  }
}

module.exports = {
  generateReadmeMdFile,
  generateReadmeMd,
  formatAppDisplayName
};

