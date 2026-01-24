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
const { generateExternalReadmeContent } = require('../utils/external-readme');

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
 * @private
 */
function _loadReadmeTemplate() {
  // Use getProjectRoot to reliably find templates in all environments
  const { getProjectRoot } = require('../utils/paths');
  const projectRoot = getProjectRoot();
  const templatePath = path.join(projectRoot, 'templates', 'applications', 'README.md.hbs');

  if (!fsSync.existsSync(templatePath)) {
    // Provide helpful error message with actual paths checked
    const errorMessage = `README template not found at ${templatePath}\n` +
      `  Project root: ${projectRoot}\n` +
      `  Templates directory: ${path.join(projectRoot, 'templates', 'applications')}\n` +
      `  Global PROJECT_ROOT: ${typeof global !== 'undefined' && global.PROJECT_ROOT ? global.PROJECT_ROOT : 'not set'}`;
    throw new Error(errorMessage);
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
/**
 * Extracts service flags from config
 * @function extractServiceFlags
 * @param {Object} config - Application configuration
 * @returns {Object} Service flags object
 */
function extractServiceFlags(config) {
  return {
    hasDatabase: config.database || config.requires?.database || false,
    hasRedis: config.redis || config.requires?.redis || false,
    hasStorage: config.storage || config.requires?.storage || false,
    hasAuthentication: config.authentication || false
  };
}

/**
 * Builds placeholder datasources for external README generation
 * @function buildExternalDatasourcePlaceholders
 * @param {number} datasourceCount - Datasource count
 * @returns {Array<Object>} Datasource placeholders
 */
function buildExternalDatasourcePlaceholders(systemKey, datasourceCount) {
  const normalizedCount = Number.isInteger(datasourceCount)
    ? datasourceCount
    : parseInt(datasourceCount, 10);
  const total = Number.isFinite(normalizedCount) && normalizedCount > 0 ? normalizedCount : 0;
  return Array.from({ length: total }, (_value, index) => {
    const entityType = `entity${index + 1}`;
    return {
      entityType,
      displayName: `Datasource ${index + 1}`,
      fileName: `${systemKey}-datasource-${entityType}.json`
    };
  });
}

/**
 * Builds template context for README generation
 * @function buildReadmeContext
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration
 * @returns {Object} Template context
 */
function buildReadmeContext(appName, config) {
  const displayName = formatAppDisplayName(appName);
  const port = config.port ?? 3000;
  const localPort = (typeof config.build?.localPort === 'number' && config.build.localPort > 0)
    ? config.build.localPort
    : port;
  const imageName = config.image?.name || `aifabrix/${appName}`;
  // Extract registry from nested structure (config.image.registry) or flattened (config.registry)
  const registry = config.image?.registry || config.registry || 'myacr.azurecr.io';

  const serviceFlags = extractServiceFlags(config);
  const hasAnyService = serviceFlags.hasDatabase || serviceFlags.hasRedis || serviceFlags.hasStorage || serviceFlags.hasAuthentication;

  return {
    appName,
    displayName,
    imageName,
    port,
    localPort,
    registry,
    ...serviceFlags,
    hasAnyService
  };
}

function generateReadmeMd(appName, config) {
  if (config.type === 'external') {
    const systemKey = config.systemKey || appName;
    const datasources = buildExternalDatasourcePlaceholders(systemKey, config.datasourceCount);
    return generateExternalReadmeContent({
      appName,
      systemKey,
      systemType: config.systemType,
      displayName: config.systemDisplayName,
      description: config.systemDescription,
      datasources
    });
  }
  const context = buildReadmeContext(appName, config);
  return _loadReadmeTemplate()(context);
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
  // Ensure directory exists
  await fs.mkdir(appPath, { recursive: true });
  const readmePath = path.join(appPath, 'README.md');
  if (!(await fileExists(readmePath))) {
    const readmeContent = generateReadmeMd(appName, config);
    await fs.writeFile(readmePath, readmeContent, 'utf8');
  }
}

module.exports = {
  generateReadmeMdFile,
  generateReadmeMd,
  formatAppDisplayName
};

