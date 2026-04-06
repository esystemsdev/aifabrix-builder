/**
 * User preference: useEnvironmentScopedResources in ~/.aifabrix/config.yaml
 *
 * @fileoverview Gate for environment-scoped resource resolution (plan 117)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {Function} getConfigFn - async () => config object
 * @param {Function} saveConfigFn - async (config) => void
 * @returns {{ getUseEnvironmentScopedResources: Function, setUseEnvironmentScopedResources: Function }}
 */
function createScopedResourcesPreferenceFunctions(getConfigFn, saveConfigFn) {
  return {
    /**
     * @returns {Promise<boolean>}
     */
    async getUseEnvironmentScopedResources() {
      const cfg = await getConfigFn();
      return Boolean(cfg.useEnvironmentScopedResources);
    },

    /**
     * @param {boolean} value - Activate (true) or passivate (false) user gate
     * @returns {Promise<void>}
     */
    async setUseEnvironmentScopedResources(value) {
      if (typeof value !== 'boolean') {
        throw new Error('useEnvironmentScopedResources must be a boolean');
      }
      const cfg = await getConfigFn();
      cfg.useEnvironmentScopedResources = value;
      await saveConfigFn(cfg);
    }
  };
}

module.exports = { createScopedResourcesPreferenceFunctions };
