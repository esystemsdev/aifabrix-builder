/**
 * @fileoverview Wizard datasource validation helpers - validate datasourceKeys and entityName against dataplane
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Validate that all datasourceKeys exist in the platform's available datasources
 * @function validateDatasourceKeysForPlatform
 * @param {string[]} datasourceKeys - User-provided datasource keys
 * @param {Array<{key: string, displayName?: string, entity?: string}>} availableDatasources - Platform datasources
 * @returns {{ valid: boolean, invalidKeys: string[] }} Validation result
 */
function validateDatasourceKeysForPlatform(datasourceKeys, availableDatasources) {
  if (!Array.isArray(datasourceKeys) || datasourceKeys.length === 0) {
    return { valid: true, invalidKeys: [] };
  }
  const availableKeys = Array.isArray(availableDatasources)
    ? availableDatasources.map(d => (d && typeof d === 'object' && d.key) ? d.key : null).filter(Boolean)
    : [];
  const invalidKeys = datasourceKeys.filter(k => !availableKeys.includes(k));
  return {
    valid: invalidKeys.length === 0,
    invalidKeys
  };
}

/**
 * Validate that entityName exists in the discovered entities list
 * @function validateEntityNameForOpenApi
 * @param {string} entityName - User-provided entity name
 * @param {Array<{name: string}>} entities - Discovered entities from OpenAPI
 * @returns {{ valid: boolean }} Validation result
 */
function validateEntityNameForOpenApi(entityName, entities) {
  if (!entityName || typeof entityName !== 'string' || entityName.trim() === '') {
    return { valid: true };
  }
  const entityNames = Array.isArray(entities)
    ? entities.map(e => (e && typeof e === 'object' && e.name) ? e.name : null).filter(Boolean)
    : [];
  return {
    valid: entityNames.includes(entityName)
  };
}

module.exports = {
  validateDatasourceKeysForPlatform,
  validateEntityNameForOpenApi
};
