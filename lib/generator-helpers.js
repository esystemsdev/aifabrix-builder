/**
 * Generator Helper Functions
 *
 * Helper functions for loading and parsing configuration files used in deployment JSON generation.
 *
 * @fileoverview Generator helper functions for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const yaml = require('js-yaml');

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

module.exports = {
  loadVariables,
  loadEnvTemplate,
  loadRbac,
  validatePortalInput,
  parseEnvironmentVariables
};

