/**
 * External System Generator Functions
 *
 * Functions for generating deployment JSON for external system applications.
 *
 * @fileoverview External system generator functions for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { detectAppType, getDeployJsonPath } = require('../utils/paths');
const { loadVariables, loadRbac } = require('./helpers');

/**
 * Generates external system <app-name>-deploy.json by loading the system JSON file
 * For external systems, the system JSON file is already created and we just need to reference it
 * @async
 * @function generateExternalSystemDeployJson
 * @param {string} appName - Name of the application
 * @param {string} appPath - Path to application directory (integration or builder)
 * @returns {Promise<string>} Path to generated <app-name>-deploy.json file
 * @throws {Error} If generation fails
 */
/**
 * Resolves system file path from variables
 * @function resolveSystemFilePath
 * @param {Object} variables - Variables configuration
 * @param {string} appPath - Application path
 * @param {string} appName - Application name
 * @returns {string} System file path
 * @throws {Error} If file not found
 */
function resolveSystemFilePath(variables, appPath, appName) {
  const systemFileName = variables.externalIntegration.systems && variables.externalIntegration.systems.length > 0
    ? variables.externalIntegration.systems[0]
    : `${appName}-deploy.json`;

  const schemaBasePath = variables.externalIntegration.schemaBasePath || './';
  const systemFilePath = path.isAbsolute(schemaBasePath)
    ? path.join(schemaBasePath, systemFileName)
    : path.join(appPath, schemaBasePath, systemFileName);

  if (!fs.existsSync(systemFilePath)) {
    throw new Error(`External system file not found: ${systemFilePath}. Please create it first.`);
  }

  return systemFilePath;
}

/**
 * Merges RBAC into system JSON
 * @function mergeRbacIntoSystemJson
 * @param {Object} systemJson - System JSON object
 * @param {Object|null} rbac - RBAC configuration
 */
function mergeRbacIntoSystemJson(systemJson, rbac) {
  if (!rbac) {
    return;
  }

  // Priority: roles/permissions in system JSON > rbac.yaml (if both exist, prefer JSON)
  if (rbac.roles && (!systemJson.roles || systemJson.roles.length === 0)) {
    systemJson.roles = rbac.roles;
  }
  if (rbac.permissions && (!systemJson.permissions || systemJson.permissions.length === 0)) {
    systemJson.permissions = rbac.permissions;
  }
}

/**
 * Loads and parses system file
 * @async
 * @function loadSystemFileContent
 * @param {string} systemFilePath - System file path
 * @returns {Promise<Object>} Parsed system JSON
 */
async function loadSystemFileContent(systemFilePath) {
  const systemContent = await fs.promises.readFile(systemFilePath, 'utf8');
  return JSON.parse(systemContent);
}

async function generateExternalSystemDeployJson(appName, appPath) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const variablesPath = path.join(appPath, 'variables.yaml');
  const { parsed: variables } = loadVariables(variablesPath);

  if (!variables.externalIntegration) {
    throw new Error('externalIntegration block not found in variables.yaml');
  }

  const systemFilePath = resolveSystemFilePath(variables, appPath, appName);
  const systemJson = await loadSystemFileContent(systemFilePath);

  // Load rbac.yaml from app directory (similar to regular apps)
  const rbacPath = path.join(appPath, 'rbac.yaml');
  const rbac = loadRbac(rbacPath);
  mergeRbacIntoSystemJson(systemJson, rbac);

  // Write it as <app-name>-deploy.json (consistent naming)
  const deployJsonPath = getDeployJsonPath(appName, 'external', true);
  const jsonContent = JSON.stringify(systemJson, null, 2);
  await fs.promises.writeFile(deployJsonPath, jsonContent, { mode: 0o644, encoding: 'utf8' });

  return deployJsonPath;
}

/**
 * Load system file and merge RBAC
 * @async
 * @param {string} appPath - Application path
 * @param {string} schemaBasePath - Schema base path
 * @param {string} systemFileName - System file name
 * @returns {Promise<Object>} System JSON object
 * @throws {Error} If file cannot be loaded
 */
async function loadSystemFile(appPath, schemaBasePath, systemFileName) {
  const systemFilePath = path.isAbsolute(schemaBasePath)
    ? path.join(schemaBasePath, systemFileName)
    : path.join(appPath, schemaBasePath, systemFileName);

  if (!fs.existsSync(systemFilePath)) {
    throw new Error(`System file not found: ${systemFilePath}`);
  }

  const systemContent = await fs.promises.readFile(systemFilePath, 'utf8');
  const systemJson = JSON.parse(systemContent);

  // Load rbac.yaml from app directory and merge if present
  const rbacPath = path.join(appPath, 'rbac.yaml');
  const rbac = loadRbac(rbacPath);
  if (rbac) {
    if (rbac.roles && (!systemJson.roles || systemJson.roles.length === 0)) {
      systemJson.roles = rbac.roles;
    }
    if (rbac.permissions && (!systemJson.permissions || systemJson.permissions.length === 0)) {
      systemJson.permissions = rbac.permissions;
    }
  }

  return systemJson;
}

/**
 * Load datasource files
 * @async
 * @param {string} appPath - Application path
 * @param {string} schemaBasePath - Schema base path
 * @param {Array<string>} datasourceFiles - Array of datasource file names
 * @returns {Promise<Array<Object>>} Array of datasource JSON objects
 * @throws {Error} If files cannot be loaded
 */
async function loadDatasourceFiles(appPath, schemaBasePath, datasourceFiles) {
  const datasourceJsons = [];

  for (const datasourceFile of datasourceFiles) {
    const datasourcePath = path.isAbsolute(schemaBasePath)
      ? path.join(schemaBasePath, datasourceFile)
      : path.join(appPath, schemaBasePath, datasourceFile);

    if (!fs.existsSync(datasourcePath)) {
      throw new Error(`Datasource file not found: ${datasourcePath}`);
    }

    const datasourceContent = await fs.promises.readFile(datasourcePath, 'utf8');
    const datasourceJson = JSON.parse(datasourceContent);
    datasourceJsons.push(datasourceJson);
  }

  return datasourceJsons;
}

/**
 * Build base application schema structure
 * @param {Object} systemJson - System JSON object
 * @param {Array<Object>} datasourceJsons - Array of datasource JSON objects
 * @param {string} version - Schema version
 * @returns {Object} Application schema object
 */
function buildBaseSchema(systemJson, datasourceJsons, version) {
  return {
    version: version || '1.0.0',
    application: systemJson,
    dataSources: datasourceJsons
  };
}

/**
 * Filter validation errors to handle schema inconsistencies
 * @param {Array} errors - Validation errors
 * @param {Object} schema - Schema object
 * @returns {Array} Filtered errors
 */
function filterValidationErrors(errors, schema) {
  return errors.filter(err => {
    if (err.keyword === 'additionalProperties' && err.params?.additionalProperty === 'authentication') {
      const required = schema.required || [];
      if (required.includes('authentication')) {
        return false; // Ignore this error since authentication is required but not defined
      }
    }
    return true;
  });
}

/**
 * Format validation errors for display
 * @param {Array} errors - Validation errors
 * @returns {string} Formatted error message
 */
function formatValidationErrors(errors) {
  return errors.map(err => {
    const path = err.instancePath || err.schemaPath;
    return `${path} ${err.message}`;
  }).join(', ');
}

/**
 * Validate system against external-system schema
 * @param {Object} systemJson - System JSON object
 * @param {Object} externalSystemSchema - External system schema
 * @param {Object} ajv - AJV instance
 * @throws {Error} If validation fails
 */
function validateSystemSchema(systemJson, externalSystemSchema, ajv) {
  const externalSystemSchemaId = externalSystemSchema.$id || 'https://raw.githubusercontent.com/esystemsdev/aifabrix-builder/refs/heads/main/lib/schema/external-system.schema.json';
  ajv.addSchema(externalSystemSchema, externalSystemSchemaId);
  const validateSystem = ajv.compile(externalSystemSchema);
  const systemValid = validateSystem(systemJson);

  if (!systemValid) {
    const filteredErrors = filterValidationErrors(validateSystem.errors, externalSystemSchema);
    if (filteredErrors.length > 0) {
      const errors = formatValidationErrors(filteredErrors);
      throw new Error(`System JSON does not match external-system schema: ${errors}`);
    }
  }
}

/**
 * Validate datasources against external-datasource schema
 * @param {Array<Object>} datasourceJsons - Array of datasource JSON objects
 * @param {Object} externalDatasourceSchema - External datasource schema
 * @param {Object} ajv - AJV instance
 * @throws {Error} If validation fails
 */
function validateDatasourceSchemas(datasourceJsons, externalDatasourceSchema, ajv) {
  const externalDatasourceSchemaId = externalDatasourceSchema.$id || 'https://raw.githubusercontent.com/esystemsdev/aifabrix-builder/refs/heads/main/lib/schema/external-datasource.schema.json';
  ajv.addSchema(externalDatasourceSchema, externalDatasourceSchemaId);
  const validateDatasource = ajv.compile(externalDatasourceSchema);

  for (let i = 0; i < datasourceJsons.length; i++) {
    const datasourceValid = validateDatasource(datasourceJsons[i]);
    if (!datasourceValid) {
      const errors = formatValidationErrors(validateDatasource.errors);
      throw new Error(`Datasource ${i + 1} (${datasourceJsons[i].key || 'unknown'}) does not match external-datasource schema: ${errors}`);
    }
  }
}

/**
 * Generates application-schema.json structure for external systems
 * Combines system and datasource JSONs into application-level deployment format
 * @async
 * @function generateExternalSystemApplicationSchema
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Application schema object
 * @throws {Error} If generation fails
 */
/**
 * Loads and validates external integration configuration
 * @async
 * @function loadExternalIntegrationConfig
 * @param {string} appPath - Application path
 * @returns {Promise<Object>} Variables and schema base path
 * @throws {Error} If configuration is invalid
 */
async function loadExternalIntegrationConfig(appPath) {
  const variablesPath = path.join(appPath, 'variables.yaml');
  const { parsed: variables } = loadVariables(variablesPath);

  if (!variables.externalIntegration) {
    throw new Error('externalIntegration block not found in variables.yaml');
  }

  const schemaBasePath = variables.externalIntegration.schemaBasePath || './';
  const systemFiles = variables.externalIntegration.systems || [];

  if (systemFiles.length === 0) {
    throw new Error('No system files specified in externalIntegration.systems');
  }

  return { variables, schemaBasePath, systemFiles };
}

/**
 * Prepares schemas for validation
 * @function prepareSchemasForValidation
 * @returns {Object} Prepared schemas
 */
function prepareSchemasForValidation() {
  const externalSystemSchema = require('../schema/external-system.schema.json');
  const externalDatasourceSchema = require('../schema/external-datasource.schema.json');

  // For draft-2020-12 schemas, remove $schema to avoid AJV issues
  const datasourceSchemaToAdd = { ...externalDatasourceSchema };
  if (datasourceSchemaToAdd.$schema && datasourceSchemaToAdd.$schema.includes('2020-12')) {
    delete datasourceSchemaToAdd.$schema;
  }

  return { externalSystemSchema, datasourceSchemaToAdd };
}

/**
 * Validates application schema components
 * @function validateApplicationSchemaComponents
 * @param {Object} systemJson - System JSON
 * @param {Object[]} datasourceJsons - Array of datasource JSONs
 * @param {Object} externalSystemSchema - External system schema
 * @param {Object} datasourceSchemaToAdd - Datasource schema
 */
function validateApplicationSchemaComponents(systemJson, datasourceJsons, externalSystemSchema, datasourceSchemaToAdd) {
  const ajv = new Ajv({ allErrors: true, strict: false, removeAdditional: false });

  // Validate system against external-system schema
  validateSystemSchema(systemJson, externalSystemSchema, ajv);

  // Validate datasources against external-datasource schema
  validateDatasourceSchemas(datasourceJsons, datasourceSchemaToAdd, ajv);
}

async function generateExternalSystemApplicationSchema(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const { appPath } = await detectAppType(appName);
  const { variables, schemaBasePath, systemFiles } = await loadExternalIntegrationConfig(appPath);

  const systemJson = await loadSystemFile(appPath, schemaBasePath, systemFiles[0]);

  // Load datasource files
  const datasourceFiles = variables.externalIntegration.dataSources || [];
  const datasourceJsons = await loadDatasourceFiles(appPath, schemaBasePath, datasourceFiles);

  // Build application-schema.json structure
  const applicationSchema = buildBaseSchema(systemJson, datasourceJsons, variables.externalIntegration.version);

  // Validate individual components against their schemas
  const { externalSystemSchema, datasourceSchemaToAdd } = prepareSchemasForValidation();
  validateApplicationSchemaComponents(systemJson, datasourceJsons, externalSystemSchema, datasourceSchemaToAdd);

  return applicationSchema;
}

module.exports = {
  generateExternalSystemDeployJson,
  generateExternalSystemApplicationSchema
};

