/**
 * Config format preference utilities (json/yaml)
 *
 * @fileoverview Format preference get/set for config
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/**
 * Validate and normalize format (json or yaml)
 * @param {*} format - Format value
 * @returns {string} Normalized format ('json' or 'yaml')
 * @throws {Error} If format is invalid
 */
function validateAndNormalizeFormat(format) {
  if (!format || typeof format !== 'string') {
    throw new Error('Option --format must be \'json\' or \'yaml\'');
  }
  const normalized = format.trim().toLowerCase();
  if (normalized !== 'json' && normalized !== 'yaml') {
    throw new Error('Option --format must be \'json\' or \'yaml\'');
  }
  return normalized;
}

/**
 * Create format preference functions
 * @param {Function} getConfigFn - Async function to get config
 * @param {Function} saveConfigFn - Async function to save config
 * @returns {{ getFormat: Function, setFormat: Function, validateAndNormalizeFormat: Function }}
 */
function createFormatFunctions(getConfigFn, saveConfigFn) {
  return {
    async getFormat() {
      const config = await getConfigFn();
      const raw = config.format;
      if (!raw || typeof raw !== 'string') return null;
      const normalized = raw.trim().toLowerCase();
      return normalized === 'json' || normalized === 'yaml' ? normalized : null;
    },
    async setFormat(format) {
      const normalized = validateAndNormalizeFormat(format);
      const config = await getConfigFn();
      config.format = normalized;
      await saveConfigFn(config);
    },
    validateAndNormalizeFormat
  };
}

module.exports = { createFormatFunctions, validateAndNormalizeFormat };
