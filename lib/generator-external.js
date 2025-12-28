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
const { detectAppType, getDeployJsonPath } = require('./utils/paths');
const { loadVariables, loadRbac } = require('./generator-helpers');

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
async function generateExternalSystemDeployJson(appName, appPath) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const variablesPath = path.join(appPath, 'variables.yaml');
  const { parsed: variables } = loadVariables(variablesPath);

  if (!variables.externalIntegration) {
    throw new Error('externalIntegration block not found in variables.yaml');
  }

  // For external systems, the system JSON file should be in the same folder
  // Check if it already exists (should be <app-name>-deploy.json)
  const deployJsonPath = getDeployJsonPath(appName, 'external', true);
  const systemFileName = variables.externalIntegration.systems && variables.externalIntegration.systems.length > 0
    ? variables.externalIntegration.systems[0]
    : `${appName}-deploy.json`;

  // Resolve system file path (schemaBasePath is usually './' for same folder)
  const schemaBasePath = variables.externalIntegration.schemaBasePath || './';
  const systemFilePath = path.isAbsolute(schemaBasePath)
    ? path.join(schemaBasePath, systemFileName)
    : path.join(appPath, schemaBasePath, systemFileName);

  // If system file doesn't exist, throw error (it should be created manually or via external-system-generator)
  if (!fs.existsSync(systemFilePath)) {
    throw new Error(`External system file not found: ${systemFilePath}. Please create it first.`);
  }

  // Read the system JSON file
  const systemContent = await fs.promises.readFile(systemFilePath, 'utf8');
  const systemJson = JSON.parse(systemContent);

  // Load rbac.yaml from app directory (similar to regular apps)
  const rbacPath = path.join(appPath, 'rbac.yaml');
  const rbac = loadRbac(rbacPath);

  // Merge rbac into systemJson if present
  // Priority: roles/permissions in system JSON > rbac.yaml (if both exist, prefer JSON)
  if (rbac) {
    if (rbac.roles && (!systemJson.roles || systemJson.roles.length === 0)) {
      systemJson.roles = rbac.roles;
    }
    if (rbac.permissions && (!systemJson.permissions || systemJson.permissions.length === 0)) {
      systemJson.permissions = rbac.permissions;
    }
  }

  // Write it as <app-name>-deploy.json (consistent naming)
  const jsonContent = JSON.stringify(systemJson, null, 2);
  await fs.promises.writeFile(deployJsonPath, jsonContent, { mode: 0o644, encoding: 'utf8' });

  return deployJsonPath;
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
async function generateExternalSystemApplicationSchema(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const { appPath } = await detectAppType(appName);
  const variablesPath = path.join(appPath, 'variables.yaml');

  // Load variables.yaml
  const { parsed: variables } = loadVariables(variablesPath);

  if (!variables.externalIntegration) {
    throw new Error('externalIntegration block not found in variables.yaml');
  }

  // Load system file
  const schemaBasePath = variables.externalIntegration.schemaBasePath || './';
  const systemFiles = variables.externalIntegration.systems || [];

  if (systemFiles.length === 0) {
    throw new Error('No system files specified in externalIntegration.systems');
  }

  const systemFileName = systemFiles[0];
  const systemFilePath = path.isAbsolute(schemaBasePath)
    ? path.join(schemaBasePath, systemFileName)
    : path.join(appPath, schemaBasePath, systemFileName);

  if (!fs.existsSync(systemFilePath)) {
    throw new Error(`System file not found: ${systemFilePath}`);
  }

  const systemContent = await fs.promises.readFile(systemFilePath, 'utf8');
  const systemJson = JSON.parse(systemContent);

  // Load rbac.yaml from app directory and merge if present
  // Priority: roles/permissions in system JSON > rbac.yaml (if both exist, prefer JSON)
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

  // Load datasource files
  const datasourceFiles = variables.externalIntegration.dataSources || [];
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

  // Build application-schema.json structure
  const applicationSchema = {
    version: variables.externalIntegration.version || '1.0.0',
    application: systemJson,
    dataSources: datasourceJsons
  };

  // Validate individual components against their schemas
  const externalSystemSchema = require('./schema/external-system.schema.json');
  const externalDatasourceSchema = require('./schema/external-datasource.schema.json');

  // For draft-2020-12 schemas, remove $schema to avoid AJV issues (similar to schema-loader.js)
  const datasourceSchemaToAdd = { ...externalDatasourceSchema };
  if (datasourceSchemaToAdd.$schema && datasourceSchemaToAdd.$schema.includes('2020-12')) {
    delete datasourceSchemaToAdd.$schema;
  }

  const ajv = new Ajv({ allErrors: true, strict: false, removeAdditional: false });

  // Validate application (system) against external-system schema
  const externalSystemSchemaId = externalSystemSchema.$id || 'https://raw.githubusercontent.com/esystemsdev/aifabrix-builder/refs/heads/main/lib/schema/external-system.schema.json';
  ajv.addSchema(externalSystemSchema, externalSystemSchemaId);
  const validateSystem = ajv.compile(externalSystemSchema);
  const systemValid = validateSystem(systemJson);

  if (!systemValid) {
    // Filter out additionalProperties errors for required properties that aren't defined in schema
    // This handles schema inconsistencies where authentication is required but not defined in properties
    const filteredErrors = validateSystem.errors.filter(err => {
      if (err.keyword === 'additionalProperties' && err.params?.additionalProperty === 'authentication') {
        // Check if authentication is in required array
        const required = externalSystemSchema.required || [];
        if (required.includes('authentication')) {
          return false; // Ignore this error since authentication is required but not defined
        }
      }
      return true;
    });

    if (filteredErrors.length > 0) {
      const errors = filteredErrors.map(err => {
        const path = err.instancePath || err.schemaPath;
        return `${path} ${err.message}`;
      }).join(', ');
      throw new Error(`System JSON does not match external-system schema: ${errors}`);
    }
  }

  // Validate each datasource against external-datasource schema
  const externalDatasourceSchemaId = datasourceSchemaToAdd.$id || 'https://raw.githubusercontent.com/esystemsdev/aifabrix-builder/refs/heads/main/lib/schema/external-datasource.schema.json';
  ajv.addSchema(datasourceSchemaToAdd, externalDatasourceSchemaId);
  const validateDatasource = ajv.compile(datasourceSchemaToAdd);

  for (let i = 0; i < datasourceJsons.length; i++) {
    const datasourceValid = validateDatasource(datasourceJsons[i]);
    if (!datasourceValid) {
      const errors = validateDatasource.errors.map(err => {
        const path = err.instancePath || err.schemaPath;
        return `${path} ${err.message}`;
      }).join(', ');
      throw new Error(`Datasource ${i + 1} (${datasourceJsons[i].key || 'unknown'}) does not match external-datasource schema: ${errors}`);
    }
  }

  return applicationSchema;
}

module.exports = {
  generateExternalSystemDeployJson,
  generateExternalSystemApplicationSchema
};

