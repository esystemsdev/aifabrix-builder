/**
 * Optional v2.4.x datasource validation warnings (beyond JSON Schema).
 *
 * @fileoverview Post-schema warnings for external datasource configs
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const STORAGE_ENTITIES = new Set(['recordStorage', 'documentStorage']);

function warnMissingDimensions(parsed, warnings) {
  const entityType = parsed.entityType;
  if (!STORAGE_ENTITIES.has(entityType)) {
    return;
  }
  const dims = parsed.dimensions;
  if (!dims || typeof dims !== 'object' || Array.isArray(dims) || Object.keys(dims).length === 0) {
    warnings.push(
      `Datasource "${parsed.key || '(unknown)'}": dimensions missing or empty for entityType=${entityType} (recommended for ABAC; see schema 2.4.x notes).`
    );
  }
}

function warnFkWithoutActor(parsed, warnings) {
  const dimensions = parsed.dimensions;
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) {
    return;
  }
  for (const [dimKey, binding] of Object.entries(dimensions)) {
    if (!binding || typeof binding !== 'object' || binding.type !== 'fk') {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(binding, 'actor')) {
      warnings.push(
        `Datasource "${parsed.key || '(unknown)'}": dimension "${dimKey}" uses type=fk without actor; set actor (displayName, email, userId, groups, roles) for predictable ABAC binding.`
      );
    }
  }
}

/**
 * Collects non-fatal warnings for an external datasource document (already parsed).
 * @param {Object} parsed - Parsed datasource JSON
 * @returns {string[]} Warning messages (empty if none)
 */
function collectExternalDatasourceWarnings(parsed) {
  const warnings = [];
  if (!parsed || typeof parsed !== 'object') {
    return warnings;
  }
  warnMissingDimensions(parsed, warnings);
  warnFkWithoutActor(parsed, warnings);
  return warnings;
}

module.exports = { collectExternalDatasourceWarnings };
