/**
 * Datasource Diff Command
 *
 * Compares two datasource configuration files.
 * Specialized for dataplane deployment validation.
 *
 * @fileoverview Datasource comparison for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');
const { compareFiles, formatDiffOutput } = require('../core/diff');
const logger = require('../utils/logger');

/**
 * Compares two datasource files with focus on dataplane-relevant fields
 *
 * @async
 * @function compareDatasources
 * @param {string} file1 - Path to first datasource file
 * @param {string} file2 - Path to second datasource file
 * @returns {Promise<void>}
 * @throws {Error} If comparison fails
 */
async function compareDatasources(file1, file2) {
  const result = await compareFiles(file1, file2);

  // Filter and highlight dataplane-relevant changes
  const dataplaneRelevant = {
    fieldMappings: result.changed.filter(c => c.path.includes('fieldMappings')),
    exposed: result.changed.filter(c => c.path.includes('exposed')),
    sync: result.changed.filter(c => c.path.includes('sync')),
    openapi: result.changed.filter(c => c.path.includes('openapi')),
    mcp: result.changed.filter(c => c.path.includes('mcp'))
  };

  // Display standard diff
  formatDiffOutput(result);

  // Display dataplane-specific highlights
  const hasDataplaneChanges = Object.values(dataplaneRelevant).some(arr => arr.length > 0);

  if (hasDataplaneChanges) {
    logger.log(chalk.blue('\n📊 Dataplane-Relevant Changes:'));

    if (dataplaneRelevant.fieldMappings.length > 0) {
      logger.log(chalk.yellow(`  • Field Mappings: ${dataplaneRelevant.fieldMappings.length} changes`));
    }
    if (dataplaneRelevant.exposed.length > 0) {
      logger.log(chalk.yellow(`  • Exposed Fields: ${dataplaneRelevant.exposed.length} changes`));
    }
    if (dataplaneRelevant.sync.length > 0) {
      logger.log(chalk.yellow(`  • Sync Configuration: ${dataplaneRelevant.sync.length} changes`));
    }
    if (dataplaneRelevant.openapi.length > 0) {
      logger.log(chalk.yellow(`  • OpenAPI Configuration: ${dataplaneRelevant.openapi.length} changes`));
    }
    if (dataplaneRelevant.mcp.length > 0) {
      logger.log(chalk.yellow(`  • MCP Configuration: ${dataplaneRelevant.mcp.length} changes`));
    }
  }

  // Exit with appropriate code
  if (!result.identical) {
    process.exit(1);
  }
}

module.exports = {
  compareDatasources
};

