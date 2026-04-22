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

const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const logger = require('../utils/logger');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');
const { getKvPathSegmentForSecurityKey } = require('../utils/credential-secrets-env');

// Register Handlebars helper for equality check
handlebars.registerHelper('eq', (a, b) => a === b);
handlebars.registerHelper('json', (obj) => JSON.stringify(obj));

/**
 * Build authentication object per schema authenticationVariablesByMethod.
 * Security values use canonical kv://<systemKey>/<segment> paths (segment from getKvPathSegmentForSecurityKey).
 * @param {string} systemKey - External system key
 * @param {string} authType - Auth method (oauth2, aad, apikey, basic, queryParam, oidc, hmac, none)
 * @returns {{ method: string, variables: Object, security: Object }} Authentication object
 */
function buildAuthenticationFromMethod(systemKey, authType) {
  const kvPath = (securityKey) => {
    const segment = getKvPathSegmentForSecurityKey(securityKey);
    return segment ? `kv://${systemKey}/${segment}` : null;
  };
  const method = authType || 'apikey';
  const base = 'https://api.example.com';

  const authMap = {
    oauth2: {
      variables: { baseUrl: base, tokenUrl: `${base}/oauth/token`, authorizationUrl: `${base}/oauth/authorize` },
      security: { clientId: kvPath('clientId'), clientSecret: kvPath('clientSecret') }
    },
    aad: {
      variables: { baseUrl: base, tokenUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token', tenantId: '{tenant-id}' },
      security: { clientId: kvPath('clientId'), clientSecret: kvPath('clientSecret') }
    },
    apikey: {
      variables: { baseUrl: base, headerName: 'X-API-Key' },
      security: { apiKey: kvPath('apiKey') }
    },
    basic: {
      variables: { baseUrl: base },
      security: { username: kvPath('username'), password: kvPath('password') }
    },
    queryParam: {
      variables: { baseUrl: base, paramName: 'api_key' },
      security: { paramValue: kvPath('paramValue') }
    },
    oidc: {
      variables: { openIdConfigUrl: 'https://example.com/.well-known/openid-configuration', clientId: 'app-id' },
      security: {}
    },
    hmac: {
      variables: { baseUrl: base, algorithm: 'sha256', signatureHeader: 'X-Signature' },
      security: { signingSecret: kvPath('signingSecret') }
    },
    none: {
      variables: {},
      security: {}
    }
  };

  const auth = authMap[method] || authMap.apikey;
  return { method, variables: auth.variables, security: auth.security };
}

/** Target extension for format */
const FORMAT_EXT = { yaml: '.yaml', json: '.json' };

/**
 * Generates external system file from template
 * @async
 * @function generateExternalSystemTemplate
 * @param {string} appPath - Application directory path
 * @param {string} systemKey - System key
 * @param {Object} config - System configuration
 * @param {string} [format] - Output format: 'yaml' (default) or 'json'
 * @returns {Promise<string>} Path to generated file
 * @throws {Error} If generation fails
 */
async function generateExternalSystemTemplate(appPath, systemKey, config, format = 'yaml') {
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

    const ext = FORMAT_EXT[format === 'json' ? 'json' : 'yaml'] || '.yaml';
    const outputPath = path.join(appPath, `${systemKey}-system${ext}`);
    writeConfigFile(outputPath, parsed, format === 'json' ? 'json' : 'yaml');

    return outputPath;
  } catch (error) {
    throw new Error(`Failed to generate external system template: ${error.message}`);
  }
}

/** Schema-valid entityType values (external-datasource.schema.json) */
const SCHEMA_ENTITY_TYPES = ['recordStorage', 'documentStorage', 'vectorStore', 'messageService', 'none'];

/** Maps resourceType to schema entityType for generation */
function resourceTypeToSchemaEntityType(resourceType) {
  return resourceType === 'document' ? 'documentStorage' : 'recordStorage';
}

/**
 * Build { dimKey, field } entries for root dimensions (v2.4+ dimensionBinding).
 * @param {Object} dimensions - Map of dimension key → attribute path (e.g. metadata.country)
 * @returns {Array<{ dimKey: string, field: string }>}
 */
function buildDimensionBindingEntries(dimensions) {
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) return [];
  return Object.entries(dimensions).map(([dimKey, path]) => {
    const field = typeof path === 'string' && path.startsWith('metadata.')
      ? path.slice('metadata.'.length).trim()
      : dimKey;
    return { dimKey, field };
  });
}

/**
 * @param {string} schemaEntityType - Resolved schema entityType
 * @returns {boolean}
 */
function isStorageEntityType(schemaEntityType) {
  return schemaEntityType === 'recordStorage' || schemaEntityType === 'documentStorage';
}

/**
 * Puts externalId first for storage entity types when present (schema v2.4 join identity).
 * @param {string[]} keys - Attribute / metadata property names
 * @param {string} schemaEntityType - Resolved schema entityType
 * @returns {string[]}
 */
function orderMetadataAttributeKeys(keys, schemaEntityType) {
  const out = [...keys];
  if (isStorageEntityType(schemaEntityType) && out.includes('externalId')) {
    return ['externalId', ...out.filter(k => k !== 'externalId')];
  }
  return out;
}

/**
 * Default fieldMappings.attributes + metadata key order when the wizard/config omits attributes.
 * @param {string} schemaEntityType - Resolved schema entityType
 * @returns {{ merged: Object, keys: string[] }}
 */
function defaultAttributesForEntityType(schemaEntityType) {
  if (isStorageEntityType(schemaEntityType)) {
    return {
      merged: {
        externalId: { expression: '{{raw.id}}' },
        id: { expression: '{{raw.id}}' },
        name: { expression: '{{raw.name}}' }
      },
      keys: ['externalId', 'id', 'name']
    };
  }
  return {
    merged: {
      id: { expression: '{{raw.id}}' },
      name: { expression: '{{raw.name}}' }
    },
    keys: ['id', 'name']
  };
}

/**
 * Build datasource context object for template rendering
 * @param {Object} opts - Options
 * @param {Object} opts.config - Datasource configuration
 * @param {string} opts.datasourceKey - Datasource key
 * @param {Object} opts.dimensions - Dimensions map
 * @param {Object} opts.attributes - Attributes map
 * @param {string} opts.fullDatasourceKey - Full key including system
 * @param {string} opts.entityKey - Entity key portion
 * @param {string} opts.schemaEntityType - Schema entity type
 * @param {string} opts.resourceType - Resource type
 * @returns {Object} Handlebars context
 */
function buildDatasourceContext({ config, datasourceKey, dimensions, attributes, fullDatasourceKey, entityKey, schemaEntityType, resourceType }) {
  const displayName = config.datasourceDisplayName || datasourceKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const description = config.datasourceDescription || `External datasource for ${datasourceKey}`;
  const attrsIn = attributes && typeof attributes === 'object' && !Array.isArray(attributes) ? attributes : {};
  let mergedAttributes = { ...attrsIn };

  let attributeKeysForMetadata;
  if (Object.keys(mergedAttributes).length > 0) {
    attributeKeysForMetadata = orderMetadataAttributeKeys(Object.keys(mergedAttributes), schemaEntityType);
  } else {
    const defaults = defaultAttributesForEntityType(schemaEntityType);
    mergedAttributes = defaults.merged;
    attributeKeysForMetadata = defaults.keys;
  }

  if (isStorageEntityType(schemaEntityType) && !mergedAttributes.externalId) {
    mergedAttributes.externalId = { expression: '{{raw.id}}' };
    attributeKeysForMetadata = orderMetadataAttributeKeys(Object.keys(mergedAttributes), schemaEntityType);
  }

  const primaryKey = Array.isArray(config.primaryKey) && config.primaryKey.length > 0
    ? config.primaryKey
    : (attributeKeysForMetadata.includes('id') ? ['id'] : [attributeKeysForMetadata[0]]);
  const labelKey = Array.isArray(config.labelKey) && config.labelKey.length > 0
    ? config.labelKey
    : attributeKeysForMetadata;
  const dimensionBindingEntries = buildDimensionBindingEntries(dimensions);

  return {
    fullDatasourceKey,
    entityKey,
    datasourceDisplayName: displayName,
    datasourceDescription: description,
    systemKey: config.systemKey,
    schemaEntityType,
    resourceType,
    primaryKey,
    labelKey,
    attributeKeysForMetadata,
    dimensionBindingEntries,
    systemType: config.systemType || 'openapi',
    attributes: mergedAttributes,
    raw: { id: '{{raw.id}}', name: '{{raw.name}}' }
  };
}

/**
 * Write datasource output in requested format
 * @param {string} outputPath - Output file path
 * @param {string} rendered - Rendered template content
 * @param {string} format - 'yaml' or 'json'
 * @returns {Promise<void>}
 */
async function writeDatasourceOutput(outputPath, rendered, format) {
  if (format === 'json') {
    const yaml = require('js-yaml');
    const parsed = yaml.load(rendered);
    writeConfigFile(outputPath, parsed, 'json');
  } else {
    await fs.writeFile(outputPath, rendered, 'utf8');
  }
}

/**
 * Generates external datasource file from template with entityType-driven optional commented sections
 * @async
 * @function generateExternalDataSourceTemplate
 * @param {string} appPath - Application directory path
 * @param {string} datasourceKey - Datasource key (e.g. entity1, company)
 * @param {Object} config - Datasource configuration
 * @param {string} [format] - Output format: 'yaml' (default) or 'json'
 * @returns {Promise<string>} Path to generated file
 * @throws {Error} If generation fails
 */
async function generateExternalDataSourceTemplate(appPath, datasourceKey, config, format = 'yaml') {
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

    const prefix = `${config.systemKey}-`;
    const fullDatasourceKey = datasourceKey.startsWith(prefix) ? datasourceKey : `${prefix}${datasourceKey}`;
    const entityKey = (datasourceKey.includes('-') && datasourceKey.startsWith(prefix))
      ? datasourceKey.substring(config.systemKey.length + 1)
      : datasourceKey;

    const context = buildDatasourceContext({
      config, datasourceKey, dimensions, attributes, fullDatasourceKey, entityKey, schemaEntityType, resourceType
    });
    const rendered = template(context);
    const ext = FORMAT_EXT[format === 'json' ? 'json' : 'yaml'] || '.yaml';
    const outputPath = path.join(appPath, `${config.systemKey}-datasource-${entityKey}${ext}`);

    await writeDatasourceOutput(outputPath, rendered, format);
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
 * @param {string} [format] - Output format: 'yaml' (default) or 'json'
 * @returns {Promise<Object>} Object with system and datasource file paths
 * @throws {Error} If generation fails
 */
async function generateExternalSystemFiles(appPath, appName, config, format = 'yaml') {
  try {
    const systemKey = config.systemKey || appName;
    const datasourceCount = config.datasourceCount || 1;
    const fmt = (format === 'json' ? 'json' : 'yaml');

    // Generate external system file
    const systemPath = await generateExternalSystemTemplate(appPath, systemKey, config, fmt);
    logger.log(formatSuccessLine(`Generated external system: ${path.basename(systemPath)}`));

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

      const datasourcePath = await generateExternalDataSourceTemplate(appPath, datasourceKey, datasourceConfig, fmt);
      datasourcePaths.push(datasourcePath);
      logger.log(formatSuccessLine(`Generated datasource: ${path.basename(datasourcePath)}`));
    }

    // Update application config with externalIntegration block
    await updateVariablesYamlWithExternalIntegration(appPath, systemKey, datasourcePaths, fmt);

    return {
      systemPath,
      datasourcePaths
    };
  } catch (error) {
    throw new Error(`Failed to generate external system files: ${error.message}`);
  }
}

/**
 * Resolve application config path and load variables
 * @param {string} appPath - Application directory path
 * @param {string} ext - Config file extension
 * @returns {{ configPath: string, variables: Object }}
 */
function resolveConfigAndVariables(appPath, ext) {
  try {
    const configPath = resolveApplicationConfigPath(appPath);
    const variables = loadConfigFile(configPath) || {};
    return { configPath, variables };
  } catch (resolveErr) {
    const msg = (resolveErr && resolveErr.message) || '';
    const isNotFound = msg.includes('Config file not found') || msg.includes('Application config not found');
    if (!isNotFound) throw resolveErr;
    return { configPath: path.join(appPath, `application${ext}`), variables: {} };
  }
}

/**
 * Remove old config file if it differs from target path
 * @param {string} configPath - Current config path
 * @param {string} targetPath - Target output path
 */
function maybeRemoveOldConfig(configPath, targetPath) {
  const same = configPath === targetPath || path.normalize(configPath) === path.normalize(targetPath);
  if (same) return;
  const fsSync = require('fs');
  if (fsSync.existsSync(configPath)) fsSync.unlinkSync(configPath);
}

/**
 * Updates application config with externalIntegration block
 * @async
 * @function updateVariablesYamlWithExternalIntegration
 * @param {string} appPath - Application directory path
 * @param {string} systemKey - System key
 * @param {Array<string>} datasourcePaths - Array of datasource file paths
 * @param {string} [format] - Output format: 'yaml' (default) or 'json'
 * @throws {Error} If update fails
 */
async function updateVariablesYamlWithExternalIntegration(appPath, systemKey, datasourcePaths, format = 'yaml') {
  try {
    const fmt = format === 'json' ? 'json' : 'yaml';
    const ext = FORMAT_EXT[fmt] || '.yaml';
    const { configPath, variables } = resolveConfigAndVariables(appPath, ext);

    variables.externalIntegration = {
      schemaBasePath: './',
      systems: [`${systemKey}-system${ext}`],
      dataSources: datasourcePaths.map(p => path.basename(p)),
      autopublish: true,
      version: '1.0.0'
    };

    const targetPath = path.join(appPath, `application${ext}`);
    writeConfigFile(targetPath, variables, fmt);
    maybeRemoveOldConfig(configPath, targetPath);
  } catch (error) {
    throw new Error(`Failed to update application config: ${error.message}`);
  }
}

module.exports = {
  buildAuthenticationFromMethod,
  generateExternalSystemTemplate,
  generateExternalDataSourceTemplate,
  generateExternalSystemFiles
};

