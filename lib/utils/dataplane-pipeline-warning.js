/**
 * Shared warning message for Dataplane pipeline API usage (upload / validate / publish).
 * Used by upload command and datasource upload so users know configuration is sent to Dataplane.
 *
 * @fileoverview Dataplane pipeline usage warning
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const logger = require('./logger');
const { metadata } = require('./cli-test-layout-chalk');

/** Message shown when CLI is about to call Dataplane pipeline upload or publish APIs. */
const DATAPLANE_PIPELINE_WARNING =
  'Configuration will be sent to the Dataplane pipeline API. Ensure you are targeting the correct environment and have the required permissions.';

/**
 * Log the Dataplane pipeline notice (non-warning) to the console.
 * Call before uploadApplicationViaPipeline or publishDatasourceViaPipeline.
 */
function logDataplanePipelineWarning() {
  // Informational: this is expected behavior for upload/publish flows.
  logger.log(metadata(`Dataplane pipeline: ${DATAPLANE_PIPELINE_WARNING}`));
}

module.exports = {
  DATAPLANE_PIPELINE_WARNING,
  logDataplanePipelineWarning
};
