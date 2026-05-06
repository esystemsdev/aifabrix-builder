/**
 * Regenerate *-deploy.json on disk for an integration (same as `aifabrix json <systemKey>`).
 *
 * @fileoverview Sync deployment manifest file before upload/deploy
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { formatSuccessLine } = require('../utils/cli-test-layout-chalk');
const generator = require('../generator');
const logger = require('../utils/logger');

/**
 * Writes integration/<systemKey>/<systemKey>-deploy.json from current application sources.
 * Equivalent to running {@link generator.generateDeployJson} / `aifabrix json <systemKey>` for externals.
 *
 * @param {string} systemKey - External system key (integration folder name)
 * @param {{ quiet?: boolean }} [opts] - quiet: omit success log line
 * @returns {Promise<string>} Absolute path to the written deploy JSON file
 */
async function syncDeployJsonFromSources(systemKey, opts = {}) {
  const deployPath = await generator.generateDeployJson(systemKey, {});
  if (!opts.quiet) {
    logger.log(formatSuccessLine(`Updated deployment manifest: ${deployPath}`));
  }
  return deployPath;
}

module.exports = {
  syncDeployJsonFromSources
};
