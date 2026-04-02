#!/usr/bin/env node

/**
 * AI Fabrix Builder CLI Entry Point
 *
 * This is the main entry point for the @aifabrix/builder CLI tool.
 * It initializes Commander.js and delegates command handling to lib/cli.js
 *
 * Usage: aifabrix <command> [options]
 *
 * @fileoverview CLI entry point for AI Fabrix Builder SDK
 * @author AI Fabrix Team
 * @version 2.0.2
 */

const { Command } = require('commander');
const cli = require('../lib/cli');
const logger = require('../lib/utils/logger');
const { buildCategorizedHelp } = require('../lib/utils/help-builder');
const packageJson = require('../package.json');

/**
 * Initialize and configure the CLI
 * Sets up command parsing, help text, and version information
 */
function initializeCLI() {
  const program = new Command();

  program.name('aifabrix')
    .version(packageJson.version)
    .description(
      'Local Docker infra, app scaffolding, validation, and deploy to Azure (or local) via Miso Controller'
    );

  // Delegate command setup to lib/cli.js (order matches help categories for consistency)
  cli.setupCommands(program);

  // Custom help replaces Commander default; append footer here (program.addHelpText is not applied)
  const ROOT_HELP_FOOTER = `

More:
  aifabrix <command> --help    Options and examples for one command
  docs/commands/README.md     Command reference in the repo
`;

  program.helpInformation = function() {
    return buildCategorizedHelp(program) + ROOT_HELP_FOOTER;
  };

  // Parse command line arguments
  program.parse();
}

// TODO: Add error handling for CLI initialization
// TODO: Add graceful shutdown handling
// TODO: Add telemetry/analytics hooks (opt-in)

// Initialize CLI when this file is executed directly
if (require.main === module) {
  try {
    initializeCLI();
  } catch (error) {
    logger.error('❌ Failed to initialize CLI:', error.message);
    process.exit(1);
  }
}

module.exports = { initializeCLI };
