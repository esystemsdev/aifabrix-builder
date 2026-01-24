/**
 * @fileoverview Normalize wizard-generated configs before validation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const ENTITY_TYPE_FALLBACK = 'record-storage';
const VALID_ENTITY_TYPES = new Set([
  'document-storage',
  'documentStorage',
  'vector-store',
  'vectorStore',
  'record-storage',
  'recordStorage',
  'message-service',
  'messageService',
  'none'
]);
const VALID_PORTAL_FIELDS = new Set(['text', 'textarea', 'select', 'json', 'boolean', 'number']);

/**
 * Normalize system config fields to schema constraints
 * @function normalizeSystemConfig
 * @param {Object} systemConfig - External system config
 * @returns {Object} Normalized config
 */
function normalizeSystemConfig(systemConfig) {
  if (!systemConfig || typeof systemConfig !== 'object') {
    return systemConfig;
  }
  if (typeof systemConfig.description === 'string' && systemConfig.description.length > 500) {
    systemConfig.description = systemConfig.description.slice(0, 500);
  }
  return systemConfig;
}

/**
 * Normalize datasource config fields to schema constraints
 * @function normalizeDatasourceConfig
 * @param {Object} datasourceConfig - Datasource config
 * @returns {Object} Normalized config
 */
function normalizeDatasourceConfig(datasourceConfig) {
  if (!datasourceConfig || typeof datasourceConfig !== 'object') {
    return datasourceConfig;
  }
  if (datasourceConfig.entityType && !VALID_ENTITY_TYPES.has(datasourceConfig.entityType)) {
    datasourceConfig.entityType = ENTITY_TYPE_FALLBACK;
  }
  if (Array.isArray(datasourceConfig.portalInput)) {
    datasourceConfig.portalInput = datasourceConfig.portalInput.filter(item => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      if (!item.name || !item.field || !item.label) {
        return false;
      }
      return VALID_PORTAL_FIELDS.has(item.field);
    });
  }
  if (datasourceConfig.execution?.cip?.operations) {
    for (const operation of Object.values(datasourceConfig.execution.cip.operations)) {
      if (!operation || !Array.isArray(operation.steps)) {
        continue;
      }
      for (const step of operation.steps) {
        if (step?.output?.mode && step.output.mode !== 'records') {
          step.output.mode = 'records';
        }
      }
    }
  }
  return datasourceConfig;
}

/**
 * Normalize system and datasource configs
 * @function normalizeWizardConfigs
 * @param {Object} systemConfig - System config
 * @param {Object|Object[]} datasourceConfigs - Datasource config(s)
 * @returns {{ systemConfig: Object, datasourceConfigs: Object[] }} Normalized configs
 */
function normalizeWizardConfigs(systemConfig, datasourceConfigs) {
  const normalizedSystem = normalizeSystemConfig(systemConfig);
  const configs = Array.isArray(datasourceConfigs) ? datasourceConfigs : [datasourceConfigs];
  const normalizedDatasources = configs.map(normalizeDatasourceConfig);
  return { systemConfig: normalizedSystem, datasourceConfigs: normalizedDatasources };
}

module.exports = {
  normalizeWizardConfigs
};
