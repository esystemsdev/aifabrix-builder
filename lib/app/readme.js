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
const { resolveApplicationConfigPath } = require('../utils/paths');
const { loadConfigFile } = require('../utils/config-format');
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
      fileName: `${systemKey}-datasource-${entityType}.yaml`
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
  const displayName = config.displayName || formatAppDisplayName(appName);
  const port = config.port ?? 3000;
  const localPort = port;
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
    const datasources = Array.isArray(config.datasources) && config.datasources.length > 0
      ? config.datasources
      : buildExternalDatasourcePlaceholders(systemKey, config.datasourceCount);
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
 * Generates README.md file (optionally only if missing)
 * @async
 * @function generateReadmeMdFile
 * @param {string} appPath - Path to application directory
 * @param {string} appName - Application name
 * @param {Object} config - Application configuration (e.g. from application.yaml/application.json)
 * @param {Object} [options] - Options
 * @param {boolean} [options.force] - If true, overwrite existing README.md (dynamic generation)
 * @returns {Promise<void>} Resolves when README.md is generated or skipped
 * @throws {Error} If file generation fails
 */
async function generateReadmeMdFile(appPath, appName, config, options = {}) {
  await fs.mkdir(appPath, { recursive: true });
  const readmePath = path.join(appPath, 'README.md');
  if (!options.force && (await fileExists(readmePath))) {
    return;
  }
  const readmeContent = generateReadmeMd(appName, config);
  await fs.writeFile(readmePath, readmeContent, 'utf8');
}

/**
 * Loads application config from app path and generates README.md (overwrites if present).
 * Used when copying template apps or running up-miso / up-platform / up-dataplane.
 * @async
 * @function ensureReadmeForAppPath
 * @param {string} appPath - Path to application directory (must contain application config)
 * @param {string} appName - Application name
 * @returns {Promise<void>} Resolves when README.md is written or skipped (no application config)
 */
async function ensureReadmeForAppPath(appPath, appName) {
  let configPath;
  try {
    configPath = resolveApplicationConfigPath(appPath);
  } catch {
    return;
  }
  const config = loadConfigFile(configPath) || {};
  await generateReadmeMdFile(appPath, appName, config, { force: true });
}

/**
 * Generates README.md for an app at builder path(s): primary and cwd/builder if different.
 * Use after ensureAppFromTemplate in up-miso / up-dataplane so README reflects current config.
 * @async
 * @function ensureReadmeForApp
 * @param {string} appName - Application name (e.g. keycloak, miso-controller, dataplane)
 * @returns {Promise<void>}
 */
async function ensureReadmeForApp(appName) {
  const pathsUtil = require('../utils/paths');
  const primaryPath = pathsUtil.getBuilderPath(appName);
  await ensureReadmeForAppPath(primaryPath, appName);
  const cwdBuilderPath = path.join(process.cwd(), 'builder', appName);
  if (path.resolve(cwdBuilderPath) !== path.resolve(primaryPath)) {
    await ensureReadmeForAppPath(cwdBuilderPath, appName);
  }
}

module.exports = {
  generateReadmeMdFile,
  generateReadmeMd,
  formatAppDisplayName,
  ensureReadmeForAppPath,
  ensureReadmeForApp
};

