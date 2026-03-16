/**
 * CLI environment deployment command setup (env deploy).
 *
 * @fileoverview Environment command definitions for AI Fabrix Builder CLI
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { handleCommandError } = require('../utils/cli-utils');

/**
 * Sets up environment deployment commands
 * @param {Command} program - Commander program instance
 */
function setupEnvironmentCommands(program) {
  const deployEnvHandler = async(envKey, options) => {
    try {
      const environmentDeploy = require('../deployment/environment');
      await environmentDeploy.deployEnvironment(envKey, options);
    } catch (error) {
      handleCommandError(error, 'env deploy');
      process.exit(1);
    }
  };

  const deployExamples = `
Examples:
  $ aifabrix env deploy dev
  $ aifabrix env deploy tst --preset m
  $ aifabrix env deploy dev --config ./env-config.json --no-poll`;

  const env = program
    .command('env')
    .description('Deploy and manage Miso Controller environments (dev, tst, pro, miso)');

  env
    .command('deploy <env>')
    .description('Deploy environment infrastructure in Miso Controller (run before deploy <app>)')
    .option('--config <file>', 'Environment configuration file (optional if --preset is used)')
    .option('--preset <size>', 'Environment size preset: s, m, l, xl (default: s)', 's')
    .option('--skip-validation', 'Skip environment validation')
    .option('--poll', 'Poll for deployment status', true)
    .option('--no-poll', 'Do not poll for status')
    .addHelpText('after', deployExamples)
    .action(deployEnvHandler);
}

module.exports = { setupEnvironmentCommands };
