/**
 * AI Fabrix Builder CLI Command Definitions
 *
 * This module wires all CLI command setup and re-exports setupCommands,
 * validateCommand, and handleCommandError for backward compatibility.
 *
 * @fileoverview CLI entry for AI Fabrix Builder; command setup orchestration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { validateCommand, handleCommandError } = require('../utils/cli-utils');
const { setupAuthCommands } = require('./setup-auth');
const { setupInfraCommands } = require('./setup-infra');
const { setupAppCommands } = require('./setup-app');
const { setupEnvironmentCommands } = require('./setup-environment');
const { setupUtilityCommands } = require('./setup-utility');
const { setupDevCommands } = require('./setup-dev');
const { setupSecretsCommands } = require('./setup-secrets');
const { setupExternalSystemCommands } = require('./setup-external-system');
const { setupAppCommands: setupAppManagementCommands } = require('../commands/app');
const { setupDatasourceCommands } = require('../commands/datasource');

/**
 * Sets up all CLI commands on the Commander program instance
 * @param {Command} program - Commander program instance
 */
function setupCommands(program) {
  setupInfraCommands(program);
  setupAuthCommands(program);
  setupAppCommands(program);
  setupEnvironmentCommands(program);
  setupAppManagementCommands(program);
  setupDatasourceCommands(program);
  setupUtilityCommands(program);
  setupExternalSystemCommands(program);
  setupDevCommands(program);
  setupSecretsCommands(program);
}

module.exports = {
  setupCommands,
  validateCommand,
  handleCommandError
};
