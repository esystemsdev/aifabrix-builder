/**
 * ABAC (Attribute-Based Access Control) validator for external datasources.
 *
 * Validates config.abac.dimensions (dimension-to-attribute references),
 * config.abac.crossSystemJson (allowed operators, one per path, value types),
 * and errors on legacy config.abac.crossSystem.
 *
 * @fileoverview ABAC validation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const DIMENSION_KEY_PATTERN = /^[a-zA-Z0-9_]+$/;
const ATTRIBUTE_PATH_PATTERN = /^[a-zA-Z0-9_.]+$/;
const CROSS_SYSTEM_JSON_PATH_PATTERN = /^[a-zA-Z0-9_.]+$/;
const ALLOWED_CROSS_SYSTEM_OPERATORS = new Set([
  'eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'nin', 'contains', 'like', 'isNull', 'isNotNull'
]);

/**
 * Validates dimension keys and attribute path values for a dimensions object.
 *
 * @param {Object} dimensions - Object mapping dimension keys to attribute paths
 * @param {string} source - Label for error messages (e.g. "config.abac.dimensions")
 * @param {Set<string>} validAttributeNames - Set of valid attribute names (from fieldMappings.attributes)
 * @returns {string[]} Error messages
 */
function validateDimensionsObject(dimensions, source, validAttributeNames) {
  const errors = [];
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) {
    return errors;
  }
  for (const [dimKey, attrPath] of Object.entries(dimensions)) {
    if (!DIMENSION_KEY_PATTERN.test(dimKey)) {
      errors.push(
        `${source}: dimension key '${dimKey}' must contain only letters, numbers, and underscores. Add '${dimKey}' to fieldMappings.attributes or fix the key.`
      );
    }
    if (typeof attrPath !== 'string' || !ATTRIBUTE_PATH_PATTERN.test(attrPath)) {
      errors.push(
        `${source}: attribute path for dimension '${dimKey}' must be a string with letters, numbers, underscores, and dots only.`
      );
    } else if (validAttributeNames && validAttributeNames.size > 0) {
      const normalizedName = attrPath.includes('.') ? attrPath.split('.').pop() : attrPath;
      if (!validAttributeNames.has(attrPath) && !validAttributeNames.has(normalizedName)) {
        errors.push(
          `${source}: dimension '${dimKey}' maps to '${attrPath}' which is not in fieldMappings.attributes. Add the attribute or remove from dimensions.`
        );
      }
    }
  }
  return errors;
}

/**
 * Validates crossSystemJson: path format, exactly one operator per path, allowed operators and value types.
 *
 * @param {Object} crossSystemJson - Object mapping field paths to operator objects
 * @returns {string[]} Error messages
 */
function validateCrossSystemJson(crossSystemJson) {
  const errors = [];
  if (!crossSystemJson || typeof crossSystemJson !== 'object' || Array.isArray(crossSystemJson)) {
    return errors;
  }
  for (const [path, opObj] of Object.entries(crossSystemJson)) {
    if (!CROSS_SYSTEM_JSON_PATH_PATTERN.test(path)) {
      errors.push(
        `config.abac.crossSystemJson: path '${path}' must contain only letters, numbers, underscores, and dots.`
      );
      continue;
    }
    if (typeof opObj !== 'object' || opObj === null || Array.isArray(opObj)) {
      errors.push(
        `config.abac.crossSystemJson.${path}: value must be an object with exactly one operator (e.g. { "eq": "user.country" }).`
      );
      continue;
    }
    const keys = Object.keys(opObj);
    if (keys.length === 0) {
      errors.push(
        `config.abac.crossSystemJson.${path}: object must have exactly one operator. Allowed: ${[...ALLOWED_CROSS_SYSTEM_OPERATORS].join(', ')}.`
      );
    } else if (keys.length > 1) {
      errors.push(
        `config.abac.crossSystemJson.${path}: must have exactly one operator per path, got ${keys.join(', ')}. Use one of: ${[...ALLOWED_CROSS_SYSTEM_OPERATORS].join(', ')}.`
      );
    } else {
      const op = keys[0];
      if (!ALLOWED_CROSS_SYSTEM_OPERATORS.has(op)) {
        errors.push(
          `config.abac.crossSystemJson.${path}: unknown operator '${op}'. Allowed: ${[...ALLOWED_CROSS_SYSTEM_OPERATORS].join(', ')}.`
        );
      }
    }
  }
  return errors;
}

/**
 * Validates ABAC configuration for a parsed datasource.
 * Checks dimensions (from config.abac or fieldMappings), crossSystemJson, and rejects legacy crossSystem.
 *
 * @function validateAbac
 * @param {Object} parsed - Parsed datasource object (after JSON parse)
 * @returns {string[]} Array of error messages; empty if valid
 *
 * @example
 * const errors = validateAbac(parsed);
 * if (errors.length > 0) errors.forEach(e => console.error(e));
 */
function validateAbac(parsed) {
  const errors = [];
  const abac = parsed?.config?.abac;
  if (!abac || typeof abac !== 'object') {
    return errors;
  }

  if ('crossSystem' in abac) {
    errors.push(
      'config.abac.crossSystem is deprecated. Use config.abac.crossSystemJson or config.abac.crossSystemSql instead.'
    );
  }

  const attributeNames = new Set(
    Object.keys(parsed?.fieldMappings?.attributes ?? {})
  );

  if (abac.dimensions) {
    errors.push(...validateDimensionsObject(
      abac.dimensions,
      'config.abac.dimensions',
      attributeNames
    ));
  }

  const fieldMappingsDimensions = parsed?.fieldMappings?.dimensions;
  if (fieldMappingsDimensions && typeof fieldMappingsDimensions === 'object') {
    errors.push(...validateDimensionsObject(
      fieldMappingsDimensions,
      'fieldMappings.dimensions',
      attributeNames
    ));
  }

  if (abac.crossSystemJson) {
    errors.push(...validateCrossSystemJson(abac.crossSystemJson));
  }

  return errors;
}

module.exports = {
  validateAbac,
  validateDimensionsObject,
  validateCrossSystemJson
};
