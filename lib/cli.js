/**
 * AI Fabrix Builder CLI Command Definitions
 *
 * This module re-exports CLI setup from lib/cli/ to keep the public API
 * at require('./lib/cli') unchanged. All command definitions live in lib/cli/.
 *
 * @fileoverview Re-export for AI Fabrix Builder CLI (lib/cli.js)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const cli = require('./cli/index');

module.exports = {
  setupCommands: cli.setupCommands,
  validateCommand: cli.validateCommand,
  handleCommandError: cli.handleCommandError
};
