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
const { formatSuccessLine } = require('../utils/cli-layout-chalk');

/**
 * If wizard.yaml entity name matches discover-entities list, use it; else warn.
 * @param {string} trimmed - Trimmed entity name from prefill
 * @param {Array<{name: string}>} entities - Discovered entities
 * @returns {string|null} Resolved name or null to prompt
 */
function resolvePrefillEntityName(trimmed, entities) {
  const prefillCheck = validateEntityNameForOpenApi(trimmed, entities);
  if (prefillCheck.valid) {
    logger.log(chalk.gray(
      `Using entity from wizard.yaml (${trimmed}). Skipping entity prompts.`
    ));
    logger.log(formatSuccessLine(`Selected entity: ${trimmed}`));
    return trimmed;
  }
  logger.log(chalk.yellow(
    `Warning: wizard.yaml source.entityName '${trimmed}' is not in the discover-entities list; choose manually.`
  ));
  return null;
}

/**
 * Prompt for entity and validate against list.
 * @param {Array<{name: string}>} entities - Discovered entities
 * @returns {Promise<string>} Valid entity name
 */
async function promptForValidatedEntity(entities) {
  const entityName = await promptForEntitySelection(entities);
  const validation = validateEntityNameForOpenApi(entityName, entities);
  if (!validation.valid) {
    throw new Error(`Invalid entity '${entityName}'. Available: ${entities.map(e => e.name).join(', ')}`);
  }
  logger.log(formatSuccessLine(`Selected entity: ${entityName}`));
  return entityName;
}

/**
 * Discover entities and select one (single-entity shortcut, prefill, or prompt).
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} openapiSpec - OpenAPI specification
 * @param {string} [prefillEntityName] - From wizard.yaml `source.entityName` when valid
 * @returns {Promise<string|null>} Selected entity name or null (skip)
 */
async function discoverAndSelectEntity(dataplaneUrl, authConfig, openapiSpec, prefillEntityName) {
  const response = await discoverEntities(dataplaneUrl, authConfig, openapiSpec);
  const entities = response?.data?.entities;
  if (!Array.isArray(entities) || entities.length === 0) return null;

  logger.log(chalk.blue('\n\uD83D\uDCCB Step 4.5: Select Entity'));

  if (entities.length === 1) {
    const only = entities[0].name;
    logger.log(formatSuccessLine(`Only one entity discovered; using: ${only}`));
    return only;
  }

  const trimmed =
    typeof prefillEntityName === 'string' ? prefillEntityName.trim() : '';
  if (trimmed) {
    const resolved = resolvePrefillEntityName(trimmed, entities);
    if (resolved) return resolved;
  }

  return promptForValidatedEntity(entities);
}

/**
 * Handle entity selection step (OpenAPI multi-entity).
 * Calls discover-entities; prompts unless prefill or a single entity applies.
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {Object} openapiSpec - OpenAPI specification
 * @param {string} [prefillEntityName] - From wizard.yaml `source.entityName` when valid
 * @returns {Promise<string|null>} Selected entity name or null (skip)
 */
async function handleEntitySelection(dataplaneUrl, authConfig, openapiSpec, prefillEntityName) {
  if (!openapiSpec || typeof openapiSpec !== 'object') return null;
  try {
    return await discoverAndSelectEntity(dataplaneUrl, authConfig, openapiSpec, prefillEntityName);
  } catch (error) {
    logger.log(chalk.yellow(`Warning: Entity discovery failed, using default: ${error.message}`));
    return null;
  }
}

module.exports = { handleEntitySelection };
