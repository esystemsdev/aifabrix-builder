/**
 * External System Template Generation Module
 *
 * Generates external system and datasource JSON files from Handlebars templates
 * for external type applications.
 *
 * @fileoverview External system template generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');

// Register Handlebars helper for equality check
handlebars.registerHelper('eq', (a, b) => a === b);

/**
 * Generates external system JSON file from template
 * @async
 * @function generateExternalSystemTemplate
 * @param {string} appPath - Application directory path
 * @param {string} systemKey - System key
 * @param {Object} config - System configuration
 * @returns {Promise<string>} Path to generated file
 * @throws {Error} If generation fails
 */
async function generateExternalSystemTemplate(appPath, systemKey, config) {
  try {
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'external-system', 'external-system.json.hbs');
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);

    const roles = (config.roles || null) && config.roles.map((role) => ({
      ...role,
      groups: role.groups || role.Groups || undefined
    }));

    const context = {
      systemKey: systemKey,
      systemDisplayName: config.systemDisplayName || systemKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      systemDescription: config.systemDescription || `External system integration for ${systemKey}`,
      systemType: config.systemType || 'openapi',
      authType: config.authType || 'apikey',
      baseUrl: config.baseUrl || null,
      roles: roles || null,
      permissions: config.permissions || null
    };

    const rendered = template(context);
    const parsed = JSON.parse(rendered);

    // Generate in same folder as application.yaml (new structure)
    // Use naming: <app-name>-system.yaml
    const outputPath = path.join(appPath, `${systemKey}-system.yaml`);
    writeConfigFile(outputPath, parsed);

    return outputPath;
  } catch (error) {
    throw new Error(`Failed to generate external system template: ${error.message}`);
  }
}

/**
 * Generates external datasource JSON file from template
 * @async
 * @function generateExternalDataSourceTemplate
 * @param {string} appPath - Application directory path
 * @param {string} datasourceKey - Datasource key
 * @param {Object} config - Datasource configuration
 * @returns {Promise<string>} Path to generated file
 * @throws {Error} If generation fails
 */
async function generateExternalDataSourceTemplate(appPath, datasourceKey, config) {
  try {
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'external-system', 'external-datasource.json.hbs');
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);

    const dimensions = config.dimensions || {};
    const attributes = config.attributes || {};
    const context = {
      datasourceKey: datasourceKey,
      datasourceDisplayName: config.datasourceDisplayName || datasourceKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      datasourceDescription: config.datasourceDescription || `External datasource for ${datasourceKey}`,
      systemKey: config.systemKey,
      entityType: config.entityType || datasourceKey.split('-').pop(),
      resourceType: config.resourceType || 'document',
      systemType: config.systemType || 'openapi',
      // Pass non-empty objects so template uses custom block; empty/null so template uses schema-valid defaults
      dimensions: Object.keys(dimensions).length > 0 ? dimensions : null,
      attributes: Object.keys(attributes).length > 0 ? attributes : null,
      // Literal expression strings for default attribute block (schema: pipe-based DSL {{raw.path}})
      raw: { id: '{{raw.id}}', name: '{{raw.name}}' }
    };

    const rendered = template(context);
    const datasourceConfig = JSON.parse(rendered);

    // Generate in same folder as application.yaml (new structure)
    // Use naming: <app-name>-datasource-<datasource-key>.yaml
    // Extract datasource key (remove system key prefix if present)
    const datasourceKeyOnly = datasourceKey.includes('-') && datasourceKey.startsWith(`${config.systemKey}-`)
      ? datasourceKey.substring(config.systemKey.length + 1)
      : datasourceKey;
    const outputPath = path.join(appPath, `${config.systemKey}-datasource-${datasourceKeyOnly}.yaml`);
    writeConfigFile(outputPath, datasourceConfig);

    return outputPath;
  } catch (error) {
    throw new Error(`Failed to generate external datasource template: ${error.message}`);
  }
}

/**
 * Generates all external system files (system + datasources)
 * @async
 * @function generateExternalSystemFiles
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @param {Object} config - Configuration with external system details
 * @returns {Promise<Object>} Object with system and datasource file paths
 * @throws {Error} If generation fails
 */
async function generateExternalSystemFiles(appPath, appName, config) {
  try {
    const systemKey = config.systemKey || appName;
    const datasourceCount = config.datasourceCount || 1;

    // Generate external system JSON
    const systemPath = await generateExternalSystemTemplate(appPath, systemKey, config);
    logger.log(chalk.green(`✓ Generated external system: ${path.basename(systemPath)}`));

    // Generate datasource JSON files
    const datasourcePaths = [];
    const resourceTypes = ['customer', 'contact', 'person', 'document', 'deal'];

    for (let i = 0; i < datasourceCount; i++) {
      const entityType = `entity${i + 1}`;
      // For datasource key, use just the entity type (will be prefixed with app-name-deploy-)
      const datasourceKey = entityType;
      const resourceType = resourceTypes[i % resourceTypes.length];

      const datasourceConfig = {
        systemKey: systemKey,
        entityType: entityType,
        resourceType: resourceType,
        systemType: config.systemType || 'openapi',
        datasourceDisplayName: `${config.systemDisplayName || systemKey} ${entityType}`,
        datasourceDescription: `External datasource for ${entityType} entity`,
        dimensions: config.dimensions || {},
        attributes: config.attributes || {}
      };

      // Generate with new naming: <app-name>-datasource-<entity-key>.json
      const datasourcePath = await generateExternalDataSourceTemplate(appPath, datasourceKey, datasourceConfig);
      datasourcePaths.push(datasourcePath);
      logger.log(chalk.green(`✓ Generated datasource: ${path.basename(datasourcePath)}`));
    }

    // Update application.yaml with externalIntegration block
    await updateVariablesYamlWithExternalIntegration(appPath, systemKey, datasourcePaths);

    return {
      systemPath,
      datasourcePaths
    };
  } catch (error) {
    throw new Error(`Failed to generate external system files: ${error.message}`);
  }
}

/**
 * Updates application.yaml with externalIntegration block
 * @async
 * @function updateVariablesYamlWithExternalIntegration
 * @param {string} appPath - Application directory path
 * @param {string} systemKey - System key
 * @param {Array<string>} datasourcePaths - Array of datasource file paths
 * @throws {Error} If update fails
 */
async function updateVariablesYamlWithExternalIntegration(appPath, systemKey, datasourcePaths) {
  try {
    const configPath = resolveApplicationConfigPath(appPath);
    const variables = loadConfigFile(configPath);

    // Add externalIntegration block
    // Files are in same folder, so schemaBasePath is './'
    variables.externalIntegration = {
      schemaBasePath: './',
      systems: [`${systemKey}-system.yaml`],
      dataSources: datasourcePaths.map(p => path.basename(p)),
      autopublish: true,
      version: '1.0.0'
    };

    writeConfigFile(configPath, variables);
  } catch (error) {
    throw new Error(`Failed to update application config: ${error.message}`);
  }
}

module.exports = {
  generateExternalSystemTemplate,
  generateExternalDataSourceTemplate,
  generateExternalSystemFiles
};

