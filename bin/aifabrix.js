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
 * @version 2.0.0
 */

const { Command } = require('commander');
const cli = require('../lib/cli');
const { setupAppCommands } = require('../lib/commands/app');

/**
 * Initialize and configure the CLI
 * Sets up command parsing, help text, and version information
 */
function initializeCLI() {
  const program = new Command();

  program.name('aifabrix')
    .version('2.0.0')
    .description('AI Fabrix Local Fabric & Deployment SDK');

  // Delegate command setup to lib/cli.js
  cli.setupCommands(program);

  // Add application management commands
  setupAppCommands(program);

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
    console.error('❌ Failed to initialize CLI:', error.message);
    process.exit(1);
  }
}

module.exports = { initializeCLI };
