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
 * Validates that all field references in indexing, validation, and quality
 * exist in fieldMappings.attributes. When fieldMappings.attributes is missing
 * or empty, returns no errors (skip check, matching dataplane behavior).
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
  const normalizedAttributes = Object.keys(
    parsed?.fieldMappings?.attributes ?? {}
  );

  if (normalizedAttributes.length === 0) {
    return [];
  }

  // indexing.embedding: array of field names
  const embedding = parsed?.indexing?.embedding;
  if (Array.isArray(embedding)) {
    embedding.forEach((field, i) => {
      if (typeof field === 'string' && !normalizedAttributes.includes(field)) {
        errors.push(
          `indexing.embedding[${i}]: field '${field}' does not exist in fieldMappings.attributes`
        );
      }
    });
  }

  // indexing.uniqueKey: single field name
  const uniqueKey = parsed?.indexing?.uniqueKey;
  if (typeof uniqueKey === 'string' && uniqueKey !== '') {
    if (!normalizedAttributes.includes(uniqueKey)) {
      errors.push(
        `indexing.uniqueKey: field '${uniqueKey}' does not exist in fieldMappings.attributes`
      );
    }
  }

  // validation.repeatingValues[].field
  const repeatingValues = parsed?.validation?.repeatingValues;
  if (Array.isArray(repeatingValues)) {
    repeatingValues.forEach((rule, index) => {
      const field = rule?.field;
      if (typeof field === 'string' && !normalizedAttributes.includes(field)) {
        errors.push(
          `validation.repeatingValues[${index}].field: field '${field}' does not exist in fieldMappings.attributes`
        );
      }
    });
  }

  // quality.rejectIf[].field
  const rejectIf = parsed?.quality?.rejectIf;
  if (Array.isArray(rejectIf)) {
    rejectIf.forEach((rule, index) => {
      const field = rule?.field;
      if (typeof field === 'string' && !normalizedAttributes.includes(field)) {
        errors.push(
          `quality.rejectIf[${index}].field: field '${field}' does not exist in fieldMappings.attributes`
        );
      }
    });
  }

  return errors;
}

module.exports = {
  validateFieldReferences
};
