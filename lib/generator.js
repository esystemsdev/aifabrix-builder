/**
 * AI Fabrix Builder Deployment JSON Generator
 *
 * This module generates deployment JSON manifests for Miso Controller.
 * Combines variables.yaml, env.template, and rbac.yaml into deployment configuration.
 *
 * @fileoverview Deployment JSON generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const _secrets = require('./secrets');
const _keyGenerator = require('./key-generator');
const _validator = require('./validator');
const builders = require('./generator-builders');
const { detectAppType, getDeployJsonPath } = require('./utils/paths');
const splitFunctions = require('./generator-split');

/**
 * Loads variables.yaml file
 * @param {string} variablesPath - Path to variables.yaml
 * @returns {Object} Parsed variables
 * @throws {Error} If file not found or invalid YAML
 */
function loadVariables(variablesPath) {
  if (!fs.existsSync(variablesPath)) {
    throw new Error(`variables.yaml not found: ${variablesPath}`);
  }

  const variablesContent = fs.readFileSync(variablesPath, 'utf8');
  try {
    return { content: variablesContent, parsed: yaml.load(variablesContent) };
  } catch (error) {
    throw new Error(`Invalid YAML syntax in variables.yaml: ${error.message}`);
  }
}

/**
 * Loads env.template file
 * @param {string} templatePath - Path to env.template
 * @returns {string} Template content
 * @throws {Error} If file not found
 */
function loadEnvTemplate(templatePath) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`env.template not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Loads rbac.yaml file if it exists
 * @param {string} rbacPath - Path to rbac.yaml
 * @returns {Object|null} Parsed RBAC configuration or null
 * @throws {Error} If file exists but has invalid YAML
 */
function loadRbac(rbacPath) {
  if (!fs.existsSync(rbacPath)) {
    return null;
  }

  const rbacContent = fs.readFileSync(rbacPath, 'utf8');
  try {
    return yaml.load(rbacContent);
  } catch (error) {
    throw new Error(`Invalid YAML syntax in rbac.yaml: ${error.message}`);
  }
}

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
 * Generates deployment JSON from application configuration files
 * Creates <app-name>-deploy.json for all apps (consistent naming)
 * For external systems, loads the system JSON file
 * For regular apps, generates deployment manifest from variables.yaml, env.template, rbac.yaml
 *
 * @async
 * @function generateDeployJson
 * @param {string} appName - Name of the application
 * @returns {Promise<string>} Path to generated deployment JSON file
 * @throws {Error} If generation fails or configuration is invalid
 *
 * @example
 * const jsonPath = await generateDeployJson('myapp');
 * // Returns: './builder/myapp/myapp-deploy.json' or './integration/hubspot/hubspot-deploy.json'
 */
async function generateDeployJson(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  // Detect app type and get correct path (integration or builder)
  const { isExternal, appPath, appType } = await detectAppType(appName);
  const variablesPath = path.join(appPath, 'variables.yaml');

  // Check if app type is external
  if (isExternal) {
    return await generateExternalSystemDeployJson(appName, appPath);
  }

  // Regular app: generate deployment manifest
  const templatePath = path.join(appPath, 'env.template');
  const rbacPath = path.join(appPath, 'rbac.yaml');
  const jsonPath = getDeployJsonPath(appName, appType, true); // Use new naming

  // Load configuration files
  const { parsed: variables } = loadVariables(variablesPath);
  const envTemplate = loadEnvTemplate(templatePath);
  const rbac = loadRbac(rbacPath);

  // Parse environment variables from template and merge portalInput from variables.yaml
  const configuration = parseEnvironmentVariables(envTemplate, variables);

  // Build deployment manifest WITHOUT deploymentKey initially
  const deployment = builders.buildManifestStructure(appName, variables, null, configuration, rbac);

  // Generate deploymentKey from the manifest object (excluding deploymentKey field)
  const deploymentKey = _keyGenerator.generateDeploymentKeyFromJson(deployment);

  // Add deploymentKey to manifest
  deployment.deploymentKey = deploymentKey;

  // Validate deployment JSON against schema
  const validation = _validator.validateDeploymentJson(deployment);
  if (!validation.valid) {
    const errorMessages = validation.errors.join('\n');
    throw new Error(`Generated deployment JSON does not match schema:\n${errorMessages}`);
  }

  // Write deployment JSON
  const jsonContent = JSON.stringify(deployment, null, 2);
  fs.writeFileSync(jsonPath, jsonContent, { mode: 0o644 });

  return jsonPath;
}

/**
 * Validates portalInput structure against schema requirements
 * @param {Object} portalInput - Portal input configuration to validate
 * @param {string} variableName - Variable name for error messages
 * @throws {Error} If portalInput structure is invalid
 */
function validatePortalInput(portalInput, variableName) {
  if (!portalInput || typeof portalInput !== 'object') {
    throw new Error(`Invalid portalInput for variable '${variableName}': must be an object`);
  }

  // Check required fields
  if (!portalInput.field || typeof portalInput.field !== 'string') {
    throw new Error(`Invalid portalInput for variable '${variableName}': field is required and must be a string`);
  }

  if (!portalInput.label || typeof portalInput.label !== 'string') {
    throw new Error(`Invalid portalInput for variable '${variableName}': label is required and must be a string`);
  }

  // Validate field type
  const validFieldTypes = ['password', 'text', 'textarea', 'select'];
  if (!validFieldTypes.includes(portalInput.field)) {
    throw new Error(`Invalid portalInput for variable '${variableName}': field must be one of: ${validFieldTypes.join(', ')}`);
  }

  // Validate select field requires options
  if (portalInput.field === 'select') {
    if (!portalInput.options || !Array.isArray(portalInput.options) || portalInput.options.length === 0) {
      throw new Error(`Invalid portalInput for variable '${variableName}': select field requires a non-empty options array`);
    }
  }

  // Validate optional fields
  if (portalInput.placeholder !== undefined && typeof portalInput.placeholder !== 'string') {
    throw new Error(`Invalid portalInput for variable '${variableName}': placeholder must be a string`);
  }

  if (portalInput.masked !== undefined && typeof portalInput.masked !== 'boolean') {
    throw new Error(`Invalid portalInput for variable '${variableName}': masked must be a boolean`);
  }

  if (portalInput.validation !== undefined) {
    if (typeof portalInput.validation !== 'object' || Array.isArray(portalInput.validation)) {
      throw new Error(`Invalid portalInput for variable '${variableName}': validation must be an object`);
    }
  }

  if (portalInput.options !== undefined && portalInput.field !== 'select') {
    // Options should only be present for select fields
    if (Array.isArray(portalInput.options) && portalInput.options.length > 0) {
      throw new Error(`Invalid portalInput for variable '${variableName}': options can only be used with select field type`);
    }
  }
}

/**
 * Parses environment variables from env.template and merges portalInput from variables.yaml
 * @param {string} envTemplate - Content of env.template file
 * @param {Object|null} [variablesConfig=null] - Optional configuration from variables.yaml
 * @returns {Array<Object>} Configuration array with merged portalInput
 * @throws {Error} If portalInput structure is invalid
 */
function parseEnvironmentVariables(envTemplate, variablesConfig = null) {
  const configuration = [];
  const lines = envTemplate.split('\n');

  // Create a map of portalInput configurations by variable name
  const portalInputMap = new Map();
  if (variablesConfig && variablesConfig.configuration && Array.isArray(variablesConfig.configuration)) {
    for (const configItem of variablesConfig.configuration) {
      if (configItem.name && configItem.portalInput) {
        // Validate portalInput before adding to map
        validatePortalInput(configItem.portalInput, configItem.name);
        portalInputMap.set(configItem.name, configItem.portalInput);
      }
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE format
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, equalIndex).trim();
    const value = trimmed.substring(equalIndex + 1).trim();

    if (!key || !value) {
      continue;
    }

    // Determine location and required status
    let location = 'variable';
    let required = false;

    if (value.startsWith('kv://')) {
      location = 'keyvault';
      required = true;
    }

    // Check if it's a sensitive variable
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'auth'];
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      required = true;
    }

    const configItem = {
      name: key,
      value: value.replace('kv://', ''), // Remove kv:// prefix for KeyVault
      location,
      required
    };

    // Merge portalInput if it exists in variables.yaml
    if (portalInputMap.has(key)) {
      configItem.portalInput = portalInputMap.get(key);
    }

    configuration.push(configItem);
  }

  return configuration;
}

async function generateDeployJsonWithValidation(appName) {
  const jsonPath = await generateDeployJson(appName);
  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  const deployment = JSON.parse(jsonContent);

  // Detect if this is an external system
  const { isExternal } = await detectAppType(appName);

  // For external systems, skip deployment JSON validation (they use external system JSON structure)
  if (isExternal) {
    return {
      success: true,
      path: jsonPath,
      validation: { valid: true, errors: [], warnings: [] },
      deployment
    };
  }

  const validation = _validator.validateDeploymentJson(deployment);
  return {
    success: validation.valid,
    path: jsonPath,
    validation,
    deployment
  };
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
  generateDeployJson,
  generateDeployJsonWithValidation,
  generateExternalSystemApplicationSchema,
  parseEnvironmentVariables,
  splitDeployJson: splitFunctions.splitDeployJson,
  extractEnvTemplate: splitFunctions.extractEnvTemplate,
  extractVariablesYaml: splitFunctions.extractVariablesYaml,
  extractRbacYaml: splitFunctions.extractRbacYaml,
  parseImageReference: splitFunctions.parseImageReference,
  generateReadmeFromDeployJson: splitFunctions.generateReadmeFromDeployJson,
  buildImageReference: builders.buildImageReference,
  buildHealthCheck: builders.buildHealthCheck,
  buildRequirements: builders.buildRequirements,
  buildAuthentication: builders.buildAuthentication,
  buildAuthenticationConfig: builders.buildAuthenticationConfig
};
