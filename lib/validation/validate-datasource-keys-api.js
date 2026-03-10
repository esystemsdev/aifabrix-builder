/**
 * @fileoverview Async validation of datasourceKeys against dataplane API
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getPlatformDetails } = require('../api/wizard.api');
const { validateDatasourceKeysForPlatform } = require('./wizard-datasource-validation');

/**
 * Validate datasourceKeys against platform's available datasources; throws if invalid
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Auth config
 * @param {string} platformKey - Platform key
 * @param {string[]} datasourceKeys - Datasource keys to validate
 * @throws {Error} If any key is invalid
 */
async function validateDatasourceKeysBeforePlatformConfig(dataplaneUrl, authConfig, platformKey, datasourceKeys) {
  if (!Array.isArray(datasourceKeys) || datasourceKeys.length === 0) return;
  const platformDetails = await getPlatformDetails(dataplaneUrl, authConfig, platformKey);
  const datasources = platformDetails?.data?.datasources ?? platformDetails?.datasources ?? [];
  const { valid, invalidKeys } = validateDatasourceKeysForPlatform(datasourceKeys, datasources);
  if (!valid) {
    const availableKeys = datasources.map(d => d.key).filter(Boolean);
    throw new Error(
      `Invalid datasource keys: [${invalidKeys.join(', ')}]. ` +
      `Available for platform '${platformKey}': [${availableKeys.join(', ')}].`
    );
  }
}

module.exports = { validateDatasourceKeysBeforePlatformConfig };
