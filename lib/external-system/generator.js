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
const yaml = require('js-yaml');
const chalk = require('chalk');
const logger = require('../utils/logger');

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

    const context = {
      systemKey: systemKey,
      systemDisplayName: config.systemDisplayName || systemKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      systemDescription: config.systemDescription || `External system integration for ${systemKey}`,
      systemType: config.systemType || 'openapi',
      authType: config.authType || 'apikey',
      roles: config.roles || null,
      permissions: config.permissions || null
    };

    const rendered = template(context);

    // Generate in same folder as variables.yaml (new structure)
    // Use naming: <app-name>-deploy.json
    const outputPath = path.join(appPath, `${systemKey}-deploy.json`);
    await fs.writeFile(outputPath, rendered, 'utf8');

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

    const context = {
      datasourceKey: datasourceKey,
      datasourceDisplayName: config.datasourceDisplayName || datasourceKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      datasourceDescription: config.datasourceDescription || `External datasource for ${datasourceKey}`,
      systemKey: config.systemKey,
      entityKey: config.entityKey || datasourceKey.split('-').pop(),
      resourceType: config.resourceType || 'document',
      systemType: config.systemType || 'openapi'
    };

    const rendered = template(context);

    // Generate in same folder as variables.yaml (new structure)
    // Use naming: <app-name>-deploy-<datasource-key>.json
    const outputPath = path.join(appPath, `${datasourceKey}-deploy.json`);
    await fs.writeFile(outputPath, rendered, 'utf8');

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
      const entityKey = `entity${i + 1}`;
      // For datasource key, use just the entity key (will be prefixed with app-name-deploy-)
      const datasourceKey = entityKey;
      const resourceType = resourceTypes[i % resourceTypes.length];

      const datasourceConfig = {
        systemKey: systemKey,
        entityKey: entityKey,
        resourceType: resourceType,
        systemType: config.systemType || 'openapi',
        datasourceDisplayName: `${config.systemDisplayName || systemKey} ${entityKey}`,
        datasourceDescription: `External datasource for ${entityKey} entity`
      };

      // Generate with full naming: <app-name>-deploy-<entity-key>.json
      const datasourcePath = await generateExternalDataSourceTemplate(appPath, `${systemKey}-deploy-${datasourceKey}`, datasourceConfig);
      datasourcePaths.push(datasourcePath);
      logger.log(chalk.green(`✓ Generated datasource: ${path.basename(datasourcePath)}`));
    }

    // Update variables.yaml with externalIntegration block
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
 * Updates variables.yaml with externalIntegration block
 * @async
 * @function updateVariablesYamlWithExternalIntegration
 * @param {string} appPath - Application directory path
 * @param {string} systemKey - System key
 * @param {Array<string>} datasourcePaths - Array of datasource file paths
 * @throws {Error} If update fails
 */
async function updateVariablesYamlWithExternalIntegration(appPath, systemKey, datasourcePaths) {
  try {
    const variablesPath = path.join(appPath, 'variables.yaml');
    const variablesContent = await fs.readFile(variablesPath, 'utf8');
    const variables = yaml.load(variablesContent);

    // Add externalIntegration block
    // Files are in same folder, so schemaBasePath is './'
    variables.externalIntegration = {
      schemaBasePath: './',
      systems: [`${systemKey}-deploy.json`],
      dataSources: datasourcePaths.map(p => path.basename(p)),
      autopublish: true,
      version: '1.0.0'
    };

    await fs.writeFile(variablesPath, yaml.dump(variables, { indent: 2, lineWidth: 120, noRefs: true }), 'utf8');
  } catch (error) {
    throw new Error(`Failed to update variables.yaml: ${error.message}`);
  }
}

module.exports = {
  generateExternalSystemTemplate,
  generateExternalDataSourceTemplate,
  generateExternalSystemFiles
};

