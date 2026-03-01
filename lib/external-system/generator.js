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
handlebars.registerHelper('json', (obj) => JSON.stringify(obj));

/**
 * Build authentication object per schema authenticationVariablesByMethod.
 * Security values use kv://<systemKey>/<key> pattern.
 * @param {string} systemKey - External system key
 * @param {string} authType - Auth method (oauth2, aad, apikey, basic, queryParam, oidc, hmac, none)
 * @returns {{ method: string, variables: Object, security: Object }} Authentication object
 */
function buildAuthenticationFromMethod(systemKey, authType) {
  const kv = (key) => `kv://${systemKey}/${key}`;
  const method = authType || 'apikey';
  const base = 'https://api.example.com';

  const authMap = {
    oauth2: {
      variables: { baseUrl: base, tokenUrl: `${base}/oauth/token`, authorizationUrl: `${base}/oauth/authorize` },
      security: { clientId: kv('client-id'), clientSecret: kv('client-secret') }
    },
    aad: {
      variables: { baseUrl: base, tokenUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token', tenantId: '{tenant-id}' },
      security: { clientId: kv('client-id'), clientSecret: kv('client-secret') }
    },
    apikey: {
      variables: { baseUrl: base, headerName: 'X-API-Key' },
      security: { apiKey: kv('api-key') }
    },
    basic: {
      variables: { baseUrl: base },
      security: { username: kv('username'), password: kv('password') }
    },
    queryParam: {
      variables: { baseUrl: base, paramName: 'api_key' },
      security: { paramValue: kv('param-value') }
    },
    oidc: {
      variables: { openIdConfigUrl: 'https://example.com/.well-known/openid-configuration', clientId: 'app-id' },
      security: {}
    },
    hmac: {
      variables: { baseUrl: base, algorithm: 'sha256', signatureHeader: 'X-Signature' },
      security: { signingSecret: kv('signing-secret') }
    },
    none: {
      variables: {},
      security: {}
    }
  };

  const auth = authMap[method] || authMap.apikey;
  return { method, variables: auth.variables, security: auth.security };
}

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

    const authType = config.authType || 'apikey';
    const authentication = buildAuthenticationFromMethod(systemKey, authType);

    const context = {
      systemKey: systemKey,
      systemDisplayName: config.systemDisplayName || systemKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      systemDescription: config.systemDescription || `External system integration for ${systemKey}`,
      systemType: config.systemType || 'openapi',
      authentication,
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

/** Schema-valid entityType values (external-datasource.schema.json) */
const SCHEMA_ENTITY_TYPES = ['recordStorage', 'documentStorage', 'vectorStore', 'messageService', 'none'];

/** Maps resourceType to schema entityType for generation */
function resourceTypeToSchemaEntityType(resourceType) {
  if (resourceType === 'document') return 'documentStorage';
  return 'recordStorage';
}

/**
 * Generates external datasource YAML file from template with entityType-driven optional commented sections
 * @async
 * @function generateExternalDataSourceTemplate
 * @param {string} appPath - Application directory path
 * @param {string} datasourceKey - Datasource key (e.g. entity1, company)
 * @param {Object} config - Datasource configuration
 * @returns {Promise<string>} Path to generated file
 * @throws {Error} If generation fails
 */
async function generateExternalDataSourceTemplate(appPath, datasourceKey, config) {
  try {
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'external-system', 'external-datasource.yaml.hbs');
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);

    const dimensions = config.dimensions || {};
    const attributes = config.attributes || {};
    const resourceType = config.resourceType || 'document';
    const schemaEntityType = SCHEMA_ENTITY_TYPES.includes(config.entityType)
      ? config.entityType
      : resourceTypeToSchemaEntityType(resourceType);

    const fullDatasourceKey = datasourceKey.startsWith(`${config.systemKey}-`)
      ? datasourceKey
      : `${config.systemKey}-${datasourceKey}`;
    const entityKey = datasourceKey.includes('-') && datasourceKey.startsWith(`${config.systemKey}-`)
      ? datasourceKey.substring(config.systemKey.length + 1)
      : datasourceKey;

    const context = {
      fullDatasourceKey,
      entityKey,
      datasourceDisplayName: config.datasourceDisplayName || datasourceKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      datasourceDescription: config.datasourceDescription || `External datasource for ${datasourceKey}`,
      systemKey: config.systemKey,
      schemaEntityType,
      resourceType,
      systemType: config.systemType || 'openapi',
      dimensions: Object.keys(dimensions).length > 0 ? dimensions : null,
      attributes: Object.keys(attributes).length > 0 ? attributes : null,
      raw: { id: '{{raw.id}}', name: '{{raw.name}}' }
    };

    const rendered = template(context);

    const outputPath = path.join(appPath, `${config.systemKey}-datasource-${entityKey}.yaml`);
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

    const schemaEntityType = SCHEMA_ENTITY_TYPES.includes(config.entityType)
      ? config.entityType
      : 'recordStorage';

    for (let i = 0; i < datasourceCount; i++) {
      const entityKey = `entity${i + 1}`;
      const datasourceKey = entityKey;
      const resourceType = resourceTypes[i % resourceTypes.length];

      const datasourceConfig = {
        systemKey: systemKey,
        entityType: schemaEntityType,
        resourceType: resourceType,
        systemType: config.systemType || 'openapi',
        datasourceDisplayName: `${config.systemDisplayName || systemKey} ${entityKey}`,
        datasourceDescription: `External datasource for ${entityKey} entity`,
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

