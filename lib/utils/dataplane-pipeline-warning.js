/**
 * Shared warning message for Dataplane pipeline API usage (upload / validate / publish).
 * Used by upload command and datasource upload so users know configuration is sent to Dataplane.
 *
 * @fileoverview Dataplane pipeline usage warning
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const logger = require('./logger');

/** Message shown when CLI is about to call Dataplane pipeline upload or publish APIs. */
const DATAPLANE_PIPELINE_WARNING =
  'Configuration will be sent to the Dataplane pipeline API. Ensure you are targeting the correct environment and have the required permissions.';

/**
 * Log the Dataplane pipeline warning (yellow) to the console.
 * Call before uploadApplicationViaPipeline or publishDatasourceViaPipeline.
 */
function logDataplanePipelineWarning() {
  logger.log(chalk.yellow(`⚠ ${DATAPLANE_PIPELINE_WARNING}`));
}

module.exports = {
  DATAPLANE_PIPELINE_WARNING,
  logDataplanePipelineWarning
};
