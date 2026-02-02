/**
 * CLI environment deployment command setup (environment deploy, env deploy).
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
      handleCommandError(error, 'environment deploy');
      process.exit(1);
    }
  };

  const environment = program
    .command('environment')
    .description('Manage environments');

  environment
    .command('deploy <env>')
    .description('Deploy/setup environment in Miso Controller')
    .option('--config <file>', 'Environment configuration file')
    .option('--skip-validation', 'Skip environment validation')
    .option('--poll', 'Poll for deployment status', true)
    .option('--no-poll', 'Do not poll for status')
    .action(deployEnvHandler);

  const env = program
    .command('env')
    .description('Environment management (alias for environment)');

  env
    .command('deploy <env>')
    .description('Deploy/setup environment in Miso Controller')
    .option('--config <file>', 'Environment configuration file')
    .option('--skip-validation', 'Skip environment validation')
    .option('--poll', 'Poll for deployment status', true)
    .option('--no-poll', 'Do not poll for status')
    .action(deployEnvHandler);
}

module.exports = { setupEnvironmentCommands };
