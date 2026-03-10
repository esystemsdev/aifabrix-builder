/**
 * @fileoverview Entity selection step for OpenAPI multi-entity wizard flow
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('../utils/logger');
const { discoverEntities } = require('../api/wizard.api');
const { validateEntityNameForOpenApi } = require('../validation/wizard-datasource-validation');
const { promptForEntitySelection } = require('../generator/wizard-prompts');

/**
 * Handle entity selection step (OpenAPI multi-entity).
 * Calls discover-entities; if entities found, prompts user to select one.
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} openapiSpec - OpenAPI specification
 * @returns {Promise<string|null>} Selected entity name or null (skip)
 */
async function handleEntitySelection(dataplaneUrl, authConfig, openapiSpec) {
  if (!openapiSpec || typeof openapiSpec !== 'object') return null;
  try {
    const response = await discoverEntities(dataplaneUrl, authConfig, openapiSpec);
    const entities = response?.data?.entities;
    if (!Array.isArray(entities) || entities.length === 0) return null;

    logger.log(chalk.blue('\n\uD83D\uDCCB Step 4.5: Select Entity'));
    const entityName = await promptForEntitySelection(entities);
    const validation = validateEntityNameForOpenApi(entityName, entities);
    if (!validation.valid) {
      throw new Error(`Invalid entity '${entityName}'. Available: ${entities.map(e => e.name).join(', ')}`);
    }
    logger.log(chalk.green(`\u2713 Selected entity: ${entityName}`));
    return entityName;
  } catch (error) {
    logger.log(chalk.yellow(`Warning: Entity discovery failed, using default: ${error.message}`));
    return null;
  }
}

module.exports = { handleEntitySelection };
