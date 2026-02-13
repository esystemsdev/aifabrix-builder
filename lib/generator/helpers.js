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
const { loadConfigFile } = require('../utils/config-format');

/**
 * Loads application config file (application.yaml, application.json, or legacy path) via converter.
 * @param {string} configPath - Path to application config file
 * @returns {Object} Object with parsed config: { parsed }
 * @throws {Error} If file not found or invalid YAML/JSON
 */
function loadVariables(configPath) {
  const parsed = loadConfigFile(configPath);
  return { parsed };
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
 * Validate required fields in portalInput
 * @param {Object} portalInput - Portal input configuration
 * @param {string} variableName - Variable name for error messages
 * @throws {Error} If required fields are missing
 */
function validateRequiredFields(portalInput, variableName) {
  if (!portalInput.field || typeof portalInput.field !== 'string') {
    throw new Error(`Invalid portalInput for variable '${variableName}': field is required and must be a string`);
  }

  if (!portalInput.label || typeof portalInput.label !== 'string') {
    throw new Error(`Invalid portalInput for variable '${variableName}': label is required and must be a string`);
  }
}

/**
 * Validate field type in portalInput
 * @param {Object} portalInput - Portal input configuration
 * @param {string} variableName - Variable name for error messages
 * @throws {Error} If field type is invalid
 */
function validateFieldType(portalInput, variableName) {
  const validFieldTypes = ['password', 'text', 'textarea', 'select'];
  if (!validFieldTypes.includes(portalInput.field)) {
    throw new Error(`Invalid portalInput for variable '${variableName}': field must be one of: ${validFieldTypes.join(', ')}`);
  }
}

/**
 * Validate select field options
 * @param {Object} portalInput - Portal input configuration
 * @param {string} variableName - Variable name for error messages
 * @throws {Error} If select field options are invalid
 */
function validateSelectFieldOptions(portalInput, variableName) {
  if (portalInput.field === 'select') {
    if (!portalInput.options || !Array.isArray(portalInput.options) || portalInput.options.length === 0) {
      throw new Error(`Invalid portalInput for variable '${variableName}': select field requires a non-empty options array`);
    }
  }

  if (portalInput.options !== undefined && portalInput.field !== 'select') {
    if (Array.isArray(portalInput.options) && portalInput.options.length > 0) {
      throw new Error(`Invalid portalInput for variable '${variableName}': options can only be used with select field type`);
    }
  }
}

/**
 * Validate optional fields in portalInput
 * @param {Object} portalInput - Portal input configuration
 * @param {string} variableName - Variable name for error messages
 * @throws {Error} If optional fields are invalid
 */
function validateOptionalFields(portalInput, variableName) {
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

  validateRequiredFields(portalInput, variableName);
  validateFieldType(portalInput, variableName);
  validateSelectFieldOptions(portalInput, variableName);
  validateOptionalFields(portalInput, variableName);
}

/**
 * Parses environment variables from env.template and merges portalInput from application config
 * @param {string} envTemplate - Content of env.template file
 * @param {Object|null} [variablesConfig=null] - Optional configuration from application.yaml
 * @returns {Array<Object>} Configuration array with merged portalInput
 * @throws {Error} If portalInput structure is invalid
 */
/**
 * Creates a map of portalInput configurations from variables config
 * @function createPortalInputMap
 * @param {Object|null} variablesConfig - Configuration from application.yaml
 * @returns {Map} Map of variable names to portalInput configurations
 */
function createPortalInputMap(variablesConfig) {
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
  return portalInputMap;
}

/**
 * Parses a single environment variable line
 * @function parseEnvironmentVariableLine
 * @param {string} line - Line to parse
 * @returns {Object|null} Parsed variable object or null if invalid
 */
function parseEnvironmentVariableLine(line) {
  const trimmed = line.trim();

  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  // Parse KEY=VALUE format
  const equalIndex = trimmed.indexOf('=');
  if (equalIndex === -1) {
    return null;
  }

  const key = trimmed.substring(0, equalIndex).trim();
  const value = trimmed.substring(equalIndex + 1).trim();

  if (!key || !value) {
    return null;
  }

  return { key, value };
}

/**
 * Determines location and required status for a variable
 * @function determineVariableLocation
 * @param {string} value - Variable value
 * @param {string} key - Variable key
 * @returns {Object} Object with location and required properties
 */
function determineVariableLocation(value, key) {
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

  return { location, required };
}

/**
 * Creates a configuration item from parsed variable
 * @function createConfigItem
 * @param {string} key - Variable key
 * @param {string} value - Variable value
 * @param {string} location - Variable location
 * @param {boolean} required - Whether variable is required
 * @param {Map} portalInputMap - Map of portalInput configurations
 * @returns {Object} Configuration item
 */
function createConfigItem(key, value, location, required, portalInputMap) {
  const configItem = {
    name: key,
    value: value.replace('kv://', ''), // Remove kv:// prefix for KeyVault
    location,
    required
  };

  // Merge portalInput if it exists in application config
  if (portalInputMap.has(key)) {
    configItem.portalInput = portalInputMap.get(key);
  }

  return configItem;
}

function parseEnvironmentVariables(envTemplate, variablesConfig = null) {
  const configuration = [];
  const lines = envTemplate.split('\n');
  const portalInputMap = createPortalInputMap(variablesConfig);

  for (const line of lines) {
    const parsed = parseEnvironmentVariableLine(line);
    if (!parsed) {
      continue;
    }

    const { location, required } = determineVariableLocation(parsed.value, parsed.key);
    const configItem = createConfigItem(parsed.key, parsed.value, location, required, portalInputMap);
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

