/**
 * Field Reference Validator for External Datasource
 *
 * Validates that field names used in indexing (embedding, uniqueKey),
 * validation.repeatingValues[].field, and quality.rejectIf[].field exist in
 * fieldMappings.attributes. Aligns with dataplane invalid_reference semantics.
 *
 * @fileoverview Offline field reference validation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Set of attribute names plus root dimension keys valid for field references.
 * Used for primaryKey (schema allows dimension keys or attributes) and other paths (attributes only).
 *
 * @param {Object} parsed - Parsed datasource object
 * @returns {{ attributes: string[], attributesAndDimensions: Set<string> }}
 */
function getNormalizedSets(parsed) {
  const attributes = Object.keys(parsed?.fieldMappings?.attributes ?? {});
  const rootDims = Object.keys(parsed?.dimensions ?? {}).filter(k => {
    const b = parsed.dimensions[k];
    return b && typeof b === 'object';
  });
  const attributesAndDimensions = new Set([...attributes, ...rootDims]);
  return { attributes, attributesAndDimensions };
}

/** @param {string[]} errors */
function checkPrimaryKey(parsed, attributesAndDimensions, errors) {
  const primaryKey = parsed?.primaryKey;
  if (!Array.isArray(primaryKey)) return;
  primaryKey.forEach((field, i) => {
    if (typeof field === 'string' && field !== '' && !attributesAndDimensions.has(field)) {
      errors.push(
        `primaryKey[${i}]: field '${field}' does not exist in fieldMappings.attributes or root dimensions. Each primaryKey value must reference an attribute or dimension key.`
      );
    }
  });
}

/** @param {string[]} errors */
function checkExposedProfiles(parsed, attrSet, errors) {
  const profiles = parsed?.exposed?.profiles;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) return;
  Object.entries(profiles).forEach(([profileName, fields]) => {
    if (!Array.isArray(fields)) return;
    fields.forEach((field, idx) => {
      if (typeof field === 'string' && !attrSet.has(field)) {
        errors.push(
          `exposed.profiles.${profileName}[${idx}]: field '${field}' does not exist in fieldMappings.attributes. Add the attribute or remove the reference.`
        );
      }
    });
  });
}

/** @param {string[]} errors */
function checkIndexingAndValidation(parsed, normalizedAttributes, errors) {
  const embedding = parsed?.indexing?.embedding;
  if (Array.isArray(embedding)) {
    embedding.forEach((field, i) => {
      if (typeof field === 'string' && !normalizedAttributes.includes(field)) {
        errors.push(
          `indexing.embedding[${i}]: field '${field}' does not exist in fieldMappings.attributes. Add the attribute or remove the reference.`
        );
      }
    });
  }
  const uniqueKey = parsed?.indexing?.uniqueKey;
  if (typeof uniqueKey === 'string' && uniqueKey !== '' && !normalizedAttributes.includes(uniqueKey)) {
    errors.push(
      `indexing.uniqueKey: field '${uniqueKey}' does not exist in fieldMappings.attributes. Add the attribute or remove the reference.`
    );
  }
  const repeatingValues = parsed?.validation?.repeatingValues;
  if (Array.isArray(repeatingValues)) {
    repeatingValues.forEach((rule, index) => {
      const field = rule?.field;
      if (typeof field === 'string' && !normalizedAttributes.includes(field)) {
        errors.push(
          `validation.repeatingValues[${index}].field: field '${field}' does not exist in fieldMappings.attributes. Add the attribute or remove the reference.`
        );
      }
    });
  }
  const rejectIf = parsed?.quality?.rejectIf;
  if (Array.isArray(rejectIf)) {
    rejectIf.forEach((rule, index) => {
      const field = rule?.field;
      if (typeof field === 'string' && !normalizedAttributes.includes(field)) {
        errors.push(
          `quality.rejectIf[${index}].field: field '${field}' does not exist in fieldMappings.attributes. Add the attribute or remove the reference.`
        );
      }
    });
  }
}

/**
 * Validates that all field references in indexing, validation, quality,
 * primaryKey, and exposed.profiles exist in fieldMappings.attributes (or
 * root dimension keys for primaryKey per schema). When fieldMappings.attributes is
 * missing or empty, returns no errors (skip check, matching dataplane behavior).
 *
 * @function validateFieldReferences
 * @param {Object} parsed - Parsed datasource object (after JSON parse)
 * @returns {string[]} Array of error messages; empty if no invalid references
 *
 * @example
 * const errors = validateFieldReferences(parsed);
 * if (errors.length > 0) {
 *   errors.forEach(e => console.error(e));
 * }
 */
function validateFieldReferences(parsed) {
  const errors = [];
  const { attributes: normalizedAttributes, attributesAndDimensions } = getNormalizedSets(parsed);
  const attrSet = new Set(normalizedAttributes);

  checkPrimaryKey(parsed, attributesAndDimensions, errors);
  checkExposedProfiles(parsed, attrSet, errors);
  if (normalizedAttributes.length === 0) return errors;

  checkIndexingAndValidation(parsed, normalizedAttributes, errors);
  return errors;
}

module.exports = {
  validateFieldReferences
};
