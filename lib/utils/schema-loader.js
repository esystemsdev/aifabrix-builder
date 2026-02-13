/**
 * Schema Loading Utilities
 *
 * Loads and compiles JSON schemas for validation.
 * Provides schema type detection and cached validators.
 *
 * @fileoverview Schema loading utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// Cache for compiled validators
// These are reset when module is reloaded (for testing)
let externalSystemValidator = null;
let externalDataSourceValidator = null;

/**
 * Reset validators cache (for testing)
 * @function resetValidators
 */
function resetValidators() {
  externalSystemValidator = null;
  externalDataSourceValidator = null;
}

/**
 * Loads and compiles external-system schema
 * Caches the compiled validator for performance
 *
 * @function loadExternalSystemSchema
 * @returns {Function} Compiled AJV validator function
 * @throws {Error} If schema file cannot be loaded or compiled
 *
 * @example
 * const validate = loadExternalSystemSchema();
 * const valid = validate(data);
 */
function loadExternalSystemSchema() {
  if (externalSystemValidator) {
    return externalSystemValidator;
  }

  const schemaPath = path.join(__dirname, '..', 'schema', 'external-system.schema.json');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`External system schema not found: ${schemaPath}`);
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  let schema;

  try {
    schema = JSON.parse(schemaContent);
  } catch (error) {
    throw new Error(`Invalid JSON in external-system.schema.json: ${error.message}`);
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  externalSystemValidator = ajv.compile(schema);

  return externalSystemValidator;
}

/**
 * Loads and compiles external-datasource schema
 * Caches the compiled validator for performance
 *
 * @function loadExternalDataSourceSchema
 * @returns {Function} Compiled AJV validator function
 * @throws {Error} If schema file cannot be loaded or compiled
 *
 * @example
 * const validate = loadExternalDataSourceSchema();
 * const valid = validate(data);
 */
function loadExternalDataSourceSchema() {
  if (externalDataSourceValidator) {
    return externalDataSourceValidator;
  }

  const schemaPath = path.join(__dirname, '..', 'schema', 'external-datasource.schema.json');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`External datasource schema not found: ${schemaPath}`);
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  let schema;

  try {
    schema = JSON.parse(schemaContent);
  } catch (error) {
    throw new Error(`Invalid JSON in external-datasource.schema.json: ${error.message}`);
  }

  // For draft-2020-12 schemas, we need to handle $schema differently
  // Remove $schema if it's draft-2020-12 to avoid AJV issues
  const schemaToCompile = { ...schema };
  if (schemaToCompile.$schema && schemaToCompile.$schema.includes('2020-12')) {
    // AJV v8 supports draft-2020-12 but may need the schema without $schema for compilation
    delete schemaToCompile.$schema;
  }

  const ajv = new Ajv({ allErrors: true, strict: false, strictSchema: false });
  externalDataSourceValidator = ajv.compile(schemaToCompile);

  return externalDataSourceValidator;
}

/**
 * Detect schema type from $id field
 * @param {Object} parsed - Parsed JSON object
 * @returns {string|null} Schema type or null if not detected
 */
function detectFromId(parsed) {
  if (!parsed.$id) {
    return null;
  }

  if (parsed.$id.includes('external-system')) {
    return 'external-system';
  }
  if (parsed.$id.includes('external-datasource')) {
    return 'external-datasource';
  }
  if (parsed.$id.includes('application-schema')) {
    return 'application';
  }

  return null;
}

/**
 * Detect schema type from title field
 * @param {Object} parsed - Parsed JSON object
 * @returns {string|null} Schema type or null if not detected
 */
function detectFromTitle(parsed) {
  if (!parsed.title) {
    return null;
  }

  const titleLower = parsed.title.toLowerCase();
  if (titleLower.includes('external system') || titleLower.includes('external-system') || titleLower.includes('external system configuration')) {
    return 'external-system';
  }
  if (titleLower.includes('external data source') || titleLower.includes('external datasource') || titleLower.includes('external-datasource')) {
    return 'external-datasource';
  }
  if (titleLower.includes('application')) {
    return 'application';
  }

  return null;
}

/**
 * Detect schema type from required fields
 * @param {Object} parsed - Parsed JSON object
 * @returns {string|null} Schema type or null if not detected
 */
function detectFromRequiredFields(parsed) {
  if (!parsed.key || !parsed.displayName || !parsed.type || !parsed.authentication) {
    return null;
  }

  // Check if it has systemKey (datasource) or not (system)
  if (parsed.systemKey) {
    return 'external-datasource';
  }
  // Check if type is one of external-system types
  if (['openapi', 'mcp', 'custom'].includes(parsed.type)) {
    return 'external-system';
  }

  return null;
}

/**
 * Detect schema type from datasource-specific fields
 * @param {Object} parsed - Parsed JSON object
 * @returns {string|null} Schema type or null if not detected
 */
function detectFromDatasourceFields(parsed) {
  // Support both entityType (new) and entityKey (old) for backward compatibility during migration
  if (parsed.systemKey && (parsed.entityType || parsed.entityKey) && parsed.fieldMappings) {
    return 'external-datasource';
  }
  return null;
}

/**
 * Detect schema type from application-specific fields
 * @param {Object} parsed - Parsed JSON object
 * @returns {string|null} Schema type or null if not detected
 */
function detectFromApplicationFields(parsed) {
  if (parsed.image && parsed.registryMode && parsed.port) {
    return 'application';
  }
  return null;
}

/**
 * Detect schema type from filename pattern
 * @param {string} filePath - File path
 * @returns {string|null} Schema type or null if not detected
 */
function detectFromFilename(filePath) {
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName.includes('external-system') || fileName.includes('external_system')) {
    return 'external-system';
  }
  if (fileName.includes('external-datasource') || fileName.includes('external_datasource') || fileName.includes('datasource')) {
    return 'external-datasource';
  }
  if (fileName.includes('application') || fileName.includes('variables') || fileName.includes('deploy')) {
    return 'application';
  }
  return null;
}

/**
 * Detects schema type from file content or path
 * Attempts to identify if file is application, external-system, or external-datasource
 *
 * @function detectSchemaType
 * @param {string} filePath - Path to the file
 * @param {string} [content] - Optional file content (if not provided, will be read from file)
 * @returns {string} Schema type: 'application' | 'external-system' | 'external-datasource'
 * @throws {Error} If file cannot be read or parsed
 *
 * @example
 * const type = detectSchemaType('./hubspot.json');
 * // Returns: 'external-system'
 */
/**
 * Reads and parses file content
 * @function readAndParseFileContent
 * @param {string} filePath - File path
 * @param {string|undefined} content - Optional file content
 * @returns {Object} Parsed JSON object
 * @throws {Error} If file not found or invalid JSON
 */
function readAndParseFileContent(filePath, content) {
  let fileContent = content;

  if (!fileContent) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    fileContent = fs.readFileSync(filePath, 'utf8');
  }

  try {
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid JSON in file: ${error.message}`);
  }
}

/**
 * Tries detection methods in order
 * @function tryDetectionMethods
 * @param {Object} parsed - Parsed JSON object
 * @param {string} filePath - File path
 * @returns {string|null} Detected type or null
 */
function tryDetectionMethods(parsed, filePath) {
  const detectionMethods = [
    () => detectFromId(parsed),
    () => detectFromTitle(parsed),
    () => detectFromRequiredFields(parsed),
    () => detectFromDatasourceFields(parsed),
    () => detectFromApplicationFields(parsed),
    () => detectFromFilename(filePath)
  ];

  for (const method of detectionMethods) {
    const result = method();
    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * Detects schema type from already-parsed content (works with YAML or JSON).
 * Use this when the file was parsed via loadConfigFile or similar.
 *
 * @function detectSchemaTypeFromParsed
 * @param {Object} parsed - Parsed config object (from YAML or JSON)
 * @param {string} filePath - File path (used for filename-based detection)
 * @returns {string} 'application' | 'external-system' | 'external-datasource'
 *
 * @example
 * const parsed = yaml.load(content);
 * const type = detectSchemaTypeFromParsed(parsed, '/path/to/application.yaml');
 */
function detectSchemaTypeFromParsed(parsed, filePath) {
  if (!parsed || typeof parsed !== 'object') {
    return 'application';
  }
  const detected = tryDetectionMethods(parsed, filePath);
  return detected || 'application';
}

function detectSchemaType(filePath, content) {
  const parsed = readAndParseFileContent(filePath, content);
  const detectedType = tryDetectionMethods(parsed, filePath);
  return detectedType || 'application';
}

module.exports = {
  loadExternalSystemSchema,
  loadExternalDataSourceSchema,
  detectSchemaType,
  detectSchemaTypeFromParsed,
  resetValidators
};

