/**
 * @fileoverview parameters subcommand (validate kv:// catalog coverage)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { handleCommandError } = require('../utils/cli-utils');
const { handleParametersValidate } = require('../commands/parameters-validate');

/**
 * @param {import('commander').Command} program - Commander program
 */
function setupParametersCommands(program) {
  const parameters = program
    .command('parameters')
    .description('Infra parameter catalog (kv:// keys, generators, Azure naming hints)');

  parameters
    .command('validate')
    .description('Check env.template kv:// references against lib/schema/infra.parameter.yaml')
    .option('--catalog <path>', 'Override path to infra.parameter.yaml')
    .action(async(opts) => {
      try {
        const result = await handleParametersValidate({ catalogPath: opts.catalog });
        if (!result.valid) process.exit(1);
      } catch (error) {
        handleCommandError(error, 'parameters validate');
      }
    });
}

module.exports = { setupParametersCommands };
